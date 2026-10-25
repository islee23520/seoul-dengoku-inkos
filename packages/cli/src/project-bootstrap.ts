import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { BookConfig } from "@actalk/inkos-core";
import { GLOBAL_ENV_PATH } from "./utils.js";

export interface ProjectBootstrapOptions {
  readonly language?: BookConfig["language"];
  readonly overwriteSupportFiles?: boolean;
}

async function hasGlobalConfig(): Promise<boolean> {
  try {
    const content = await readFile(GLOBAL_ENV_PATH, "utf-8");
    return content.includes("INKOS_LLM_API_KEY=") && !content.includes("your-api-key-here");
  } catch {
    return false;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function writeMaybe(path: string, content: string, overwrite: boolean): Promise<void> {
  if (!overwrite && await exists(path)) {
    return;
  }
  await writeFile(path, content, "utf-8");
}

const DEFAULT_GITIGNORE_ENTRIES = [".env", "node_modules/", ".DS_Store"] as const;

export async function ensureProjectGitignore(projectDir: string): Promise<void> {
  const path = join(projectDir, ".gitignore");
  let existing = "";
  if (await exists(path)) {
    existing = await readFile(path, "utf-8");
  }

  const existingEntries = new Set(
    existing
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#")),
  );
  const missing = DEFAULT_GITIGNORE_ENTRIES.filter((entry) => !existingEntries.has(entry));
  if (missing.length === 0) return;

  if (!existing) {
    await writeFile(path, `${missing.join("\n")}\n`, "utf-8");
    return;
  }

  const separator = existing.endsWith("\n") ? "" : "\n";
  await writeFile(path, `${existing}${separator}${missing.join("\n")}\n`, "utf-8");
}

function buildProjectConfig(projectDir: string, language: BookConfig["language"]) {
  return {
    name: basename(projectDir),
    version: "0.1.0" as const,
    language,
    llm: {
      provider: "openai" as const,
      service: "custom",
      configSource: "studio" as const,
      baseUrl: "",
      model: "",
      apiFormat: "chat" as const,
      stream: true,
    },
    notify: [],
    daemon: {
      schedule: {
        radarCron: "0 */6 * * *",
        writeCron: "*/15 * * * *",
      },
      maxConcurrentBooks: 3,
    },
  };
}

function buildProjectEnvTemplate(globalConfigured: boolean, language: BookConfig["language"]): string {
  if (language === "ko") return [
    "# 프로젝트별 모델 설정 재정의 (선택)",
    globalConfigured ? "# 기본 설정은 ~/.inkos/.env에서 가져옵니다." : "# 이 파일을 수정하지 않아도 스튜디오에서 제공자, 모델, 키를 관리할 수 있습니다.",
    "# 프로젝트별 서비스를 사용하려면 스튜디오에서 스튜디오 설정 사용으로 전환하세요.",
    "# 이 프로젝트에서만 재정의하려면 아래 주석을 해제하세요:",
    "# INKOS_LLM_PROVIDER=openai", "# INKOS_LLM_BASE_URL=", "# INKOS_LLM_API_KEY=", "# INKOS_LLM_MODEL=",
    ...(!globalConfigured ? ["# INKOS_LLM_API_FORMAT=chat", "# INKOS_LLM_STREAM=true"] : []),
    "", "# 웹 검색 (선택):", "# TAVILY_API_KEY=tvly-xxxxx", "",
  ].join("\n");
  if (globalConfigured) {
    return [
      "# Project-level LLM overrides (optional)",
      "# Global config at ~/.inkos/.env will be used by default.",
      "# Switch Studio to 'Use Studio config' (使用 Studio 配置) if you want per-project service settings.",
      "# Uncomment below to override for this project only:",
      "# INKOS_LLM_PROVIDER=openai",
      "# INKOS_LLM_BASE_URL=",
      "# INKOS_LLM_API_KEY=",
      "# INKOS_LLM_MODEL=",
      "",
      "# Web search (optional):",
      "# TAVILY_API_KEY=tvly-xxxxx",
      "",
    ].join("\n");
  }

  return [
    "# Optional project-level LLM overrides",
    "# Studio can manage provider / model / key without editing this file.",
    "# Uncomment only if you want this directory to force env-based config:",
    "# INKOS_LLM_PROVIDER=openai",
    "# INKOS_LLM_BASE_URL=",
    "# INKOS_LLM_API_KEY=",
    "# INKOS_LLM_MODEL=",
    "# INKOS_LLM_API_FORMAT=chat",
    "# INKOS_LLM_STREAM=true",
    "",
    "# Web search (optional):",
    "# TAVILY_API_KEY=tvly-xxxxx",
    "",
  ].join("\n");
}

export async function initializeProjectDirectory(
  projectDir: string,
  options: ProjectBootstrapOptions = {},
): Promise<void> {
  const language = options.language ?? "zh";
  const overwriteSupportFiles = options.overwriteSupportFiles ?? true;
  const configPath = join(projectDir, "inkos.json");

  if (await exists(configPath)) {
    throw new Error(`inkos.json already exists in ${projectDir}. Use a different directory or delete the existing project.`);
  }

  await mkdir(projectDir, { recursive: true });
  await mkdir(join(projectDir, "works"), { recursive: true });
  await mkdir(join(projectDir, "radar"), { recursive: true });

  await writeFile(
    configPath,
    JSON.stringify(buildProjectConfig(projectDir, language), null, 2),
    "utf-8",
  );

  const globalConfigured = await hasGlobalConfig();

  await Promise.all([
    writeMaybe(join(projectDir, ".env"), buildProjectEnvTemplate(globalConfigured, language), overwriteSupportFiles),
    ensureProjectGitignore(projectDir),
    writeMaybe(join(projectDir, ".nvmrc"), "22\n", overwriteSupportFiles),
    writeMaybe(join(projectDir, ".node-version"), "22\n", overwriteSupportFiles),
  ]);
}

export async function ensureProjectDirectoryInitialized(
  projectDir: string,
  options: Omit<ProjectBootstrapOptions, "overwriteSupportFiles"> = {},
): Promise<boolean> {
  const configPath = join(projectDir, "inkos.json");
  if (await exists(configPath)) {
    return false;
  }

  await initializeProjectDirectory(projectDir, {
    language: options.language,
    overwriteSupportFiles: false,
  });
  return true;
}
