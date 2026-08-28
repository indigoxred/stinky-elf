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
  ) {
    this.logger.log("name", name);
  }

  test(name: string, run: () => Promise<void>): void {
    this.cases.push({ name, run });
  }

  async run(): Promise<void> {
    const startedAt = Date.now();
    let passed = 0;
    let failures = 0;
    const list = this.logger.list("tests");

    for (const testCase of this.cases) {
      const testStartedAt = Date.now();
      const log = list.scope(testCase.name);

      try {
        await testCase.run();
        passed += 1;
        log.log("status", "pass");
      } catch (error) {
        failures += 1;
        log.log("status", "fail");
        log.log("error", String(error));
      }

      log.log("duration", Date.now() - testStartedAt);
    }

    this.logger.log("summary", {
      passed,
      failed: failures,
      total: this.cases.length,
      duration: Date.now() - startedAt,
    });
  }
}
