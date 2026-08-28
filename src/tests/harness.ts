import type { TestLogger } from "@paperback/types";

type TestCase = {
  name: string;
  run: () => Promise<void>;
};

export class TestSuite {
  private readonly cases: TestCase[] = [];

  constructor(
    private readonly name: string,
    private readonly logger: TestLogger,
  ) {}

  test(name: string, run: () => Promise<void>): void {
    this.cases.push({ name, run });
  }

  async run(): Promise<void> {
    let failures = 0;
    const list = this.logger.list(this.name);

    for (const testCase of this.cases) {
      const startedAt = Date.now();
      const log = list.scope(testCase.name);

      try {
        await testCase.run();
        log.log("status", "pass");
      } catch (error) {
        failures += 1;
        log.log("status", "fail");
        log.log("error", String(error));
      }

      log.log("durationMs", Date.now() - startedAt);
    }

    if (failures > 0) {
      throw new Error(`${failures} MangaHere test(s) failed`);
    }
  }
}
