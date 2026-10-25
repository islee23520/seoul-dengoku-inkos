import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { PipelineRunner, StateManager } from "@actalk/inkos-core";
const mocks = vi.hoisted(() => ({ root: "", log: vi.fn() }));
vi.mock("../utils.js", async (original) => ({
  ...await original<typeof import("../utils.js")>(),
  findProjectRoot: () => mocks.root,
  loadConfig: async () => ({ language: "ko" }),
  buildPipelineConfig: () => ({ projectRoot: mocks.root, client: {}, model: "fixture" }),
  log: mocks.log,
}));
afterEach(async () => { vi.restoreAllMocks(); await rm(mocks.root, { recursive: true, force: true }); });
it.each(["한국어 제목", "!!!", "English Title"])("prints the persisted id for %s", async (title) => {
  mocks.root = await mkdtemp(join(tmpdir(), "inkos-book-id-"));
  mocks.log.mockReset();
  const state = new StateManager(mocks.root);
  vi.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValue(2000);
  vi.spyOn(PipelineRunner.prototype, "initBook").mockImplementation(async book => { await state.saveBookConfig(book.id, book); });
  const { bookCommand } = await import("../commands/book.js");
  await bookCommand.parseAsync(["create", "--title", title, "--lang", "ko", "--json"], { from: "user" });
  const result = JSON.parse(mocks.log.mock.calls.at(-1)![0]);
  expect((await state.loadBookConfig(result.bookId)).id).toBe(result.bookId);
  expect(result.nextStep).toBe("inkos write next " + result.bookId);
});

