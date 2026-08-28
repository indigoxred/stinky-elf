/* oxlint-disable typescript/no-floating-promises -- node:test registers top-level tests. */
import assert from "node:assert/strict";
import test from "node:test";

import type { PageFetchResult, TraditionalReaderConfig } from "../../MangaHere/models.js";
import { PageResolutionError, resolveTraditionalPages } from "../../MangaHere/resolver.js";

const CONFIG: TraditionalReaderConfig = {
  mode: "traditional",
  cid: "12345",
  pageCount: 3,
  pageBase: "https://www.mangahere.cc/manga/example/c001",
  chapterUrl: "https://www.mangahere.cc/manga/example/c001/1.html",
  keyExpression: "'key'",
  secretKey: "key",
};

const noSleep = async (_seconds: number): Promise<void> => {};

function pageBody(page: number): string {
  return `pix='https://img.example/';pvalue=['${page}.jpg'];`;
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error("Timed out waiting for resolver calls");
}

test("limits page requests to three and preserves source order", async () => {
  let active = 0;
  let maxActive = 0;
  const releases = new Map<number, (result: PageFetchResult) => void>();

  const resolving = resolveTraditionalPages(
    CONFIG,
    async (page): Promise<PageFetchResult> => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      return new Promise<PageFetchResult>((resolve) => {
        releases.set(page, (result) => {
          active -= 1;
          resolve(result);
        });
      });
    },
    noSleep,
  );

  await waitUntil(() => releases.size === 3);
  releases.get(3)?.({ status: 200, body: pageBody(3) });
  releases.get(1)?.({ status: 200, body: pageBody(1) });
  releases.get(2)?.({ status: 200, body: pageBody(2) });

  assert.deepEqual(await resolving, [
    "https://img.example/1.jpg",
    "https://img.example/2.jpg",
    "https://img.example/3.jpg",
  ]);
  assert.equal(maxActive, 3);
});

test("retries an empty response with an empty key", async () => {
  const keys: string[] = [];
  let attempts = 0;
  const pages = await resolveTraditionalPages(
    { ...CONFIG, pageCount: 1 },
    async (_page, key): Promise<PageFetchResult> => {
      keys.push(key);
      attempts += 1;
      return attempts === 1 ? { status: 200, body: "" } : { status: 200, body: pageBody(1) };
    },
    noSleep,
  );

  assert.deepEqual(keys, ["key", ""]);
  assert.deepEqual(pages, ["https://img.example/1.jpg"]);
});

test("reduces future request batches to one after throttling", async () => {
  let pageTwoAttempts = 0;
  let activeAfterThrottle = 0;
  let maxActiveAfterThrottle = 0;
  let throttled = false;

  const pages = await resolveTraditionalPages(
    { ...CONFIG, pageCount: 5 },
    async (page): Promise<PageFetchResult> => {
      if (throttled && page > 3) {
        activeAfterThrottle += 1;
        maxActiveAfterThrottle = Math.max(maxActiveAfterThrottle, activeAfterThrottle);
        await new Promise<void>((resolve) => setImmediate(resolve));
        activeAfterThrottle -= 1;
      }
      if (page === 2 && pageTwoAttempts === 0) {
        pageTwoAttempts += 1;
        throttled = true;
        return { status: 429, body: "" };
      }
      return { status: 200, body: pageBody(page) };
    },
    noSleep,
  );

  assert.deepEqual(
    pages,
    [1, 2, 3, 4, 5].map((page) => `https://img.example/${page}.jpg`),
  );
  assert.equal(pageTwoAttempts, 1);
  assert.equal(maxActiveAfterThrottle, 1);
});

test("rejects the whole chapter when one page remains unresolved", async () => {
  const promise = resolveTraditionalPages(
    CONFIG,
    async (page): Promise<PageFetchResult> =>
      page === 2 ? { status: 200, body: "" } : { status: 200, body: pageBody(page) },
    noSleep,
  );

  await assert.rejects(
    promise,
    (error: unknown) =>
      error instanceof PageResolutionError && error.message === "Unresolved MangaHere pages: 2",
  );
});
