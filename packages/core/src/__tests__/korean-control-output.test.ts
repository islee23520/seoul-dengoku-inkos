import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { StateManager } from "../state/manager.js";
import { PlannerAgent } from "../agents/planner.js";
import { WriterAgent } from "../agents/writer.js";
import { savePersistedPlan, loadPersistedPlan } from "../pipeline/persisted-governed-plan.js";
it("renders Korean planning projections without changing the typed cache", async () => {
  const root = await mkdtemp(join(tmpdir(), "inkos-ko-controls-"));
  try {
    const state = new StateManager(root);
    await state.ensureControlDocumentsAt(root, "ko");
    const focus = await readFile(join(root, "story/current_focus.md"), "utf8");
    expect(focus).not.toMatch(/[A-Za-z\u4e00-\u9fff]/);
    const intent = { chapter: 1, goal: "편지 찾기" };
    const memo = { ...intent, body: "편지를 찾는다.", threadRefs: ["hook-letter"] };
    const planner = new PlannerAgent({ client: {}, model: "fixture", projectRoot: root } as never);
    const render = planner as unknown as { renderIntentMarkdown: (i: typeof intent, m: typeof memo, language: "ko") => string };
    const markdown = render.renderIntentMarkdown(intent, memo, "ko");
    expect(markdown).not.toMatch(/Chapter|Goal|Thread Refs|Body/);
    await mkdir(join(root, "story/runtime"), { recursive: true });
    await savePersistedPlan(root, { intent, memo, intentMarkdown: markdown, plannerInputs: [], runtimePath: "unused" });
    expect((await loadPersistedPlan(root, 1))?.memo).toEqual(memo);
  } finally { await rm(root, { recursive: true, force: true }); }
});
it("routes writer progress through Korean rather than Chinese", () => {
  const messages: string[] = [];
  const writer = new WriterAgent({ client: {}, model: "fixture", projectRoot: "/tmp", logger: { info: (text: string) => messages.push(text) } } as never);
  const log = writer as unknown as { logInfo: (language: "ko", labels: {zh:string;en:string;ko:string}) => void };
  log.logInfo("ko", { zh: "阶段", en: "Phase", ko: "단계" });
  expect(messages).toEqual(["단계"]);
});
