import { Command } from "commander";
import { StateManager, formatLengthCount, resolveLengthCountingMode } from "@actalk/inkos-core";
import { loadConfig, findProjectRoot, log, logError } from "../utils.js";

export const statusCommand = new Command("status")
  .description("Show project status")
  .argument("[book-id]", "Book ID (optional, shows all if omitted)")
  .option("--chapters", "Show per-chapter status and observations")
  .option("--json", "Output JSON")
  .action(async (bookIdArg: string | undefined, opts) => {
    try {
      const root = findProjectRoot();
      const state = new StateManager(root);

      const allBookIds = await state.listBooks();
      const bookIds = bookIdArg ? [bookIdArg] : allBookIds;

      if (bookIdArg && !allBookIds.includes(bookIdArg)) {
        throw new Error(
          `Book "${bookIdArg}" not found. Available: ${allBookIds.join(", ") || "(none)"}`,
        );
      }

      const booksData = [];

      if (!opts.json) {
        const config = await loadConfig({ requireApiKey: false });
        log(config.language === "ko" ? `InkOS 프로젝트: ${root}` : `InkOS Project: ${root}`);
        log(config.language === "ko" ? `작품 수: ${allBookIds.length}` : `Books: ${allBookIds.length}`);
        log("");
      }

      for (const id of bookIds) {
        const book = await state.loadBookConfig(id);
        const index = await state.loadChapterIndex(id);
        const persistedChapterCount = await state.getPersistedChapterCount(id);
        const countingMode = resolveLengthCountingMode(book.language);

        const observationCount = index.reduce((sum, chapter) => sum + chapter.observations.length, 0);
        const chaptersWithObservations = index.filter((chapter) => chapter.observations.length > 0).length;
        const totalWords = index.reduce((sum, ch) => sum + ch.wordCount, 0);
        const avgWords = index.length > 0 ? Math.round(totalWords / index.length) : 0;

        booksData.push({
          id,
          title: book.title,
          status: book.status,
          genre: book.genre,
          platform: book.platform,
          chapters: index.length,
          chapterFiles: persistedChapterCount,
          targetChapters: book.targetChapters,
          totalWords,
          avgWordsPerChapter: avgWords,
          observationCount,
          chaptersWithObservations,
          ...(opts.chapters ? {
            chapterList: index.map((ch) => ({
              number: ch.number,
              title: ch.title,
              wordCount: ch.wordCount,
              provenance: ch.provenance,
              observations: ch.observations,
            })),
          } : {}),
        });

        if (!opts.json) {
          log(`  ${book.title} (${id})`);
          const ko = book.language === "ko";
          const statusLabels: Record<string, string> = { outlining: "개요 작성 중", active: "집필 중", paused: "일시 중지", completed: "완료" };
          log(ko ? `    상태: ${statusLabels[book.status]}` : `    Status: ${book.status}`);
          log(ko ? `    플랫폼: ${book.platform} | 장르: ${book.genre}` : `    Platform: ${book.platform} | Genre: ${book.genre}`);
          log(ko ? `    장 수: ${index.length} / ${book.targetChapters}` : `    Chapters: ${index.length} / ${book.targetChapters}`);
          if (persistedChapterCount !== index.length) log(`    Chapter files: ${persistedChapterCount}; the file count differs from the chapter index.`);
          log(ko ? `    분량: ${totalWords.toLocaleString()}자 (장당 평균 ${avgWords}자)` : `    Words: ${totalWords.toLocaleString()} (avg ${avgWords}/ch)`);
          log(ko ? `    검토 소견: ${chaptersWithObservations}개 장에서 ${observationCount}개` : `    Review observations: ${observationCount} across ${chaptersWithObservations} chapter(s)`);

          if (opts.chapters && index.length > 0) {
            log("");
            for (const ch of index) {
              const icon = ch.observations.length > 0 ? "!" : "+";
              log(`    [${icon}] Ch.${ch.number} "${ch.title}" | ${formatLengthCount(ch.wordCount, countingMode, book.language)} | ${ch.provenance}`);
              for (const observation of ch.observations) {
                log(`        ${observation.code}: ${observation.summary}`);
              }
            }
          }
          log("");
        }
      }

      if (opts.json) {
        log(JSON.stringify({ project: root, books: booksData }, null, 2));
      }
    } catch (e) {
      if (opts.json) {
        log(JSON.stringify({ error: String(e) }));
      } else {
        logError(`Failed to get status: ${e}`);
      }
      process.exit(1);
    }
  });
