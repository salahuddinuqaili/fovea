import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { METRICS } from "./fixtures.ts";

const packDir = join(dirname(fileURLToPath(import.meta.url)), "../../metrics/packs/lumen");

describe("lumen metric catalog pack", () => {
  it("has one JSON file per fixture metric and the shared fields match", () => {
    const files = readdirSync(packDir)
      .filter((f) => f.endsWith(".json"))
      .sort();
    const expected = METRICS.map((m) => `${m.id}.json`).sort();
    assert.deepEqual(files, expected);
    for (const metric of METRICS) {
      const pack = JSON.parse(readFileSync(join(packDir, `${metric.id}.json`), "utf8")) as Record<string, unknown>;
      assert.equal(pack.id, metric.id);
      assert.equal(pack.name, metric.name);
      assert.equal(pack.status, metric.status);
      assert.equal(pack.owner, metric.owner);
      assert.equal(pack.description, metric.description);
      assert.equal(pack.formula, metric.formula);
      assert.deepEqual(pack.grains, metric.grains);
      assert.deepEqual(pack.filters, metric.filters);
      assert.equal(pack.sourceTable, metric.sourceTable);
      assert.equal(pack.dataClass, metric.dataClass);
    }
  });
});
