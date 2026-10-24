import type { BookConfig } from "../models/book.js";
import type { BookRules } from "../models/book-rules.js";
import type { Language } from "../models/language.js";

export function buildSettlerSystemPrompt(
  book: BookConfig,
  bookRules: BookRules | null,
  language: Language,
): string {
  const fullCast = bookRules?.enableFullCastTracking
    ? language === "en"
      ? "Track every present or explicitly mentioned character in the submitted state delta."
      : language === "ko"
        ? "제출하는 상태 변경에서 이 장에 등장했거나 명시적으로 언급된 캐릭터를 모두 추적합니다."
        : "在提交的状态变更中追踪本章出场或明确被提及的角色。"
    : "";
  if (language === "ko") {
    return `활성화된 장편 집필 Skill에 따라 본문에 명시된 사실을 증분 런타임 truth로 반영합니다. 무관한 상태와 안정적인 id는 그대로 두고, 계획을 이미 일어난 사건으로 간주하지 않습니다. ${fullCast}\n작품: ${book.title}.`;
  }
  return language === "en"
    ? `Project explicit facts from the chapter into incremental runtime truth using the activated long-writing Skill. Preserve unrelated state and stable ids. Plans are not completed events. ${fullCast}\nWork: ${book.title}.`
    : `按已激活的长篇写作 Skill，把正文明确事实投影为增量运行时 truth。保留无关状态和稳定 id，不把计划当成已发生事件。${fullCast}\n作品：${book.title}。`;
}

export function buildSettlerUserPrompt(params: {
  readonly chapterNumber: number;
  readonly title: string;
  readonly content: string;
  readonly selectedEvidenceBlock?: string;
  readonly governedControlBlock: string;
  readonly validationFeedback?: string;
  readonly language?: Language;
}): string {
  const isEnglish = params.language === "en";
  const isKorean = params.language === "ko";
  const heading = (en: string, zh: string, ko: string) => isEnglish ? en : isKorean ? ko : zh;
  const block = (title: string, value: string) => value
    ? `\n## ${title}\n${value}\n`
    : "";
  const controlBlock = params.governedControlBlock;

  return `${isEnglish ? `Project Chapter ${params.chapterNumber} "${params.title}" into runtime truth.` : isKorean ? `${params.chapterNumber}장 「${params.title}」을 런타임 truth로 반영합니다.` : `把第${params.chapterNumber}章「${params.title}」投影到运行时 truth。`}
${params.validationFeedback ? block(heading("Reconciliation observations", "状态对账观察", "상태 정합성 관찰"), params.validationFeedback) : ""}
## ${heading("Chapter body", "本章正文", "이 장 본문")}
${params.content}
${controlBlock}
${block(heading("Selected authority and long-range evidence", "已选权威与长程证据", "선별된 근거와 장기 증거"), params.selectedEvidenceBlock ?? "")}`;
}
