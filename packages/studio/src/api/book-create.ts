import { PlatformSchema, defaultChapterLength, type Platform } from "@actalk/inkos-core";
import { normalizeWorkLanguage, type WorkLanguage } from "./language.js";
export { waitForStudioBookReady } from "../lib/book-ready.js";
export type { StudioBookDetail, WaitForStudioBookReadyOptions } from "../lib/book-ready.js";

export interface StudioCreateBookBody {
  readonly title: string;
  readonly genre: string;
  readonly language?: string;
  readonly platform?: string;
  readonly chapterWordCount?: number;
  readonly minChapterLength?: number;
  readonly maxChapterLength?: number;
  readonly targetChapters?: number;
  readonly blurb?: string;
}

export interface StudioBookConfigDraft {
  readonly id: string;
  readonly title: string;
  readonly platform: Platform;
  readonly genre: string;
  readonly status: "outlining";
  readonly targetChapters: number;
  readonly chapterWordCount: number;
  readonly minChapterLength?: number;
  readonly maxChapterLength?: number;
  readonly language: WorkLanguage;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function normalizeStudioPlatform(platform?: string): Platform {
  return platform === undefined ? "other" : PlatformSchema.parse(platform);
}

export function buildStudioBookConfig(body: StudioCreateBookBody, now: string): StudioBookConfigDraft {
  const language = normalizeWorkLanguage(body.language);
  return {
    id: body.title
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 30),
    title: body.title,
    platform: normalizeStudioPlatform(body.platform),
    genre: body.genre,
    status: "outlining",
    targetChapters: body.targetChapters ?? 200,
    chapterWordCount: body.chapterWordCount ?? defaultChapterLength(language),
    ...(body.minChapterLength!==undefined?{minChapterLength:body.minChapterLength}:{}),
    ...(body.maxChapterLength!==undefined?{maxChapterLength:body.maxChapterLength}:{}),
    language,
    createdAt: now,
    updatedAt: now,
  };
}
