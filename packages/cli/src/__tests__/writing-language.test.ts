import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StateManager, type BookConfig } from "@actalk/inkos-core";

const mocks = vi.hoisted(() => ({
  root: "",
  language: "ko",
  execute: vi.fn(),
  foundation: vi.fn(),
}));

vi.mock("../utils.js", () => ({
  findProjectRoot: () => mocks.root,
  loadConfig: async () => ({ language: mocks.language }),
  buildPipelineConfig: () => ({}),
  resolveCliProfileSkills: async () => [],
  resolveBookId: async (id: string) => id,
  GLOBAL_CONFIG_DIR: "/unused",
  GLOBAL_ENV_PATH: "/unused/.env",
  log: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@actalk/inkos-core", async (importOriginal) => ({
  ...await importOriginal<typeof import("@actalk/inkos-core")>(),
  PipelineRunner: class {},
  createBookFoundationTool: mocks.foundation,
  createFanficBookTool: vi.fn(),
  executeExplicitCapabilityTool: mocks.execute,
}));

describe("authored writing language", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.root = await mkdtemp(join(tmpdir(), "inkos-writing-language-"));
    mocks.language = "ko";
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(mocks.root, { recursive: true, force: true });
  });

  it.each([undefined, "zh", "en", "ko"])("passes %s book language to foundation creation without UI coercion", async (language) => {
    const { bookCommand } = await import("../commands/book.js");
    await bookCommand.parseAsync([
      "create", "--title", "Language Test", "--json",
      ...(language === undefined ? [] : ["--lang", language]),
    ], { from: "user" });

    const expected = language ?? "ko";
    expect(mocks.foundation.mock.calls[0]?.[1]).toMatchObject({
      language: expected,
      actionPayload: { createBook: { language: expected } },
    });
    expect(mocks.execute.mock.calls[0]?.[0].parameters.language).toBe(expected);
  });

  it.each([undefined, "ko"])("passes %s fanfic language without UI coercion", async (language) => {
    const source = join(mocks.root, "source.txt");
    await writeFile(source, "Source material", "utf-8");
    const { fanficCommand } = await import("../commands/fanfic.js");
    await fanficCommand.parseAsync([
      "init", "--title", "Fanfic Test", "--from", source, "--json",
      ...(language === undefined ? [] : ["--lang", language]),
    ], { from: "user" });
    expect(mocks.execute.mock.calls[0]?.[0].parameters.language).toBe("ko");
  });

  it("round-trips Korean book configuration through update", async () => {
    const state = new StateManager(mocks.root);
    const now = new Date().toISOString();
    const book: BookConfig = {
      id: "language-test", title: "Language Test", genre: "other", platform: "other",
      language: "en", status: "outlining", targetChapters: 10, chapterWordCount: 3000,
      createdAt: now, updatedAt: now,
    };
    await state.saveBookConfig(book.id, book);
    const { bookCommand } = await import("../commands/book.js");
    await bookCommand.parseAsync(["update", book.id, "--lang", "ko", "--json"], { from: "user" });
    expect((await state.loadBookConfig(book.id)).language).toBe("ko");
    const stored = JSON.parse(await readFile(join(state.bookDir(book.id), "book.json"), "utf-8"));
    expect(stored.language).toBe("ko");

    vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("exit"); });
    await expect(bookCommand.parseAsync([
      "update", book.id, "--lang", "invalid", "--json",
    ], { from: "user" })).rejects.toThrow("exit");
    expect(process.exit).toHaveBeenCalledWith(1);
    expect((await state.loadBookConfig(book.id)).language).toBe("ko");
  });

  it("rejects an invalid global default language before writing configuration", async () => {
    vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("exit"); });
    const { configCommand } = await import("../commands/config.js");
    await expect(configCommand.parseAsync([
      "set-global", "--provider", "openai", "--base-url", "https://example.invalid",
      "--api-key", "test-only", "--model", "test-model", "--lang", "invalid",
    ], { from: "user" })).rejects.toThrow("exit");
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it.each(["book", "fanfic"])("rejects invalid %s creation language before execution", async (kind) => {
    vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("exit"); });
    const source = join(mocks.root, "source.txt");
    await writeFile(source, "Source material", "utf-8");
    const command = kind === "book"
      ? (await import("../commands/book.js")).bookCommand
      : (await import("../commands/fanfic.js")).fanficCommand;
    const args = kind === "book" ? ["create"] : ["init", "--from", source];
    await expect(command.parseAsync([
      ...args, "--title", "Invalid Language", "--lang", "invalid", "--json",
    ], { from: "user" })).rejects.toThrow("exit");
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
