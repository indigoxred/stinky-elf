import type {
  PageFetchResult,
  ResolverOptions,
  TraditionalReaderConfig,
} from "./models.js";
import { extractResolvedImageUrl } from "./packed.js";

const THROTTLE_STATUSES = new Set([403, 429]);
const TRANSIENT_STATUSES = new Set([408, 425, 500, 502, 503, 504]);

type FetchPage = (page: number, key: string) => Promise<PageFetchResult>;
type Sleep = (seconds: number) => Promise<void>;

type ResolvedPage = {
  url?: string;
  throttled: boolean;
};

export class PageResolutionError extends Error {
  override readonly name = "PageResolutionError";

  constructor(readonly unresolvedPages: number[]) {
    super(`Unresolved MangaHere pages: ${unresolvedPages.join(", ")}`);
  }
}

async function resolvePage(
  page: number,
  initialKey: string,
  fetchPage: FetchPage,
  sleep: Sleep,
  maxAttempts: number,
): Promise<ResolvedPage> {
  let key = initialKey;
  let throttled = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: PageFetchResult;
    try {
      response = await fetchPage(page, key);
    } catch {
      if (attempt < maxAttempts) await sleep(0.5 * attempt);
      continue;
    }

    if (response.status === 200 && response.body.trim()) {
      try {
        return { url: extractResolvedImageUrl(response.body), throttled };
      } catch {
        if (attempt < maxAttempts) await sleep(0.5 * attempt);
        continue;
      }
    }

    if (response.status === 200) {
      key = "";
      continue;
    }

    if (THROTTLE_STATUSES.has(response.status)) {
      throttled = true;
      if (attempt < maxAttempts) await sleep(attempt);
      continue;
    }

    if (TRANSIENT_STATUSES.has(response.status)) {
      if (attempt < maxAttempts) await sleep(0.5 * attempt);
      continue;
    }

    break;
  }

  return { throttled };
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export async function resolveTraditionalPages(
  config: TraditionalReaderConfig,
  fetchPage: FetchPage,
  sleep: Sleep,
  options: ResolverOptions = {},
): Promise<string[]> {
  const pageCount = positiveInteger(config.pageCount, 0);
  if (pageCount === 0) throw new PageResolutionError([]);

  const pages = new Array<string | undefined>(pageCount).fill(undefined);
  const maxAttempts = positiveInteger(options.maxAttempts, 3);
  let width = positiveInteger(options.concurrency, 3);
  let cursor = 1;

  while (cursor <= pageCount) {
    const batch = Array.from(
      { length: Math.min(width, pageCount - cursor + 1) },
      (_, index) => cursor + index,
    );
    const settled = await Promise.allSettled(
      batch.map((page) =>
        resolvePage(page, config.secretKey ?? "", fetchPage, sleep, maxAttempts),
      ),
    );
    let batchWasThrottled = false;

    settled.forEach((result, index) => {
      const page = batch[index];
      if (page === undefined || result.status !== "fulfilled") return;
      if (result.value.url) pages[page - 1] = result.value.url;
      batchWasThrottled ||= result.value.throttled;
    });

    if (batchWasThrottled) width = 1;
    cursor += batch.length;
  }

  const unresolved = pages.flatMap((url, index) => (url ? [] : [index + 1]));
  if (unresolved.length > 0) throw new PageResolutionError(unresolved);
  return pages as string[];
}
