import { expect, it, vi } from "vitest";
import { StateValidatorAgent } from "../agents/state-validator.js";
import { koreanChapterType } from "../utils/chapter-type.js";
import { renderChapterSummariesProjection } from "../state/state-projections.js";
it("sends Korean state-validation headings and preserves the submitted report", async () => {
  const agent = new StateValidatorAgent({ client: { defaults: { maxTokens: 8192 } }, model: "fixture", projectRoot: "/tmp" } as never);
  const report = "## 제안된 복선\n복선 목록과 본문이 다릅니다.";
  const submit = vi.spyOn(agent as unknown as { submitStructured: (...args: unknown[]) => Promise<unknown> }, "submitStructured").mockResolvedValue({ result: { reportMarkdown: report, reconciliationRequired: true } });
  try {
    const result = await agent.validate("본문", 1, "이전", "다음", "기존 복선", "새 복선", "ko", { bookRules: "규칙" });
    const messages = submit.mock.calls[0]![0] as Array<{content:string}>;
    expect(messages[0]!.content).not.toContain("用中文回答");
    expect(messages[1]!.content).not.toMatch(/Previous State|Proposed Hooks|Chapter Text|Authority/);
    expect(result.observations[0]!.summary).toBe(report);
  } finally { submit.mockRestore(); }
});
it("maps known chapter types and retains unknown identities in Korean projections", () => {
  expect(koreanChapterType("ordinary")).toBe("일상");
  expect(koreanChapterType("unknown_kind")).toBe("기타(unknown_kind)");
  expect(koreanChapterType("기타(unknown_kind)")).toBe("기타(unknown_kind)");
  const row = { chapter: 1, title: "도착", characters: "서윤", events: "발견", stateChanges: "변화", hookActivity: "복선", mood: "차분함", chapterType: "ordinary" };
  expect(renderChapterSummariesProjection({ rows: [row] }, "ko")).toContain("| 일상 |");
  expect(row.chapterType).toBe("ordinary");
  expect(renderChapterSummariesProjection({ rows: [row] }, "en")).toContain("| ordinary |");
});
