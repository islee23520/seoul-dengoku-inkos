import type { Language } from "../models/language.js";
import type { ForecastBranch, NarrativeForecast } from "./schema.js";

// Deterministic markdown renderers for forecast artifacts. Both documents are
// derived purely from forecast.json so re-rendering never needs another LLM
// call and tests stay clock-free. Rendering strings come from per-language
// label packs so each supported language renders natively.

interface BranchSectionLabels {
  readonly premise: string;
  readonly beats: string;
  readonly decisions: string;
  readonly changes: string;
  readonly characters: string;
  readonly relationships: string;
  readonly world: string;
  readonly hooks: string;
  readonly risks: string;
  readonly uncertainties: string;
  readonly alignment: string;
  readonly chapterPrefix: (n: number) => string;
  readonly none: string;
}

const BRANCH_LABELS: Record<Language, BranchSectionLabels> = {
  zh: {
    premise: "前提与假设",
    beats: "未来章节节拍",
    decisions: "人物决策",
    changes: "预计变化",
    characters: "人物",
    relationships: "关系",
    world: "世界",
    hooks: "伏笔",
    risks: "一致性风险",
    uncertainties: "不确定性",
    alignment: "作者意图匹配度",
    chapterPrefix: (n) => `第 ${n} 章`,
    none: "（无）",
  },
  en: {
    premise: "Premise and assumptions",
    beats: "Future chapter beats",
    decisions: "Character decisions",
    changes: "Projected changes",
    characters: "Characters",
    relationships: "Relationships",
    world: "World",
    hooks: "Hooks",
    risks: "Consistency risks",
    uncertainties: "Uncertainties",
    alignment: "Author intent alignment",
    chapterPrefix: (n) => `Chapter ${n}`,
    none: "(none)",
  },
  ko: {
    premise: "전제와 가정",
    beats: "미래 장 개요",
    decisions: "인물 결정",
    changes: "예상 변화",
    characters: "인물",
    relationships: "관계",
    world: "세계",
    hooks: "복선",
    risks: "정합성 위험",
    uncertainties: "불확실 요소",
    alignment: "작가 의도 부합도",
    chapterPrefix: (n) => `제 ${n}장`,
    none: "(없음)",
  },
};

export function renderForecastComparisonMarkdown(forecast: NarrativeForecast): string {
  const language = forecast.language;
  const header = language === "zh"
    ? [
        `# 叙事推演对比：${forecast.divergence}`,
        "",
        `- 推演 ID：${forecast.forecastId}`,
        `- 书籍：${forecast.bookId}`,
        `- 基准章节：第 ${forecast.baseChapter} 章`,
        `- 推演跨度：约 ${forecast.horizon} 章`,
        `- 生成时间：${forecast.createdAt}`,
        "",
        "> 本文件是非正史规划材料，不会改动正文或权威状态。",
      ]
    : language === "ko"
      ? [
          `# 서사 전개 비교: ${forecast.divergence}`,
          "",
          `- 전개 ID: ${forecast.forecastId}`,
          `- 작품: ${forecast.bookId}`,
          `- 기준 장: 제 ${forecast.baseChapter}장`,
          `- 전개 폭: 약 ${forecast.horizon}장`,
          `- 생성 시각: ${forecast.createdAt}`,
          "",
          "> 이 문서는 비정사 기획 자료로, 본문이나 공식 상태를 변경하지 않습니다.",
        ]
      : [
          `# Narrative forecast comparison: ${forecast.divergence}`,
          "",
          `- Forecast id: ${forecast.forecastId}`,
          `- Book: ${forecast.bookId}`,
          `- Base chapter: ${forecast.baseChapter}`,
          `- Horizon: ~${forecast.horizon} chapters`,
          `- Created at: ${forecast.createdAt}`,
          "",
          "> Non-canonical planning material. Nothing here modifies prose or authoritative state.",
        ];

  const tableHeader = language === "zh"
    ? ["| 分支 | 标题 | 风险数 | 前提 |", "| --- | --- | --- | --- |"]
    : language === "ko"
      ? ["| 분기 | 제목 | 위험 수 | 전제 |", "| --- | --- | --- | --- |"]
      : ["| Branch | Title | Risks | Premise |", "| --- | --- | --- | --- |"];
  const tableRows = forecast.branches.map((branch) =>
    `| ${branch.branchId} | ${escapeCell(branch.title)} | ${branch.risks.length} | ${escapeCell(branch.premise)} |`);

  const sections = forecast.branches.map((branch) => renderBranchSection(branch, language));

  return [...header, "", ...tableHeader, ...tableRows, "", sections.join("\n\n")].join("\n");
}

export function renderSelectedBranchPlanMarkdown(input: {
  readonly forecast: NarrativeForecast;
  readonly branch: ForecastBranch;
  readonly selectedAt: string;
  readonly stale: boolean;
}): string {
  const { forecast, branch } = input;
  const language = forecast.language;

  const staleWarning = input.stale
    ? (language === "zh"
        ? "> ⚠️ 该推演已过期：正史章节或状态在推演生成后发生了变化。以下计划基于旧上下文，采用前请重新核对，必要时重新生成推演。"
        : language === "ko"
          ? "> ⚠️ 이 전개는 만료되었습니다. 전개가 만들어진 뒤 정사 장이나 상태가 바뀌었습니다. 아래 계획은 오래된 컨텍스트에 근거하므로 적용 전에 다시 확인하고, 필요하면 전개를 새로 만듭니다."
          : "> ⚠️ This forecast is stale: canonical chapters or state changed after it was generated. The plan below is based on outdated context — re-check before applying, and regenerate if needed.")
    : "";

  const header = language === "zh"
    ? [
        `# 已选分支计划：${branch.title}`,
        "",
        `- 推演 ID：${forecast.forecastId}`,
        `- 分支：${branch.branchId}`,
        `- 分歧点：${forecast.divergence}`,
        `- 基准章节：第 ${forecast.baseChapter} 章`,
        `- 选择时间：${input.selectedAt}`,
      ]
    : language === "ko"
      ? [
          `# 선택된 분기 계획: ${branch.title}`,
          "",
          `- 전개 ID: ${forecast.forecastId}`,
          `- 분기: ${branch.branchId}`,
          `- 분기점: ${forecast.divergence}`,
          `- 기준 장: 제 ${forecast.baseChapter}장`,
          `- 선택 시각: ${input.selectedAt}`,
        ]
      : [
          `# Selected branch plan: ${branch.title}`,
          "",
          `- Forecast id: ${forecast.forecastId}`,
          `- Branch: ${branch.branchId}`,
          `- Divergence: ${forecast.divergence}`,
          `- Base chapter: ${forecast.baseChapter}`,
          `- Selected at: ${input.selectedAt}`,
        ];

  const footer = language === "zh"
    ? "> 本计划不修改正史。要把它应用到大纲、章节意图或权威状态，需要另行确认的操作（v1 不自动执行）。"
    : language === "ko"
      ? "> 이 계획은 정사를 바꾸지 않습니다. 개요, 장 의도, 공식 상태에 적용하려면 별도의 확인 절차가 필요하며 v1에서는 자동으로 실행하지 않습니다."
      : "> This plan does not modify canon. Applying it to the outline, chapter intents, or authoritative state is a separate, explicitly confirmed operation (not automated in v1).";

  return [
    ...header,
    ...(staleWarning ? ["", staleWarning] : []),
    "",
    renderBranchSection(branch, language, { headingLevel: 2, includeBranchId: false }),
    "",
    footer,
  ].join("\n");
}

function renderBranchSection(
  branch: ForecastBranch,
  language: Language,
  options: { readonly headingLevel?: number; readonly includeBranchId?: boolean } = {},
): string {
  const level = "#".repeat(options.headingLevel ?? 2);
  const sub = `${level}#`;
  const heading = options.includeBranchId === false
    ? `${level} ${branch.title}`
    : `${level} ${branch.branchId}：${branch.title}`;

  const labels = BRANCH_LABELS[language];

  const list = (items: ReadonlyArray<string>): string =>
    items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : labels.none;

  const joiner = "；";
  const pairSeparator = language === "ko" ? ": " : "：";
  return [
    heading,
    "",
    `${sub} ${labels.premise}`,
    "",
    branch.premise,
    "",
    `${sub} ${labels.beats}`,
    "",
    list(branch.beats.map((beat) => `${labels.chapterPrefix(beat.chapter)}${pairSeparator}${beat.summary}`)),
    "",
    `${sub} ${labels.decisions}`,
    "",
    list(branch.characterDecisions.map((decision) => `${decision.character}${pairSeparator}${decision.decision}`)),
    "",
    `${sub} ${labels.changes}`,
    "",
    `- ${labels.characters}${pairSeparator}${joinOrNone(branch.projectedChanges.characters, labels.none, joiner)}`,
    `- ${labels.relationships}${pairSeparator}${joinOrNone(branch.projectedChanges.relationships, labels.none, joiner)}`,
    `- ${labels.world}${pairSeparator}${joinOrNone(branch.projectedChanges.world, labels.none, joiner)}`,
    `- ${labels.hooks}${pairSeparator}${joinOrNone(language === "ko" ? branch.projectedChanges.hooks.map(hook => hook.replace(/\bresolved\b/g, "회수 완료")) : branch.projectedChanges.hooks, labels.none, joiner)}`,
    "",
    `${sub} ${labels.risks}`,
    "",
    list(branch.risks.map((risk) => `[${language === "ko" ? koreanRiskLabel(risk.kind) : risk.kind}] ${risk.description}`)),
    "",
    `${sub} ${labels.uncertainties}`,
    "",
    list([...branch.uncertainties]),
    "",
    `${sub} ${labels.alignment}`,
    "",
    branch.intentRationale,
  ].join("\n");
}

function joinOrNone(items: ReadonlyArray<string>, none: string, joiner: string): string {
  return items.length > 0 ? items.join(joiner) : none;
}

function koreanRiskLabel(kind: string): string {
  const labels: Record<string, string> = { pacing: "전개 속도", causality: "인과관계", timeline: "시간 순서", character: "인물", continuity: "연속성", world: "세계 설정", hook: "복선", logic: "논리", relationship: "관계" };
  const normalized = kind.trim().toLowerCase().replace(/[- ]/g, "_").replace(/_risk$/, "");
  const variants: Record<string, string> = { information_density: "정보 밀도", progression_deviation: "전개 이탈", character_focus: "인물 비중", causal: "인과관계", plot_progression: "사건 전개" };
  return labels[normalized] ?? variants[normalized] ?? `기타 위험(${kind})`;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
