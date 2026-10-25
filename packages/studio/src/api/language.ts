import type { ProjectConfig } from "@actalk/inkos-core";

export type WorkLanguage = ProjectConfig["language"];
export type StudioLanguage = "zh" | "en";

// Studio copy is not yet localized in Korean. This fallback must never be used
// for authored work or agent language.
export function normalizeStudioLanguage(value: unknown): StudioLanguage {
  return value === "en" ? "en" : "zh";
}

export function normalizeWorkLanguage(value: unknown, fallback: WorkLanguage = "zh"): WorkLanguage {
  return value === "zh" || value === "en" || value === "ko" ? value : fallback;
}

export function resolveStudioAgentLanguage(
  projectLanguage: WorkLanguage,
  bookLanguage: string | undefined,
  requestedLanguage: WorkLanguage | undefined,
): WorkLanguage {
  return normalizeWorkLanguage(bookLanguage, requestedLanguage ?? projectLanguage);
}
