import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildForecastContext } from "../forecast/context-builder.js";
import { renderSelectedBranchPlanMarkdown } from "../forecast/render.js";
import { selectNarrativeBranch } from "../forecast/runner.js";
import { ForecastStore } from "../forecast/store.js";
import { makeForecast, writeForecastFixtureBook } from "./helpers/forecast-fixture.js";

describe("strict stale forecast selection", () => {
  const roots: string[] = [];
  const selectedAt = "2026-07-15T01:00:00.000Z";

  afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("selects a fresh forecast when strict rejection is enabled", async () => {
    vi.stubEnv("INKOS_STRICT_STALE_REJECT", "1");
    const { options, planPath } = await fixture();

    const selected = await selectNarrativeBranch(options);

    expect(selected.stale).toBe(false);
    expect(selected.planPath).toBe(planPath);
    expect(await readFile(planPath, "utf-8")).toBe(expectedPlan(selected));
  });

  it.each(["fingerprint", "status"] as const)("rejects a stale %s without creating a plan", async (staleSource) => {
    vi.stubEnv("INKOS_STRICT_STALE_REJECT", "1");
    const { bookDir, forecast, options, planPath, store } = await fixture();
    if (staleSource === "fingerprint") {
      await writeFile(join(bookDir, "story", "current_focus.md"), "Changed canonical focus", "utf-8");
    } else {
      await store.markStale(forecast);
    }

    await expect(selectNarrativeBranch(options)).rejects.toThrow(/stale/i);
    await expect(readFile(planPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("preserves existing plan bytes when rejecting a stale forecast", async () => {
    vi.stubEnv("INKOS_STRICT_STALE_REJECT", "1");
    const { bookDir, options, planPath } = await fixture();
    await selectNarrativeBranch(options);
    const before = await readFile(planPath);
    await writeFile(join(bookDir, "story", "current_focus.md"), "Changed canonical focus", "utf-8");

    await expect(selectNarrativeBranch({ ...options, branchId: "branch-2" })).rejects.toThrow(/stale/i);

    expect(await readFile(planPath)).toEqual(before);
  });

  it.each([undefined, "0", "true"])("keeps stale plan output unchanged with flag %s", async (flag) => {
    vi.stubEnv("INKOS_STRICT_STALE_REJECT", flag);
    const { bookDir, options, planPath } = await fixture();
    await writeFile(join(bookDir, "story", "current_focus.md"), "Changed canonical focus", "utf-8");

    const selected = await selectNarrativeBranch(options);

    expect(selected.stale).toBe(true);
    expect(selected.planPath).toBe(planPath);
    expect(await readFile(planPath, "utf-8")).toBe(expectedPlan(selected));
  });

  function expectedPlan(selected: Awaited<ReturnType<typeof selectNarrativeBranch>>): string {
    return `${renderSelectedBranchPlanMarkdown({
      forecast: selected.forecast,
      branch: selected.branch,
      selectedAt,
      stale: selected.stale,
    }).trimEnd()}\n`;
  }

  async function fixture() {
    const root = await mkdtemp(join(tmpdir(), "inkos-forecast-stale-reject-"));
    roots.push(root);
    const bookDir = join(root, "works", "demo-book", "source");
    await writeForecastFixtureBook(bookDir);
    const context = await buildForecastContext({ bookDir, bookId: "demo-book" });
    const forecast = makeForecast({
      baseChapter: context.baseChapter,
      contextFingerprint: context.contextFingerprint,
    });
    const store = new ForecastStore(bookDir);
    await store.save(forecast, "Comparison fixture");
    return {
      bookDir,
      forecast,
      store,
      planPath: store.selectedPlanPath(forecast.forecastId),
      options: {
        projectRoot: root,
        bookId: "demo-book",
        forecastId: forecast.forecastId,
        branchId: "branch-1",
        determinism: { now: () => new Date(selectedAt) },
      },
    };
  }
});
