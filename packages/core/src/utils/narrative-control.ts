import type { ChapterIntent, ChapterMemo, ContextPackage } from "../models/input-governance.js";
import type { Language } from "../models/language.js";

/**
 * Render a ChapterMemo + optional ChapterIntent into a sanitized narrative
 * control block for the writer / reviser prompt.
 *
 * The model-authored memo remains intact. Code adds only host-owned metadata.
 */
export function renderMemoAsNarrativeBlock(
  memo: ChapterMemo,
  intent: ChapterIntent | undefined,
  language: Language = "zh",
): string {
  const isEn = language === "en";
  const sections: string[] = [];

  sections.push(`## ${isEn ? "Goal" : "目标"}\n- ${memo.goal}`);

  if (memo.threadRefs.length > 0) {
    const threads = memo.threadRefs.map((id) => `- ${id}`).join("\n");
    sections.push(`## ${isEn ? "Thread Refs" : "关联线索"}\n${threads}`);
  }

  // Emit the 7-section memo body at top level so each heading is a task.
  if (memo.body.trim().length > 0) {
    sections.push(memo.body);
  }

  return sections.join("\n\n");
}

export function buildNarrativeIntentBrief(
  chapterIntent: string,
  _language: Language = "zh",
): string {
  return chapterIntent.trim();
}

export function renderNarrativeSelectedContext(
  entries: ReadonlyArray<ContextPackage["selectedContext"][number]>,
  language: Language = "zh",
): string {
  const heading = language === "en" ? "Evidence" : language === "ko" ? "근거" : "证据";
  const reasonLabel = language === "en" ? "reason" : language === "ko" ? "이유" : "原因";
  const detailLabel = language === "en" ? "detail" : language === "ko" ? "세부 사항" : "细节";

  return entries
    .map((entry, index) => {
      const lines = [
        `### ${heading} ${index + 1}`,
        `- ${reasonLabel}: ${entry.reason}`,
        entry.excerpt ? `- ${detailLabel}: ${entry.excerpt}` : "",
      ].filter(Boolean);
      return lines.join("\n");
    })
    .join("\n\n");
}
