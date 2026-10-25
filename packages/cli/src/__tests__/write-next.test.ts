import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PipelineRunner, StateManager } from "@actalk/inkos-core";

const mocks = vi.hoisted(() => ({ root: "", log: vi.fn() }));

vi.mock("../utils.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../utils.js")>(),
  findProjectRoot: () => mocks.root,
  loadConfig: async () => ({}),
  buildPipelineConfig: () => ({ projectRoot: mocks.root, client: {}, model: "fixture" }),
  log: mocks.log,
}));

describe("write next capability dispatch", () => {
  let state: StateManager;

  beforeEach(async () => {
    mocks.log.mockReset();
    mocks.root = await mkdtemp(join(tmpdir(), "inkos-write-next-"));
    state = new StateManager(mocks.root);
    const now = "2026-01-01T00:00:00.000Z";
    await state.saveBookConfig("novel", {
      id: "novel", title: "Novel", genre: "other", platform: "other", language: "ko",
      status: "active", targetChapters: 10, chapterWordCount: 600,
      createdAt: now, updatedAt: now,
    });
    await state.saveChapterIndex("novel", []);
    await writeFile(join(mocks.root, "brief.md"), "Continue the departure.");
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(mocks.root, { recursive: true, force: true });
  });

  // Keep the Commander action, real capability schema decode, tool, book lock,
  // and writeChapters range validation. Replace only the generation boundary.
  function generationBoundary() {
    return vi.spyOn(PipelineRunner.prototype as unknown as {
      _writeNextChapterLocked(bookId: string, words?: number, temperature?: number, context?: string): Promise<unknown>;
    }, "_writeNextChapterLocked").mockImplementation(async (bookId) => ({
      chapterNumber: await state.getNextChapterNumber(bookId), title: "Departure", wordCount: 600,
      review: { observations: [] },
    }));
  }

  async function run(count = "1") {
    const { writeCommand } = await import("../commands/write.js");
    try {
      await writeCommand.parseAsync([
        "next", "novel", "--count", count, "--words", "600",
        "--context-file", join(mocks.root, "brief.md"), "--json",
      ], { from: "user" });
    } catch (error) {
      throw new Error(`${error}: ${mocks.log.mock.calls.at(-1)?.[0]}`);
    }
    return JSON.parse(mocks.log.mock.calls.at(-1)![0]);
  }

  it.each([0, 1])("appends after %i durable chapters through the real schema", async (completed) => {
    if (completed) {
      await state.saveChapterIndex("novel", [{
        number: 1, title: "Arrival", wordCount: 600, provenance: "generated", observations: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }]);
      await writeFile(join(state.bookDir("novel"), "chapters", "0001_Arrival.md"), "Arrival.");
    }
    const generate = generationBoundary();
    const result = await run();
    expect(result).toMatchObject([{ chapterNumber: completed + 1, wordCount: 600 }]);
    expect(generate).toHaveBeenCalledExactlyOnceWith("novel", 600, undefined, "Continue the departure.");
  });

  it("rejects inconsistent durable progress before generation", async () => {
    await writeFile(join(state.bookDir("novel"), "chapters", "0002_Orphan.md"), "Orphan.");
    const generate = generationBoundary();
    vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("exit"); });
    await expect(run()).rejects.toThrow("exit");
    expect(JSON.parse(mocks.log.mock.calls.at(-1)![0]).error).toContain("Chapter index/files disagree");
    expect(generate).not.toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("rejects an invalid chapter count at the real schema boundary before generation", async () => {
    const generate = generationBoundary();
    vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("exit"); });
    await expect(run("0")).rejects.toThrow("exit");
    expect(JSON.parse(mocks.log.mock.calls.at(-1)![0])).toHaveProperty("error");
    expect(generate).not.toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
