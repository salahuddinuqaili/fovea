import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  looksLikeWriteSql,
  scanSql,
  splitStatements,
  stripSqlComments,
  validateReadSql,
  validateSandboxWriteSql,
} from "./sql.ts";

describe("scanSql", () => {
  it("does not strip -- that lives inside a string", () => {
    const sql = "SELECT 1 FROM analytics.fct_orders WHERE a = '--'; DELETE FROM analytics.fct_orders";
    const scan = scanSql(sql);
    assert.equal(scan.error, null);
    assert.match(scan.stripped, /DELETE FROM analytics.fct_orders/);
    assert.deepEqual(splitStatements(sql), [
      "SELECT 1 FROM analytics.fct_orders WHERE a = '--'",
      "DELETE FROM analytics.fct_orders",
    ]);
  });

  it("does not strip block comments that live inside a string", () => {
    const sql = "SELECT '/* not a comment */' FROM analytics.fct_orders";
    assert.match(stripSqlComments(sql), /\/\* not a comment \*\//);
    assert.equal(validateReadSql(sql).ok, true);
  });

  it("nests block comments the way PostgreSQL does", () => {
    const sql = "SELECT 1 /* outer /* inner */ still */ FROM analytics.fct_orders";
    assert.equal(stripSqlComments(sql), "SELECT 1 FROM analytics.fct_orders");
    assert.equal(validateReadSql(sql).ok, true);
  });

  it("preserves spaces inside string literals when collapsing", () => {
    const sql = "SELECT 'hello    world' FROM analytics.fct_orders";
    assert.equal(validateReadSql(sql).normalized.includes("hello    world"), true);
  });
});

describe("validateReadSql literals", () => {
  it("refuses a DELETE hidden after a string that contains --", () => {
    const v = validateReadSql(
      "SELECT 1 FROM analytics.fct_orders WHERE a = '--'; DELETE FROM analytics.fct_orders",
    );
    assert.equal(v.ok, false);
    assert.equal(v.statements.length, 2);
  });

  it("allows the word delete inside a selected string", () => {
    assert.equal(validateReadSql("SELECT 'please delete this note' FROM analytics.fct_orders").ok, true);
    assert.equal(looksLikeWriteSql("SELECT 'please delete this note' FROM analytics.fct_orders"), false);
  });

  it("still refuses an actual write and SELECT INTO", () => {
    assert.equal(validateReadSql("DELETE FROM analytics.fct_orders").ok, false);
    assert.equal(validateReadSql("SELECT * INTO analytics.copy FROM analytics.fct_orders").ok, false);
  });

  it("refuses unclosed constructs instead of guessing", () => {
    assert.equal(validateReadSql("SELECT 'oops FROM analytics.fct_orders").ok, false);
    assert.equal(validateReadSql("SELECT 1 FROM analytics.fct_orders /* unterminated").ok, false);
    assert.equal(validateReadSql("SELECT $$oops FROM analytics.fct_orders").ok, false);
  });

  it("does not treat dollar-quoted -- as a line comment", () => {
    const v = validateReadSql(
      "SELECT $$--$$ FROM analytics.fct_orders; DELETE FROM analytics.fct_orders",
    );
    assert.equal(v.ok, false);
    assert.equal(v.statements.length, 2);
  });
});

describe("validateSandboxWriteSql literals", () => {
  it("refuses a DROP stacked after an INSERT whose value contains --", () => {
    const v = validateSandboxWriteSql(
      "INSERT INTO sandbox.metric_scratch (note) VALUES ('--'); DROP TABLE sandbox.metric_scratch",
    );
    assert.equal(v.ok, false);
  });

  it("allows -- inside a SET string when the WHERE is a single equality", () => {
    assert.equal(
      validateSandboxWriteSql(
        "UPDATE sandbox.metric_scratch SET note = 'x -- not a comment' WHERE week_start = '2026-08-24'",
      ).ok,
      true,
    );
  });

  it("does not treat WHERE text inside a string as the WHERE clause", () => {
    assert.equal(
      validateSandboxWriteSql(
        "UPDATE sandbox.metric_scratch SET note = 'where or like' WHERE week_start = '2026-08-24'",
      ).ok,
      true,
    );
  });
});
