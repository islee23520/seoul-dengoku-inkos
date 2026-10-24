import type { Language } from "../models/language.js";
// Bilingual prompt builders for the narrative forecast agent, organized the
// same way as prompts/short-fiction.ts: each builder switches on language.

export type ForecastLanguage = Language;

export interface ForecastPromptInput {
  readonly contextMarkdown: string;
  readonly divergence: string;
  readonly branchCount: number;
  readonly horizon: number;
  readonly baseChapter: number;
}

export function buildForecastSystemPrompt(language: ForecastLanguage): string {
  if (language === "ko") {
    return "활성화된 장편 집필 Skill로 서로 격리된 비정사 후보 미래를 전개합니다. 정사는 유지하고, 충돌은 위험 요소로 명시합니다.";
  }
  return language === "en"
    ? "Project mutually isolated, non-canonical futures with the activated long-writing Skill. Preserve canon and surface conflicts as risks."
    : "按已激活的长篇写作 Skill 推演相互隔离的非正史候选未来。保留正典，把冲突明确列为风险。";
}

export function buildForecastUserPrompt(input: ForecastPromptInput, language: ForecastLanguage): string {
  const firstChapter = input.baseChapter + 1;
  if (language === "en") {
    return [
      input.contextMarkdown,
      "",
      "## Divergence point",
      "",
      input.divergence,
      "",
      "## Output requirements",
      "",
      `Produce exactly ${input.branchCount} candidate branches. Each branch covers roughly ${input.horizon} future chapters starting at chapter ${firstChapter}.`,
      "Submit complete branches through the forecast result tool.",
    ].join("\n");
  }
  if (language === "ko") {
    return [
      input.contextMarkdown,
      "",
      "## 분기점",
      "",
      input.divergence,
      "",
      "## 출력 요구",
      "",
      `정확히 ${input.branchCount}개의 후보 분기를 만듭니다. 각 분기는 ${firstChapter}장부터 시작해 약 ${input.horizon}장의 미래 전개를 다룹니다.`,
      "서사 전개 결과 도구를 통해 완전한 분기를 제출합니다.",
    ].join("\n");
  }
  return [
    "",
    input.divergence,
    "",
    "## 输出要求",
    "",
    `生成恰好 ${input.branchCount} 个候选分支。每个分支覆盖从第 ${firstChapter} 章开始、约 ${input.horizon} 章的未来走向。`,
    "通过剧情推演结果工具提交完整分支。",
  ].join("\n");
}

export function buildForecastRepairPrompt(validationError: string, language: ForecastLanguage): string {
  if (language === "ko") {
    return [
      `이전 출력이 검증을 통과하지 못했습니다: ${validationError}`,
      "문제를 수정한 뒤 결과 도구를 통해 완전한 분기 전체를 다시 제출합니다.",
    ].join("\n");
  }
  if (language === "en") {
    return [
      `Your previous output failed validation: ${validationError}`,
      "Submit the corrected complete branch set through the result tool.",
    ].join("\n");
  }
  return [
    `你上一次的输出未通过校验：${validationError}`,
    "请修正上述问题后，通过结果工具重新提交完整分支。",
  ].join("\n");
}
