import type { TestLogger } from "@paperback/types";
import { expect } from "chai";

import { TestSuite } from "./harness.js";

export async function runTests(logger: TestLogger): Promise<void> {
  const suite = new TestSuite("MangaHere", logger);
  suite.test("test harness runs", async () => {
    expect(true).to.equal(true);
  });
  await suite.run();
}
