import type { ContextPackage } from "../models/input-governance.js";
import { renderNarrativeSelectedContext } from "../utils/narrative-control.js";
import type { Language } from "../models/language.js";

export function getPlannerMemoSystemPrompt(language: Language = "zh"): string {
  if (language === "ko") {
    return "입력된 governed context를 한 장의 memo로 정리합니다. 본문은 쓰지 않습니다. 전문 기획 방법은 활성화된 Skill에서만 나옵니다. 사용자 방향과 확정된 사실을 유지하고, 입력에 있는 hook id만 사용하며, 결과 도구를 통해 구체적인 목표 하나와 읽기 쉬운 Markdown 계획을 제출합니다.";
  }
  return language === "en"
    ? "Compile the supplied governed context into one chapter memo. Do not write prose. Professional planning methodology comes only from the activated Skill. Preserve user direction and established facts, use only supplied hook ids, and submit one concrete goal plus a readable Markdown plan through the result tool."
    : "把输入的 governed context 编译为一份章节 memo，不写正文。专业规划方法只来自已激活 Skill。保留用户方向和既成事实，只使用输入中存在的 hook id，并通过结果工具提交一个具体目标和完整可读的 Markdown 计划。";
}

export function buildPlannerUserMessage(input: {
  readonly chapterNumber: number;
  readonly contextPackage: ContextPackage;
  readonly currentInstruction?: string;
  readonly previousChapter?: string;
  readonly lengthBudget: {
    readonly target: number;
    readonly unit: string;
  };
  readonly language?: Language;
}): string {
  const language = input.language ?? "zh";
  const context = renderNarrativeSelectedContext(input.contextPackage.selectedContext, language);
  const instruction = input.currentInstruction?.trim();
  const previous = input.previousChapter?.trim();
  if (language === "en") {
    return [
      `# Chapter ${input.chapterNumber} memo request`,
      instruction ? `## Current user instruction\n${instruction}` : "",
      `## Governed context\n${context}`,
      previous ? `## Previous chapter\n${previous}` : "",
      "## Host length telemetry",
      `User target: ${input.lengthBudget.target} ${input.lengthBudget.unit}. Treat it as a creative constraint, not a host quality verdict.`,
    ].filter(Boolean).join("\n\n");
  }
  if (language === "ko") {
    return [
      `# 제${input.chapterNumber}장 memo 요청`,
      instruction ? `## 현재 사용자 지시\n${instruction}` : "",
      `## 정식 컨텍스트\n${context}`,
      previous ? `## 이전 장 본문\n${previous}` : "",
      "## 호스트 분량 데이터",
      `사용자 목표: ${input.lengthBudget.target} ${input.lengthBudget.unit}. 이것은 창작 제약이지 호스트의 품질 평가가 아닙니다.`,
    ].filter(Boolean).join("\n\n");
  }
  return [
    `# 第${input.chapterNumber}章 memo 请求`,
    instruction ? `## 当前用户指令\n${instruction}` : "",
    `## 权威上下文\n${context}`,
    previous ? `## 上一章正文\n${previous}` : "",
    "## 宿主字数遥测",
    `用户目标：${input.lengthBudget.target} ${input.lengthBudget.unit}。这是创作约束，不是宿主质量判决。`,
  ].filter(Boolean).join("\n\n");
}
