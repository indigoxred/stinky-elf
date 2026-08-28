import assert from "node:assert/strict";
import test from "node:test";

import { TestSuite } from "../harness.js";

test("test harness runs registered cases", async () => {
  let ran = false;
  const logger = {
    list: () => ({
      scope: () => ({ log: () => undefined }),
    }),
  };
  const suite = new TestSuite("MangaHere", logger as never);
  suite.test("sample", async () => {
    ran = true;
  });

  await suite.run();

  assert.equal(ran, true);
});
