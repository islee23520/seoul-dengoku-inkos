import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { runAgentSession, abortAgentSession } from "../agent/agent-session.js";
import { loadWorkManifest } from "../harness/work-store.js";

it.each(["zh", "en", "ko"] as const)("carries %s through the session into capability creation", async (language) => {
  const root = await mkdtemp(join(tmpdir(), "inkos-agent-language-"));
  const requests: Array<{ messages: Array<{ role: string; content: string }> }> = [];
  const upstream = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    requests.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const creating = requests.length === 1;
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{
      id: `language-${requests.length}`, type: "function", function: {
        name: creating ? "workspace__create_work" : "finish_turn",
        arguments: JSON.stringify(creating
          ? { workId: "fixture", profileId: "script", title: "Fixture", intent: "Create an empty script Work." }
          : { status: "delivered", message: "Ready" }),
      },
    }] } }] }));
  });
  const listening = once(upstream, "listening");
  upstream.listen(0, "127.0.0.1");
  await listening;
  try {
    const result = await runAgentSession({
      projectRoot: root, sessionId: "language", bookId: null, workId: null, profileId: "workspace-default",
      sessionKind: "chat", language, apiKey: "fixture", stream: false, pipeline: {} as never,
      model: { id: "fixture", name: "Fixture", provider: "openai", api: "openai-completions",
        baseUrl: `http://127.0.0.1:${(upstream.address() as { port: number }).port}/v1`, input: ["text"], reasoning: false,
        contextWindow: 128000, maxTokens: 8192, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } },
    }, "Create an empty script Work called Fixture.");
    expect(result.errorMessage).toBeUndefined();
    expect(result.completion?.status).toBe("delivered");
    expect((await loadWorkManifest(root, "fixture")).language).toBe(language);
    if (language === "ko") {
      expect(requests[0].messages.find(message => message.role === "system")?.content).toMatch(/[가-힣]/);
    }
  } finally {
    abortAgentSession(root, "language");
    upstream.closeAllConnections();
    await new Promise<void>((resolve, reject) => upstream.close(error => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  }
}, 20000);
