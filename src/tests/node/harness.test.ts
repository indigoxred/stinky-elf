/* oxlint-disable typescript/no-floating-promises -- node:test registers top-level tests. */
import assert from "node:assert/strict";
import test from "node:test";

import type { TestLogger } from "@paperback/types";

import { TestSuite } from "../harness.js";

class RecordingLogger implements TestLogger {
  constructor(
    private readonly records: Record<string, unknown>,
    private readonly path: string[] = [],
  ) {}

  scope(key: string): TestLogger {
    return new RecordingLogger(this.records, [...this.path, key]);
  }

  list(key: string): TestLogger {
    return this.scope(key);
  }

  log(key: string, value: unknown): TestLogger {
    let target = this.records;
    for (const part of this.path) {
      const child = target[part];
      if (typeof child !== "object" || child === null || Array.isArray(child)) {
        target[part] = {};
      }
      target = target[part] as Record<string, unknown>;
    }
    target[key] = value;
    return this;
  }
}

test("test harness runs registered cases", async () => {
  let ran = false;
  const suite = new TestSuite("MangaHere", new RecordingLogger({}));
  suite.test("sample", async () => {
    ran = true;
  });

  await suite.run();

  assert.equal(ran, true);
});

test("writes the Paperback 0.9 test result schema", async () => {
  const records: Record<string, unknown> = {};
  const suite = new TestSuite("MangaHere", new RecordingLogger(records));
  suite.test("sample", async () => {});

  await suite.run();

  assert.equal(records.name, "MangaHere");
  assert.equal(
    (records.tests as { sample?: { status?: unknown } } | undefined)?.sample?.status,
    "pass",
  );
  assert.deepEqual(
    records.summary,
    {
      passed: 1,
      failed: 0,
      total: 1,
      duration: (records.summary as { duration: number }).duration,
    },
  );
});
