import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { readCharacterContext, readStoryFrame, readVolumeMap } from "../utils/outline-paths.js";
import { loadRuntimeStateSnapshot } from "../state/runtime-state-store.js";
import { renderChapterSummariesProjection, renderCurrentStateProjection, renderHooksProjection } from "../state/state-projections.js";
import { BookConfigSchema } from "../models/book.js";
import { resolveDurableStoryProgress } from "../state/state-bootstrap.js";
import type { Language } from "../models/language.js";

// Read-only view of the canonical book used as forecast input. Everything in
// here MUST stay side-effect free: building a forecast context never creates
// or repairs canonical files (that is why StateManager.loadControlDocuments,
// which seeds defaults, is deliberately not used).

export interface ForecastContextSections {
  readonly authorIntent: string;
  readonly currentFocus: string;
  readonly currentState: string;
  readonly pendingHooks: string;
  readonly storyFrame: string;
  readonly volumeMap: string;
  readonly recentChapterSummaries: string;
  readonly characterContext: string;
}

export interface ForecastContext {
  readonly bookId: string;
  readonly bookTitle: string;
  readonly language: Language;
  readonly baseChapter: number;
  readonly contextFingerprint: string;
  readonly sections: ForecastContextSections;
}

export async function buildForecastContext(params: {
  readonly bookDir: string;
  readonly bookId: string;
}): Promise<ForecastContext> {
  const { bookDir, bookId } = params;
  const storyDir = join(bookDir, "story");

  const [bookConfig, baseChapter, fingerprintFiles] = await Promise.all([
    readBookConfig(bookDir),
    resolveBaseChapter(bookDir),
    collectFingerprintFiles(bookDir),
  ]);

  const [authorIntent, currentFocus, runtimeSnapshot] = await Promise.all([
    readOrEmpty(join(storyDir, "author_intent.md")),
    readOrEmpty(join(storyDir, "current_focus.md")),
    loadRuntimeStateSnapshot(bookDir),
  ]);
  if (runtimeSnapshot.manifest.lastAppliedChapter !== baseChapter) {
    throw new Error(
      `Forecast context is inconsistent: chapter index is at ${baseChapter}, runtime state is at ${runtimeSnapshot.manifest.lastAppliedChapter}.`,
    );
  }

  const [storyFrame, volumeMap, characterContext] = await Promise.all([
    readStoryFrame(bookDir),
    readVolumeMap(bookDir),
    readCharacterContext(bookDir),
  ]);
  const currentState = renderCurrentStateProjection(runtimeSnapshot.currentState, bookConfig.language);
  const pendingHooks = renderHooksProjection(runtimeSnapshot.hooks, bookConfig.language);
  const chapterSummariesRaw = renderChapterSummariesProjection(runtimeSnapshot.chapterSummaries, bookConfig.language);

  const contextFingerprint = computeContextFingerprint({
    baseChapter,
    files: fingerprintFiles,
  });

  return {
    bookId,
    bookTitle: bookConfig.title || bookId,
    language: bookConfig.language,
    baseChapter,
    contextFingerprint,
    sections: {
      authorIntent,
      currentFocus,
      currentState,
      pendingHooks,
      storyFrame,
      volumeMap,
      recentChapterSummaries: chapterSummariesRaw.trim()
        ? chapterSummariesRaw.trim()
        : "",
      characterContext,
    },
  };
}

/**
 * Content hash over the canonical forecast inputs (chapter count + every file
 * this builder feeds into the prompt). Deliberately mtime-free and
 * order-independent so copies, checkouts and CI runs produce identical
 * fingerprints for identical canon.
 */
export function computeContextFingerprint(input: {
  readonly baseChapter: number;
  readonly files: ReadonlyArray<readonly [string, string]>;
}): string {
  const canonical = JSON.stringify({
    baseChapter: input.baseChapter,
    files: [...input.files].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

// Every fixed-path file buildForecastContext reads into the prompt. story/runtime/** —
// where forecasts themselves live — is deliberately NOT part of this list,
// so a forecast can never invalidate itself.
const FINGERPRINT_FIXED_INPUTS: ReadonlyArray<string> = [
  "book.json",
  "story/author_intent.md",
  "story/current_focus.md",
  "story/outline/story_frame.md",
  "story/outline/volume_map.md",
];

// Same tier directories readRoleCards enumerates.
const FINGERPRINT_ROLE_DIRS: ReadonlyArray<string> = ["主要角色", "次要角色", "major", "minor"];

/**
 * Enumerate every context input as [relative posix path, content] pairs.
 * A missing file contributes no entry while an existing empty file
 * contributes ["path", ""], so creating, deleting or renaming an input file
 * always changes the fingerprint — not only editing its content.
 */
async function collectFingerprintFiles(
  bookDir: string,
): Promise<ReadonlyArray<readonly [string, string]>> {
  const [fixedEntries, stateFiles, roleEntryGroups] = await Promise.all([
    Promise.all(FINGERPRINT_FIXED_INPUTS.map(async (relPath) => {
      const content = await readIfExists(join(bookDir, relPath));
      return content === null ? null : ([relPath, content] as const);
    })),
    readStateFiles(bookDir),
    Promise.all(FINGERPRINT_ROLE_DIRS.map(async (tier) => {
      const dir = join(bookDir, "story", "roles", tier);
      let names: string[];
      try {
        names = (await readdir(dir)).filter((name) => name.endsWith(".md"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw error;
      }
      return Promise.all(names.map(async (name) =>
        [`story/roles/${tier}/${name}`, await readOrEmpty(join(dir, name))] as const));
    })),
  ]);

  return [
    ...fixedEntries.filter((entry): entry is readonly [string, string] => entry !== null),
    ...stateFiles.map(({ name, content }) => [`story/state/${name}`, content] as const),
    ...roleEntryGroups.flat(),
  ];
}

/** Read a file's content, or null when it does not exist. */
async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export function renderForecastContextMarkdown(context: ForecastContext): string {
  const language = context.language;
  const headings = language === "zh"
    ? {
        authorIntent: "作者意图",
        currentFocus: "当前聚焦",
        currentState: "当前状态",
        pendingHooks: "伏笔与钩子",
        storyFrame: "故事框架",
        volumeMap: "卷映射",
        recentChapterSummaries: "近期章节摘要",
        characterContext: "人物与关系",
        title: `# 正史上下文（《${context.bookTitle}》，已完成至第 ${context.baseChapter} 章）`,
      }
    : language === "ko"
      ? {
          authorIntent: "작가 의도",
          currentFocus: "현재 초점",
          currentState: "현재 상태",
          pendingHooks: "미해결 복선",
          storyFrame: "이야기 뼈대",
          volumeMap: "권 구성표",
          recentChapterSummaries: "최근 장 요약",
          characterContext: "인물과 관계",
          title: `# 정사 컨텍스트(『${context.bookTitle}』, 제 ${context.baseChapter}장까지 집필 완료)`,
        }
      : {
          authorIntent: "Author intent",
          currentFocus: "Current focus",
          currentState: "Current state",
          pendingHooks: "Pending hooks",
          storyFrame: "Story frame",
          volumeMap: "Volume map",
          recentChapterSummaries: "Recent chapter summaries",
          characterContext: "Characters and relationships",
          title: `# Canonical context ("${context.bookTitle}", written through chapter ${context.baseChapter})`,
        };
  const sectionList: ReadonlyArray<readonly [string, string]> = [
    [headings.authorIntent, context.sections.authorIntent],
    [headings.currentFocus, context.sections.currentFocus],
    [headings.currentState, context.sections.currentState],
    [headings.pendingHooks, context.sections.pendingHooks],
    [headings.storyFrame, context.sections.storyFrame],
    [headings.volumeMap, context.sections.volumeMap],
    [headings.recentChapterSummaries, context.sections.recentChapterSummaries],
    [headings.characterContext, context.sections.characterContext],
  ];

  const blocks = [
    headings.title,
    ...sectionList
      .filter(([, content]) => content.trim())
      .map(([heading, content]) => `## ${heading}\n\n${content.trim()}`),
  ];
  return blocks.join("\n\n");
}

async function readBookConfig(bookDir: string): Promise<{ readonly title: string; readonly language: Language }> {
  const raw = await readFile(join(bookDir, "book.json"), "utf-8");
  const parsed = BookConfigSchema.parse(JSON.parse(raw));
  return { title: parsed.title, language: parsed.language ?? "zh" };
}

/**
 * Highest chapter number present on disk. Forecasts key their staleness on
 * this value: a new canonical chapter invalidates old forecasts.
 */
async function resolveBaseChapter(bookDir: string): Promise<number> {
  return resolveDurableStoryProgress({ bookDir });
}

async function readStateFiles(bookDir: string): Promise<ReadonlyArray<{ readonly name: string; readonly content: string }>> {
  const stateDir = join(bookDir, "story", "state");
  let names: string[];
  try {
    names = (await readdir(stateDir)).filter((name) => name.endsWith(".json")).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return Promise.all(names.map(async (name) => ({
    name,
    content: await readOrEmpty(join(stateDir, name)),
  })));
}

async function readOrEmpty(path: string): Promise<string> {
  try {
    return await readFile(path, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}
