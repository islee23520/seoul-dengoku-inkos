import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { createWorkManifest, saveWorkManifest } from "../harness/work-store.js";
import { syncWorkSourceArtifacts } from "../harness/source-sync.js";

it("publishes independent SQLite snapshots containing committed WAL changes only", async () => {
  const root = await mkdtemp(join(tmpdir(), "inkos-source-snapshot-"));
  let writer: DatabaseSync | undefined;
  try {
    await saveWorkManifest(root, createWorkManifest({ id: "world", title: "World", profileId: "interactive-world", language: "en" }));
    const source = join(root, "works/world/source");
    await mkdir(source, { recursive: true });
    writer = new DatabaseSync(join(source, "play.db"));
    writer.exec("PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 0; CREATE TABLE facts (value TEXT); INSERT INTO facts VALUES ('committed')");
    writer.exec("BEGIN IMMEDIATE; INSERT INTO facts VALUES ('uncommitted')");
    const work = await syncWorkSourceArtifacts({ projectRoot: root, workId: "world", accept: true });
    const artifact = work.artifacts.find(item => item.revisions.some(revision => revision.path === "source/play.db"))!;
    const revision = artifact.revisions.find(item => item.id === artifact.currentRevisionId)!;
    const snapshotPath = join(root, "works/world", revision.snapshotPath!);
    const snapshot = new DatabaseSync(snapshotPath, { readOnly: true });
    try {
      expect(snapshot.prepare("SELECT value FROM facts").all()).toEqual([{ value: "committed" }]);
      expect(snapshot.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    } finally { snapshot.close(); }
    writer.exec("ROLLBACK; INSERT INTO facts VALUES ('later')");
    writer.close();
    writer = undefined;
    await rm(join(source, "play.db"));
    const independent = new DatabaseSync(snapshotPath, { readOnly: true });
    try { expect(independent.prepare("SELECT value FROM facts").all()).toEqual([{ value: "committed" }]); }
    finally { independent.close(); }
  } finally {
    writer?.close();
    await rm(root, { recursive: true, force: true });
  }
});
