import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ root: "", log: vi.fn(), execute: vi.fn() }));

vi.mock("../utils.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../utils.js")>(),
  findProjectRoot: () => mocks.root,
  loadConfig: async () => ({ llm: {} }),
  buildPipelineConfig: () => ({ projectRoot: mocks.root, client: {}, model: "fixture" }),
  log: mocks.log,
}));

vi.mock("@actalk/inkos-core", async (importOriginal) => {
  const core = await importOriginal<typeof import("@actalk/inkos-core")>();
  return {
    ...core,
    createShortFictionRunTool: (...args: Parameters<typeof core.createShortFictionRunTool>) => ({
      ...core.createShortFictionRunTool(...args),
      // Keep the actual tool schema and explicit capability dispatch. Replace
      // only production execution so this regression never calls an LLM.
      execute: mocks.execute,
    }),
  };
});

const cliEntry = resolve(dirname(fileURLToPath(import.meta.url)), "../../dist/index.js");
const runChild = promisify(execFile);

describe("short run capability dispatch", () => {
  const initialExitCode = process.exitCode;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.root = await mkdtemp(join(tmpdir(), "inkos-short-cli-"));
    mocks.execute.mockResolvedValue({ content: [{ type: "text", text: "Complete" }], details: {} });
  });

  afterEach(async () => {
    process.exitCode = initialExitCode;
    vi.restoreAllMocks();
    await rm(mocks.root, { recursive: true, force: true });
  });

  it.each([undefined, "600"])("decodes the real schema with %s target length", async (chars) => {
    const { shortCommand } = await import("../commands/short-fiction.js");
    await shortCommand.parseAsync([
      "run", "--story-id", "ko-short-cpa-pilot", "--direction", "한국어 단편",
      "--lang", "ko", "--chapters", "1", "--no-cover", "--model", "fixture", "--json",
      ...(chars ? ["--chars", chars] : []),
    ], { from: "user" });

    expect(mocks.execute).toHaveBeenCalledOnce();
    expect(mocks.execute.mock.calls[0]?.[1]).toMatchObject({
      direction: "한국어 단편", storyId: "ko-short-cpa-pilot", chapters: 1,
      minChapterLength: null, maxChapterLength: null, openingHookChars: null, cover: false,
    });
    expect(mocks.execute.mock.calls[0]?.[1].charsPerChapter).toBe(chars ? 600 : undefined);
    expect(JSON.parse(mocks.log.mock.calls.at(-1)![0])).not.toHaveProperty("error");
  });

  it("rejects an invalid ratio through the real schema before production", async () => {
    const { shortCommand } = await import("../commands/short-fiction.js");
    await shortCommand.parseAsync([
      "run", "--direction", "Fixture", "--min-chapter-length-ratio", "2", "--json",
    ], { from: "user" });

    expect(mocks.execute).not.toHaveBeenCalled();
    expect(JSON.parse(mocks.log.mock.calls.at(-1)![0])).toHaveProperty("error");
    expect(process.exitCode).toBe(1);
  });

  it("preserves complete JSON output and nonzero status in the built CLI process", async () => {
    const result = await runChild(process.execPath, [
      cliEntry, "short", "run", "--direction", "Fixture", "--lang", "invalid", "--json",
    ], {
      cwd: mocks.root,
      timeout: 15_000,
      env: { PATH: process.env.PATH, HOME: mocks.root },
    }).then(
      ({ stdout, stderr }) => ({ code: 0, stdout, stderr }),
      (error: { code: number; stdout: string; stderr: string }) => error,
    );

    expect(JSON.parse(result.stdout)).toHaveProperty("error");
    expect(result.code).toBe(1);
  });
});
