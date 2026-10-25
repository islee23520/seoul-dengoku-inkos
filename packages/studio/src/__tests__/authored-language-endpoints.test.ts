import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StateManager } from "@actalk/inkos-core";
import { createStudioServer } from "../api/server.js";

const calls = vi.hoisted(() => ({ worker: vi.fn(), style: vi.fn() }));
vi.mock("@actalk/inkos-core", async (original) => ({
  ...await original<typeof import("@actalk/inkos-core")>(),
  runWorkerAgent: calls.worker,
  compileStyleGuide: calls.style,
}));

describe("Studio authored-language endpoints", () => {
  let root: string;
  beforeEach(async () => {
    vi.clearAllMocks();
    root = await mkdtemp(join(tmpdir(), "inkos-authored-language-"));
    await writeFile(join(root, "inkos.json"), JSON.stringify({
      name: "fixture", version: "0.1.0", language: "ko",
      llm: { defaultModel: "fixture", services: [{ service: "custom", name: "fixture", models: ["fixture"], baseUrl: "https://example.invalid/v1", apiFormat: "chat", stream: false }] },
      notify: [],
    }));
    await mkdir(join(root, ".inkos"));
    await writeFile(join(root, ".inkos/secrets.json"), JSON.stringify({ services: { "custom:fixture": { apiKey: "fixture" } } }));
    calls.worker.mockResolvedValue({ content: "한국어 영감 카드" });
    calls.style.mockResolvedValue("한국어 문체 지침");
  });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it.each(["zh", "en", "ko"])("persists %s through both project language routes", async (language) => {
    const app = createStudioServer({} as never, root);
    for (const [method, path] of [["PUT", "/api/v1/project"], ["POST", "/api/v1/project/language"]]) {
      const config = JSON.parse(await readFile(join(root, "inkos.json"), "utf8"));
      await writeFile(join(root, "inkos.json"), JSON.stringify({ ...config, language: language === "zh" ? "en" : "zh" }));
      const response = await app.request(path, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language }),
      });
      expect(response.status).toBe(200);
      expect(JSON.parse(await readFile(join(root, "inkos.json"), "utf8")).language).toBe(language);
    }
  });

  it.each(["ja", "", null, 1])("rejects invalid project language %s without writing other updates", async (language) => {
    const before = await readFile(join(root, "inkos.json"), "utf8");
    const app = createStudioServer({} as never, root);
    for (const [method, path] of [["PUT", "/api/v1/project"], ["POST", "/api/v1/project/language"]]) {
      const response = await app.request(path, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language, temperature: 0.1 }),
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toHaveProperty("error");
      expect(await readFile(join(root, "inkos.json"), "utf8")).toBe(before);
    }
  });

  it("preserves authored language when updating unrelated project settings", async () => {
    const response = await createStudioServer({} as never, root).request("/api/v1/project", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ temperature: 0.3 }),
    });
    expect(response.status).toBe(200);
    expect(JSON.parse(await readFile(join(root, "inkos.json"), "utf8"))).toMatchObject({ language: "ko", llm: { temperature: 0.3 } });
  });

  it("sends Korean book context to the inspiration worker", async () => {
    const state = new StateManager(root);
    const now = "2026-10-25T00:00:00.000Z";
    await state.saveBookConfig("novel", {
      id: "novel", title: "이야기", genre: "other", platform: "other", language: "ko",
      status: "active", targetChapters: 10, chapterWordCount: 4000, createdAt: now, updatedAt: now,
    });
    await mkdir(join(state.bookDir("novel"), "chapters"), { recursive: true });
    await writeFile(join(state.bookDir("novel"), "chapters", "0001_Arrival.md"), "한국어 원문.");
    const response = await createStudioServer({} as never, root).request("/api/v1/books/novel/chapters/1/workspace/inspiration", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief: "계속" }),
    });
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body).toMatchObject({ card: "한국어 영감 카드" });
    const messages = calls.worker.mock.calls[0][2];
    expect(messages[0].content).toMatch(/[가-힣]/);
    expect(messages[0].content).not.toMatch(/[\u4e00-\u9fff]/);
    expect(messages[1].content).toContain("한국어 원문.");
  });

  it.each([undefined, "ko"])("preserves Korean style-analysis language with request %s", async (language) => {
    const response = await createStudioServer({} as never, root).request("/api/v1/style/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "한국어 원문.", sourceName: "fixture", language }),
    });
    expect(response.status, JSON.stringify(await response.json())).toBe(200);
    expect(calls.style.mock.calls[0][0].language).toBe("ko");
  });
});
