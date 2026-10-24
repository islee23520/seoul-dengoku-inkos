import type { BookConfig } from "../models/book.js";
import type { BookRules } from "../models/book-rules.js";
import type { LengthSpec } from "../models/length-governance.js";
import { buildLengthSpec } from "../utils/length-metrics.js";
import type { Language } from "../models/language.js";

/** Writer protocol. Narrative craft comes from the active long-writing Skill. */
export function buildWriterSystemPrompt(
  book: BookConfig,
  bookRules: BookRules | null,
  bookRulesBody: string,
  styleGuide: string,
  languageOverride?: Language,
  lengthSpec?: LengthSpec,
): string {
  const language = languageOverride ?? book.language;
  const resolvedLength = lengthSpec ?? buildLengthSpec(book.chapterWordCount, language);
  const sections = language === "en"
    ? [
        `Write one chapter for the active ${book.genre} Work on ${book.platform} using the activated professional Skills.`,
        governedContract("en"),
        lengthContract(resolvedLength, "en"),
        narrativePersonContract(bookRules, "en"),
        protagonistContract(bookRules, "en"),
        authorityBlock("Book rules", bookRulesBody),
        authorityBlock("Style guide", styleGuide),
      ]
    : language === "ko"
      ? [
          `활성화된 전문 Skill을 바탕으로 현재 ${book.genre} 작품의 한 장을 집필합니다. 플랫폼: ${book.platform}.`,
          governedContract("ko"),
          lengthContract(resolvedLength, "ko"),
          narrativePersonContract(bookRules, "ko"),
          protagonistContract(bookRules, "ko"),
          authorityBlock("작품 규칙", bookRulesBody),
          authorityBlock("문체 가이드", styleGuide),
        ]
      : [
        `按已激活的专业 Skill 为当前${book.genre}作品写一章。平台：${book.platform}。`,
        governedContract("zh"),
        lengthContract(resolvedLength, "zh"),
        narrativePersonContract(bookRules, "zh"),
        protagonistContract(bookRules, "zh"),
        authorityBlock("本书规则", bookRulesBody),
        authorityBlock("文风指南", styleGuide),
      ];
  return sections.filter(Boolean).join("\n\n");
}

function governedContract(language: Language): string {
  return language === "en"
    ? `## Authority
The current user instruction and chapter memo govern this chapter. Established facts, explicit prohibitions, selected context, and real hook ids remain binding. The outline is a fallback only when it does not conflict with higher authority. Satisfy every populated memo requirement in the prose; do not duplicate or rename an existing narrative promise.`
    : `## 权威顺序
当前用户指令和 chapter memo 决定本章任务；既成事实、显式禁令、已选上下文和真实 hook id 必须保留。卷纲仅在无冲突时作为兜底。이미 존재하는 서약에 hook을 중복으로 열거나 기존 서약의 이름을 바꾸지도 않습니다.`;
  if (language === "ko") return `## 지시 우선 순위
이번 장은 현재 사용자 지시와 chapter memo를 따릅니다. 확정된 사실, 명시적 금지 사항, 선별된 컨텍스트, 실제 존재하는 hook id는 반드시 유지합니다. 권 두 개요는 상위 지시와 충돌하지 않을 때만 참고합니다. memo에 기재된 요구 사항은 본문에서 모두 실현해야 하며, 같은 서약에 hook을 중복으로 열거나 기존 서약의 이름을 바꾸지 않습니다.`;
}

function lengthContract(spec: LengthSpec, language: Language): string {
  return language === "en"
    ? `## Length\nUser target: ${spec.target} words. Preserve scene completeness instead of padding or cutting mechanically.`
    : language === "ko"
      ? `## 분량\n사용자 목표: ${spec.target}자. 장면의 완결성을 지키고, 억지로 부풀리거나 기계적으로 자르지 않습니다.`
      : `## 字数\n用户目标：${spec.target} 字。保持场景完整，不要机械注水或裁切。`;
}

function narrativePersonContract(bookRules: BookRules | null, language: Language): string {
  const person = bookRules?.narrativePerson;
  if (!person) return "";
  if (language === "en") return `## Narrative person\n${person}; this durable constraint overrides model defaults.`;
  if (language === "ko") return `## 서술 인칭\n${person}; 이 지속 제약은 모델 기본값보다 우선합니다.`;
  return `## 叙事人称\n${person}；该持久约束优先于模型默认。`;
}

function protagonistContract(bookRules: BookRules | null, language: Language): string {
  const protagonist = bookRules?.protagonist;
  if (!protagonist) return "";
  const separator = language === "en" ? ", " : "、";
  const locks = protagonist.personalityLock.join(separator);
  const boundaries = protagonist.behavioralConstraints.join(language === "en" ? "; " : "；");
  const prohibitions = bookRules.prohibitions.join(language === "en" ? "; " : "；");
  if (language === "ko") {
    const koLocks = protagonist.personalityLock.join(", ");
    const koBoundaries = protagonist.behavioralConstraints.join("; ");
    const koProhibitions = bookRules.prohibitions.join("; ");
    return `## 주인공 권위\n이름: ${protagonist.name}\n성격 고정: ${koLocks || "(없음)"}\n행동 제약: ${koBoundaries || "(없음)"}\n작품 금기: ${koProhibitions || "(없음)"}`;
  }
  return language === "en"
    ? `## Protagonist authority\nName: ${protagonist.name}\nPersonality: ${locks || "(none)"}\nBehavioral constraints: ${boundaries || "(none)"}\nBook prohibitions: ${prohibitions || "(none)"}`
    : `## 主角权威\n名字：${protagonist.name}\n性格锁：${locks || "（无）"}\n行为约束：${boundaries || "（无）"}\n本书禁忌：${prohibitions || "（无）"}`;
}

function authorityBlock(title: string, body: string | undefined): string {
  const trimmed = body?.trim();
  if (!trimmed) return "";
  return `## ${title}\n${trimmed}`;
}
