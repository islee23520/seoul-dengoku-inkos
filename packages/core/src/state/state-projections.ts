import type {
  ChapterSummariesState,
  CurrentStateState,
  HooksState,
} from "../models/runtime-state.js";
import { koreanChapterType } from "../utils/chapter-type.js";
import type { Language } from "../models/language.js";

export function renderHooksProjection(
  state: HooksState,
  language: Language = "zh",
  options?: { readonly currentChapter?: number },
): string {
  void options;
  const title = language === "en" ? "# Pending Hooks" : language === "ko" ? "# 복선 목록" : "# 伏笔池";
  const headers = language === "en"
    ? [
      "| hook_id | start_chapter | type | status | last_advanced_chapter | expected_payoff | notes |",
      "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    : language === "ko" ? ["| 복선 식별자 | 시작 장 | 유형 | 상태 | 최근 진행 장 | 예상 회수 | 비고 |", "| --- | --- | --- | --- | --- | --- | --- |"]
    : [
      "| hook_id | 起始章节 | 类型 | 状态 | 最近推进 | 预期回收 | 备注 |",
      "| --- | --- | --- | --- | --- | --- | --- |",
    ];

  const rows = [...state.hooks]
    .sort((left, right) => (
      left.startChapter - right.startChapter
      || left.lastAdvancedChapter - right.lastAdvancedChapter
      || left.hookId.localeCompare(right.hookId)
    ))
    .map((hook) => `| ${
        [
          hook.hookId,
          hook.startChapter,
          hook.type,
          language === "ko" ? ({ open: "미해결", progressing: "진행 중", resolved: "회수 완료", deferred: "보류", superseded: "대체됨" } as const)[hook.status] : hook.status,
          hook.lastAdvancedChapter,
          hook.expectedPayoff,
          hook.notes,
        ].map(escapeTableCell).join(" | ")
      } |`);

  return [title, "", ...headers, ...rows, ""].join("\n");
}

export function renderChapterSummariesProjection(
  state: ChapterSummariesState,
  language: Language = "zh",
): string {
  const title = language === "en" ? "# Chapter Summaries" : language === "ko" ? "# 장별 요약" : "# 章节摘要";
  const headers = language === "en"
    ? [
      "| Chapter | Title | Characters | Key Events | State Changes | Hook Activity | Mood | Chapter Type |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    : language === "ko" ? ["| 장 | 제목 | 등장인물 | 주요 사건 | 상태 변화 | 복선 동향 | 분위기 | 장 유형 |", "| --- | --- | --- | --- | --- | --- | --- | --- |"]
    : [
      "| 章节 | 标题 | 出场人物 | 关键事件 | 状态变化 | 伏笔动态 | 情绪基调 | 章节类型 |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ];

  const rows = [...state.rows]
    .sort((left, right) => left.chapter - right.chapter)
    .map((summary) => `| ${
      [
        summary.chapter,
        summary.title,
        summary.characters,
        summary.events,
        summary.stateChanges,
        summary.hookActivity,
        summary.mood,
        language === "ko" ? koreanChapterType(summary.chapterType) : summary.chapterType,
      ].map(escapeTableCell).join(" | ")
    } |`);

  return [title, "", ...headers, ...rows, ""].join("\n");
}

export function renderCurrentStateProjection(
  state: CurrentStateState,
  language: Language = "zh",
): string {
  const title = language === "en" ? "# Current State" : language === "ko" ? "# 현재 상태" : "# 当前状态";
  const chapterLabel = language === "en" ? "Current chapter" : language === "ko" ? "현재 장" : "当前章节";
  const headers = language === "en"
    ? [
        "| Subject | Predicate | Object | Valid from | Source chapter |",
        "| --- | --- | --- | --- | --- |",
      ]
    : language === "ko" ? ["| 주체 | 관계 / 속성 | 현재 사실 | 적용 장 | 출처 장 |", "| --- | --- | --- | --- | --- |"]
    : [
        "| 主体 | 关系 / 属性 | 当前事实 | 生效章节 | 来源章节 |",
        "| --- | --- | --- | --- | --- |",
      ];
  const facts = state.facts
    .filter((fact) => fact.validUntilChapter === null || fact.validUntilChapter >= state.chapter)
    .sort((left, right) => (
      left.subject.localeCompare(right.subject)
      || left.predicate.localeCompare(right.predicate)
      || left.object.localeCompare(right.object)
    ))
    .map((fact) => `| ${[
      fact.subject,
      fact.predicate,
      fact.object,
      fact.validFromChapter,
      fact.sourceChapter,
    ].map(escapeTableCell).join(" | ")} |`);

  return [
    title,
    "",
    `> ${chapterLabel}: ${state.chapter}`,
    "",
    ...headers,
    ...facts,
    "",
  ].join("\n");
}

function escapeTableCell(value: string | number): string {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>").trim();
}
