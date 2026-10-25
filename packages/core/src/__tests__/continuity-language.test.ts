import { afterEach, describe, expect, it, vi } from "vitest";
import { ContinuityAuditor } from "../agents/continuity.js";
import { createLLMClient } from "../llm/provider.js";
import type { Language } from "../models/language.js";
import { renderNarrativeSelectedContext } from "../utils/narrative-control.js";

const fetchWithProxyMock = vi.hoisted(() => vi.fn());
vi.mock("../utils/proxy-fetch.js", () => ({ fetchWithProxy: fetchWithProxyMock }));

afterEach(() => vi.resetAllMocks());

describe("chapter review language", () => {
  it.each<{ language: Language; script: RegExp }>([
    { language: "ko", script: /[가-힣]/ },
    { language: "en", script: /[A-Za-z]/ },
    { language: "zh", script: /[\u4e00-\u9fff]/ },
  ])("passes $language through the audit invocation without changing the review contract", async ({ language, script }) => {
    const chapter = "서연은 빈 손으로 문을 열었다.";
    const canon = "Seoyeon holds the key.";
    const summary = language === "ko" ? "열쇠의 행방을 확인해야 합니다." : language === "en" ? "Check the key." : "确认钥匙的去向。";
    fetchWithProxyMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      const tool = body.tools[0].function;
      expect(tool.name).toBe("submit_chapter_review");
      expect(tool.description).toMatch(script);
      expect(body.messages.find((message: { role: string }) => message.role === "system").content).toMatch(script);
      expect(Object.keys(tool.parameters.properties)).toEqual(["summary", "observations"]);
      const input = JSON.parse(body.messages.findLast((message: { role: string }) => message.role === "user").content);
      expect(input.chapterNumber).toBe(1);
      const context = input.sources.find((source: { sourceId: string }) => source.sourceId === "governed-context");
      expect(context.numberedLines).toContain(canon);
      if (language === "ko") expect(context.numberedLines).toMatch(/[가-힣]/);
      const canonLine = Number(context.numberedLines.split("\n").find((line: string) => line.endsWith(canon)).split("\t")[0]);
      return new Response(JSON.stringify({
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        choices: [{ finish_reason: "tool_calls", message: { tool_calls: [{ id: "review", type: "function", function: {
          name: tool.name,
          arguments: JSON.stringify({ summary, observations: [{ code: "KEY_CONTINUITY", assessment: "issue", summary,
            sourceRefs: [{ sourceId: "chapter-1", startLine: 1, endLine: 1 }, { sourceId: "governed-context", startLine: canonLine, endLine: canonLine }],
          }] }),
        } }] } }],
      }));
    });
    const client = createLLMClient({ provider: "openai", service: "custom", configSource: "studio", baseUrl: "https://example.test/v1", model: "fixture", apiKey: "fixture", apiFormat: "chat", stream: false, temperature: 0, thinkingBudget: 0 });
    const review = await new ContinuityAuditor({ client, model: "fixture", projectRoot: "/tmp" }).auditChapter("/tmp", chapter, 1, undefined, {
      language, contextPackage: { chapter: 1, selectedContext: [{ source: "story/current_state.md", reason: "Canon", excerpt: canon, protection: "protected" }] },
    });
    expect(fetchWithProxyMock).toHaveBeenCalledTimes(1);
    expect(review).toEqual({ summary, tokenUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, observations: [{
      code: "KEY_CONTINUITY", assessment: "issue", summary, evidence: [],
      sourceRefs: [{ sourceId: "chapter-1", quote: chapter }, { sourceId: "governed-context", quote: expect.stringContaining(canon) }],
    }] });
  });

  it("keeps selected-context defaults and source text while choosing Korean labels", () => {
    const entries = [{ source: "canon", reason: "R", excerpt: "Original evidence.", protection: "protected" as const }];
    const korean = renderNarrativeSelectedContext(entries, "ko");
    expect(korean).toMatch(/[가-힣]/);
    expect(korean).not.toMatch(/[\u4e00-\u9fff]/);
    expect(korean).toContain("Original evidence.");
    expect(renderNarrativeSelectedContext(entries)).toBe(renderNarrativeSelectedContext(entries, "zh"));
    expect(renderNarrativeSelectedContext(entries, "en")).toContain("Original evidence.");
    expect(renderNarrativeSelectedContext([], "ko")).toBe("");
  });
});
