import type {ShortFictionMeasurements} from "../agents/short-fiction.js";
import type { Language } from "../models/language.js";

export type ShortFictionLanguage = Language;

export interface ShortFictionReferencePromptInput { readonly text?: string; }
export interface ShortFictionOutlinePromptInput {
  readonly title?: string;
  readonly direction: string;
  readonly chapterCount: number;
  readonly charsPerChapter: number;
  readonly reference?: ShortFictionReferencePromptInput;
}
export interface ShortFictionDraftPromptInput {
  readonly title?: string;
  readonly openingHookChars?: number;
  readonly direction: string;
  readonly outlineMarkdown: string;
  readonly chapterCount: number;
  readonly charsPerChapter: number;
  readonly maxChapterLength?: number;
  readonly minChapterLength?: number;
  readonly chapterNumbers?: readonly number[];
  readonly previousDraftMarkdown?: string;
}
export interface ShortFictionDraftReviewPromptInput extends ShortFictionDraftPromptInput { readonly draftMarkdown: string; readonly revisionRequest?: string; readonly reviewScope?: string; readonly measurements?: ShortFictionMeasurements; }
export interface ShortFictionPackagePromptInput {
  readonly reviewContext?: string;
  readonly direction: string;
  readonly outlineMarkdown: string;
  readonly draftMarkdown: string;
  readonly draftTitle: string;
}

export function buildShortFictionOutlineSystemPrompt(language: ShortFictionLanguage = "zh"): string {
  if (language === "ko") return "활성화된 단편 집필 Skill과 주어진 자료만으로 완전한 단편 기획을 만들고, 기획 도구로 제출합니다. 모든 제목, 소제목과 본문은 한국어로 작성하고 영어 병기나 괄호 번역을 넣지 않습니다. 공통 전제, 주인공, 중심 갈등처럼 한국어 소제목을 사용합니다. 도구의 필드 이름과 식별자는 그대로 유지합니다.";
  return language === "en"
    ? "Create the complete short-story plan using the activated short-writing Skill and only the supplied material. Submit it through the outline tool."
    : "按已激活的短篇写作 Skill 和用户材料生成完整短篇方案，通过方案工具提交。";
}

export function buildShortFictionOutlineUserPrompt(input: ShortFictionOutlinePromptInput, language: ShortFictionLanguage = "zh"): string {
  const reference = input.reference?.text?.trim();
  return [
    language === "en" ? "## Creative Direction" : language === "ko" ? "## 창작 방향" : "## 创作方向",
    input.direction,
    ...(input.title?[language==="en"?`Confirmed title: ${input.title}. Preserve it exactly.`:language==="ko"?`확정 제목: ${input.title}. 제목은 그대로 유지합니다.`:`已确定书名：${input.title}。书名保持原样。`]:[]),
    "",
    language === "en" ? "## Target" : language === "ko" ? "## 목표" : "## 目标",
    language === "en"
      ? `${input.chapterCount} chapters; about ${input.charsPerChapter} words per chapter.`
      : language === "ko"
        ? `${input.chapterCount}장이며 각 장 약 ${input.charsPerChapter}자입니다.`
        : `${input.chapterCount} 章；每章约 ${input.charsPerChapter} 字。`,
    ...(reference ? ["", language === "en" ? "## Reference" : language === "ko" ? "## 참고 자료" : "## 参考材料", reference] : []),
  ].join("\n");
}
export function buildShortFictionWriterSystemPrompt(language: ShortFictionLanguage = "zh"): string {
  if (language === "ko") return "활성화된 단편 집필 Skill과 전체 기획에 따라 요청받은 장만 집필하고, 초안 도구로 완전한 장을 제출합니다.";
  return language === "en"
    ? "Write exactly the requested chapter batch using the activated short-writing Skill and the full plan. Submit complete chapters through the draft tool."
    : "按已激活的短篇写作 Skill 和完整方案写本批指定章节，通过初稿工具提交完整章节。";
}

export function buildShortFictionWriterUserPrompt(input: ShortFictionDraftPromptInput, language: ShortFictionLanguage = "zh"): string {
  const chapters = requestedShortFictionChapters(input);
  const previous = input.previousDraftMarkdown?.trim();
  return [
    language === "en" ? "## Task" : language === "ko" ? "## 작업" : "## 任务",
    language === "en"
      ? `Write only chapters ${chapters.join(", ")} of ${input.chapterCount}; about ${input.charsPerChapter} words each.`
      : language === "ko"
        ? `전체 ${input.chapterCount}장 중 ${chapters.join(", ")}장만 씁니다. 각 장 약 ${input.charsPerChapter}자입니다.`
        : `只写第 ${chapters.join("、")} 章；全篇 ${input.chapterCount} 章，每章约 ${input.charsPerChapter} 字。`,
    ...(input.title?[language==="en"?`Confirmed title: ${input.title}. Preserve it exactly.`:language==="ko"?`확정 제목: ${input.title}. 제목은 그대로 유지합니다.`:`已确定书名：${input.title}。书名保持原样。`]:[]),
    ...(input.openingHookChars&&chapters.includes(1)?[language==="en"?`Also submit an independent opening scene of about ${input.openingHookChars} words before chapter one. Keep the complete first chapter separate.`:language==="ko"?`1장 앞에 약 ${input.openingHookChars}자의 독립적인 도입 장면도 openingHook 필드로 함께 제출합니다. 1장 자체는 완전하게 써야 하며 도입 장면으로 대체할 수 없습니다.`:`另交约 ${input.openingHookChars} 字的正文前独立开篇场面，放在 openingHook 字段；第一章仍须完整，不能用开篇钩子代替。`]:[]),
    ...(input.maxChapterLength !== undefined ? [language === "en" ? `Maximum per chapter: ${input.maxChapterLength} words.` : language === "ko" ? `각 장 최대 ${input.maxChapterLength}자(공백 제외 문자 수, 문장부호 포함).` : `每章正文最多 ${input.maxChapterLength} 个非空白字符（含标点）。`] : []),
    ...(input.minChapterLength !== undefined ? [language === "en" ? `Minimum per chapter: ${input.minChapterLength} words.` : language === "ko" ? `각 장 최소 ${input.minChapterLength}자(공백 제외 문자 수, 문장부호 포함).` : `每章正文至少 ${input.minChapterLength} 个非空白字符（含标点）。`] : []),
    "",
    language === "en" ? "## Direction" : language === "ko" ? "## 창작 방향" : "## 创作方向",
    input.direction,
    "",
    language === "en" ? "## Plan" : language === "ko" ? "## 이야기 기획" : "## 故事方案",
    input.outlineMarkdown,
    ...(previous ? ["", language === "en" ? "## Persisted previous chapters" : language === "ko" ? "## 저장된 이전 장" : "## 已落盘前文章节", previous] : []),
  ].join("\n");
}
export function buildShortFictionDraftReviewSystemPrompt(language: ShortFictionLanguage = "zh"): string {
  if (language === "ko") {
    return "활성화된 단편 집필 Skill로 저장된 원고를 검토합니다. 모든 소견에 sourceId를 지정하고, 번호가 붙은 원본에서 짧고 연속된 startLine/endLine 범위를 선택하면 시스템이 해당 구절을 그대로 발췌합니다. 기획과의 차이와 본문 내부 모순을 구분합니다. 검토 도구로 근거 있는 소견과 간결한 요약을 제출하며, observations가 비어 있어도 정상입니다.";
  }
  return language === "en"
    ? "Review the persisted draft with the activated short-writing Skill. Attribute every finding to its sourceId and select a short inclusive startLine/endLine range from the numbered source; the host copies the exact excerpt. Distinguish outline differences from manuscript contradictions. Submit evidence-backed observations and a concise summary through the review tool. An empty observations array is valid."
    : "按已激活的短篇写作 Skill 审查已落盘成稿。每项观察指定 sourceId 和该编号来源内一小段连续的 startLine/endLine（含首尾行），系统按行号截取原文。区分大纲差异与正文内部矛盾。通过审稿工具提交有证据的观察和简短总结；observations 为空是合法结果。";
}

export function buildShortFictionDraftReviewUserPrompt(input: ShortFictionDraftReviewPromptInput, language: ShortFictionLanguage = "zh"): string {
  return [
    language === "en" ? "## Direction" : language === "ko" ? "## 창작 방향" : "## 创作方向", input.direction,
    "", language === "en" ? "## Source: outline (plan, not manuscript)" : language === "ko" ? "## Source: outline(기획)" : "## Source: outline（大纲）", input.outlineMarkdown,
    "", language === "en" ? "## Review scope" : language === "ko" ? "## 검토 범위" : "## 审查范围", input.reviewScope ?? "whole-story",
    ...(input.revisionRequest ? ["", language === "en" ? "## Latest revision request" : language === "ko" ? "## 최신 수정 요청" : "## 最近修改请求", input.revisionRequest] : []),
    ...(input.measurements ? ["", language==="en"?"## Host-verified manuscript measurements":language==="ko"?"## 호스트가 검증한 원고 계측":"## 宿主核验的成稿计量",
      JSON.stringify({contentScope:"complete_manuscript",chapterLengthScope:"prose_excluding_chapter_headings",...input.measurements}),
      language==="en"?"Use these measured lengths. Numbered source lines below contain the complete supplied manuscript; line numbering does not mean an excerpt.":language==="ko"?"분량 판단은 위 실측값을 따릅니다. 아래 번호가 붙은 원본은 제공된 원고 전체이며, 번호는 인용용이지 발췌를 뜻하지 않습니다.":"篇幅判断采用以上实测值。以下编号来源包含所提供的完整正文；编号用于引用，不表示节选。"] : []),
    "", language === "en" ? "## Draft under review" : language === "ko" ? "## 검토 대상 본문" : "## 待审正文", input.draftMarkdown,
  ].join("\n");
}

export function buildShortFictionPackageSystemPrompt(language: ShortFictionLanguage = "zh"): string {
  if (language === "ko") return "활성화된 단편 집필 Skill로 저장된 원고를 패키징합니다. 실제 제목과 줄거리를 그대로 살려 패키지 도구로 제출합니다.";
  return language === "en"
    ? "Package the persisted draft using the activated short-writing Skill. Preserve its actual title and plot, then submit through the package tool."
    : "按已激活的短篇写作 Skill 包装已落盘正文，保留实际标题与剧情，通过包装工具提交。";
}

export function buildShortFictionPackageUserPrompt(input: ShortFictionPackagePromptInput, language: ShortFictionLanguage = "zh"): string {
  return [
    language === "en" ? "## Direction" : language === "ko" ? "## 창작 방향" : "## 创作方向", input.direction,
    "", language === "en" ? "## Plan" : language === "ko" ? "## 이야기 기획" : "## 故事方案", input.outlineMarkdown.trim(),
    "", language === "en" ? "## Persisted draft" : language === "ko" ? "## 저장된 원고" : "## 已落盘正文", input.draftMarkdown.trim(),
    "", language === "en" ? "## Existing title" : language === "ko" ? "## 현재 제목" : "## 当前标题", input.draftTitle,
    ...(input.reviewContext?["",language==='en'?"## Review evidence":language==="ko"?"## 검토 근거":"## 审稿依据",input.reviewContext]:[]),
  ].join("\n");
}
function requestedShortFictionChapters(input: ShortFictionDraftPromptInput): number[] {
  const requested = input.chapterNumbers?.filter((chapter) => Number.isInteger(chapter) && chapter >= 1 && chapter <= input.chapterCount);
  return requested && requested.length > 0
    ? [...new Set(requested)].sort((a, b) => a - b)
    : Array.from({ length: input.chapterCount }, (_, index) => index + 1);
}
