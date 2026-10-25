import { splitChapters } from "../utils/chapter-splitter.js";
import { renderShortFictionDraftMarkdown, renderShortFictionSalesPackage } from "../agents/short-fiction.js";
import { describe, expect, it, vi } from "vitest";
import { ShortFictionOutlineAgent } from "../agents/short-fiction.js";
import { renderForecastComparisonMarkdown, renderSelectedBranchPlanMarkdown } from "../forecast/render.js";
import type { NarrativeForecast } from "../forecast/schema.js";
import { getPlannerMemoSystemPrompt, buildPlannerUserMessage } from "../agents/planner-prompts.js";
import { buildSettlerUserPrompt } from "../agents/settler-prompts.js";
import { renderShortFictionReview } from "../pipeline/short-fiction-runner.js";

function makeKoreanForecast(): NarrativeForecast {
  return {
    version: 1,
    forecastId: "fc-test-ko",
    bookId: "book-ko",
    createdAt: "2026-01-01T00:00:00.000Z",
    language: "ko",
    divergence: "주인공이 도시를 떠난다",
    horizon: 3,
    baseChapter: 10,
    contextFingerprint: "sha256:test",
    status: "active",
    branches: [
      {
        branchId: "branch-1",
        title: "귀향 분기",
        premise: "주인공이 고향으로 돌아가 옛 인연을 다시 만난다.",
        beats: [{ chapter: 11, summary: "고향역에 내린다." }],
        characterDecisions: [{ character: "주인공", decision: "남기로 한다." }],
        projectedChanges: { characters: ["주인공"], relationships: [], world: [], hooks: ["옛 편지"] },
        risks: [{ kind: "timeline", description: "시간표가 10장과 충돌한다." }, { kind: "pacing", description: "너무 빠르다." }, { kind: "causality", description: "동기가 부족하다." }],
        uncertainties: ["고향 배경 미정"],
        intentRationale: "작가 의도와 대체로 일치한다.",
      },
    ],
  };
}

describe("Korean rendering branches", () => {
  it("renders structured outline chapter headings in Korean", async () => {
    const agent = new ShortFictionOutlineAgent({ client: { defaults: { maxTokens: 4096 } }, model: "fixture", projectRoot: "/tmp" } as never);
    const submit = vi.spyOn(agent as never as { submitStructured: (...args: unknown[]) => Promise<unknown> }, "submitStructured").mockResolvedValue({ result: { storyTitle: "편지", planMarkdown: "편지가 도착한다.", chapter_1_plan: "봉투를 연다." } });
    try {
      const outline = await agent.createOutline({ direction: "편지", chapterCount: 1, charsPerChapter: 1000, language: "ko" });
      expect(splitChapters(outline.rawContent)).toEqual([{ title: "제1장", content: "봉투를 연다." }]);
      expect(outline.rawContent).not.toMatch(/[\u4e00-\u9fff]/);
    } finally { submit.mockRestore(); }
  });
  it("renders short-fiction publication headings without Chinese fallback", () => {
    const manuscript = renderShortFictionDraftMarkdown({ storyTitle: "편지", openingHook: "누군가 문을 두드렸다.", rawContent: "", chapters: [{ number: 1, title: "도착", content: "편지가 왔다.", charCount: 6 }] }, "ko");
    const sales = renderShortFictionSalesPackage({ title: "편지", intro: "오래된 편지", sellingPoints: ["반전"], coverPrompt: "표지 그림", rawContent: "" }, "ko");
    expect(manuscript).toContain("## 도입 장면");
    expect(splitChapters(manuscript)).toEqual([{ title: "도착", content: "편지가 왔다." }]);
    expect(sales).toContain("## 줄거리 소개");
    expect(manuscript + sales).not.toMatch(/[\u4e00-\u9fff]/);
  });
  it("renders the forecast comparison document in Korean", () => {
    const markdown = renderForecastComparisonMarkdown(makeKoreanForecast());
    expect(markdown).toContain("# 서사 전개 비교: 주인공이 도시를 떠난다");
    expect(markdown).toContain("| 분기 | 제목 | 위험 수 | 전제 |");
    expect(markdown).toContain("- 기준 장: 제 10장");
    expect(markdown).toContain("## 정합성 위험");
    expect(markdown).toContain("## 미래 장 개요");
    expect(markdown).toContain("제 11장: 고향역에 내린다.");
    expect(markdown).not.toMatch(/\[(timeline|pacing|causality)\]/);
    expect(markdown).toContain("[인과관계]");
  });

  it("renders the selected branch plan document in Korean", () => {
    const forecast = makeKoreanForecast();
    const markdown = renderSelectedBranchPlanMarkdown({
      forecast,
      branch: forecast.branches[0],
      selectedAt: "2026-01-02T00:00:00.000Z",
      stale: true,
    });
    expect(markdown).toContain("# 선택된 분기 계획: 귀향 분기");
    expect(markdown).toContain("- 분기점: 주인공이 도시를 떠난다");
    expect(markdown).toContain("이 전개는 만료되었습니다");
  });

  it("renders the short-fiction review report in Korean", () => {
    const markdown = renderShortFictionReview(
      {
        summary: "전체적으로 균형이 잡혀 있다.",
        observations: [
          {
            code: "PACING",
            summary: "2장 전개가 성급하다.",
            evidence: ["final/chapters/0002.md:12-18"],
          },
        ],
      },
      "ko",
    );
    expect(markdown).toContain("# 원고 검토");
    expect(markdown).toContain("## 검토 소견");
    expect(markdown).toContain("근거:");
  });

  it("assembles long-form planner and settler prompts in Korean", () => {
    expect(getPlannerMemoSystemPrompt("ko")).toContain("governed context를 한 장의 memo로 정리합니다");

    const settler = buildSettlerUserPrompt({
      chapterNumber: 3,
      title: "첫눈",
      content: "본문",
      governedControlBlock: "제어 블록",
      language: "ko",
    });
    expect(settler).toContain("3장 「첫눈」을 런타임 truth로 반영합니다");
    expect(settler).toContain("## 이 장 본문");

    const planner = buildPlannerUserMessage({
      chapterNumber: 4,
      contextPackage: { selectedContext: [] } as never,
      lengthBudget: { target: 2000, unit: "자" },
      language: "ko",
    });
    expect(planner).toContain("# 제4장 memo 요청");
    expect(planner).toContain("## 호스트 분량 데이터");
  });
});
