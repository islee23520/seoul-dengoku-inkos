import { Command } from "commander";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { log, logError } from "../utils.js";
import { initializeProjectDirectory } from "../project-bootstrap.js";
import { LanguageSchema } from "../writing-language.js";

export const initCommand = new Command("init")
  .description("Initialize an InkOS project (current directory by default)")
  .argument("[name]", "Project name (creates subdirectory). Omit to init current directory.")
  .option("--lang <language>", "Default writing language (zh, en, ko)", "zh")
  .action(async (name: string | undefined, opts: { lang?: string }) => {
    const projectDir = name ? resolve(process.cwd(), name) : process.cwd();

    try {
      await mkdir(projectDir, { recursive: true });

      const rawLang = opts.lang ?? "zh";
      const parsed = LanguageSchema.safeParse(rawLang);
      if (!parsed.success) {
        throw new Error(`Invalid --lang value: ${rawLang}. Must be one of: ${LanguageSchema.options.join(", ")}`);
      }
      const language = parsed.data;

      await initializeProjectDirectory(projectDir, {
        language,
        overwriteSupportFiles: true,
      });

      log(language === "ko" ? `프로젝트 초기화 완료: ${projectDir}` : `Project initialized at ${projectDir}`);
      log("");
      const isEnglish = (opts.lang ?? "zh") === "en";
      const exampleCreateLines = language === "ko"
        ? ["  inkos book create --title '나의 소설' --genre other --platform other --lang ko"]
        : isEnglish
        ? ["  inkos book create --title 'My Novel' --genre progression --platform royalroad --lang en"]
        : [
          "  inkos book create --title '我的小说' --genre xuanhuan --platform tomato",
          "  # English project? Re-run with: inkos init --lang en",
        ];
      if (global) {
        log(language === "ko" ? "전역 모델 설정을 찾았습니다. 사용할 준비가 되었습니다." : "Global LLM config detected. Ready to go!");
        log("");
        log(language === "ko" ? "다음 단계:" : "Next steps:");
        if (name) log(`  cd ${name}`);
        for (const line of exampleCreateLines) log(line);
      } else {
        log(language === "ko" ? "다음 단계:" : "Next steps:");
        if (name) log(`  cd ${name}`);
        log(language === "ko" ? "  # 방법 1: 전역 설정 (권장, 최초 한 번):" : "  # Option 1: Set global config (recommended, one-time):");
        log("  inkos config set-global --provider openai --base-url <your-api-url> --api-key <your-key> --model <your-model>");
        log(language === "ko" ? "  # 방법 2: 이 프로젝트의 .env 수정" : "  # Option 2: Edit .env for this project only");
        log("");
        for (const line of exampleCreateLines) log(line);
      }
      log("  inkos write next <book-id>");
    } catch (e) {
      logError(`Failed to initialize project: ${e}`);
      process.exit(1);
    }
  });
