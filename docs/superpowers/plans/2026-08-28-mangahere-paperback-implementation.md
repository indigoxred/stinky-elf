# MangaHere Paperback 0.9 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, test, privately host, and publish an installable Paperback 0.9 MangaHere source that reconnects Netsky 0.8 library records and resolves traditional-reader pages with safe bounded concurrency.

**Architecture:** A Paperback-facing adapter delegates to pure identifier, HTML parser, packed-script, and page-resolver modules. Ordinary browsing requests use an interceptor and browsing limiter, while `chapterfun.ashx` work is controlled by a three-wide resolver queue that preserves order and falls back to sequential requests on throttling.

**Tech Stack:** Node.js 24, TypeScript 7, `@paperback/toolchain` and `@paperback/types` 1.0.0-alpha.92, Cheerio 1.2, Chai 6, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-08-28-mangahere-paperback-design.md`

## Global Constraints

- The source folder and named export are exactly `MangaHere`.
- The source repository is private and owned by `indigoxred`; it is not a fork and imports no external Git history.
- Only compiled repository artifacts are exposed through a public, unlisted install URL.
- New title IDs are legacy slugs such as `series-name`.
- New chapter IDs are complete legacy-relative paths such as `c025` or `v01/c025`.
- Modern title-prefixed and absolute MangaHere IDs remain accepted as input.
- Resolver concurrency starts at three, retries each page at most three times, and falls back to one after HTTP 403/429.
- A chapter is returned only when every page URL is present exactly once and in source order.
- No cookie, sensitive header, response body, or resolver key is written to logs.
- Cloudflare, CAPTCHA, authentication, and durable access controls are not bypassed.
- Correctness and avoiding a site block take priority over the twofold performance target.

## File Map

- `.gitignore` — excludes dependencies, bundles, local references, logs, and OS/editor files.
- `package.json` / `package-lock.json` — locked Paperback 0.9 build and test environment.
- `tsconfig.json` — strict ESM/bundler TypeScript configuration.
- `README.md` — install, privacy, testing, and release instructions.
- `.github/workflows/check.yml` — typecheck, format, test, and bundle validation.
- `.github/workflows/deploy.yml` — publishes `bundles/` into `0.9/stable/` on `gh-pages`.
- `src/MangaHere/constants.ts` — base URL, limits, headers, and source-wide constants.
- `src/MangaHere/identifiers.ts` — ID normalization and URL construction only.
- `src/MangaHere/models.ts` — parser and resolver data contracts.
- `src/MangaHere/packed.ts` — deterministic Dean-Edwards unpacking and image extraction.
- `src/MangaHere/parsers.ts` — MangaHere HTML parsing without networking.
- `src/MangaHere/resolver.ts` — ordered bounded page resolution, retry, and fallback.
- `src/MangaHere/network.ts` — headers, cookies, Cloudflare detection, browsing limiter, and text requests.
- `src/MangaHere/main.ts` — Paperback `ExtensionImpl` adapter and webview key evaluation.
- `src/MangaHere/pbconfig.ts` — `MangaHere` manifest version and capabilities.
- `src/MangaHere/static/icon.png` — original 512×512 source icon.
- `src/tests/harness.ts` — small Chai-backed Paperback test runner.
- `src/tests/MangaHere.ts` — test entry point discovered by `paperback-cli test`.
- `src/tests/cases/identifiers.ts` — legacy/modern ID matrix.
- `src/tests/cases/packed.ts` — packed-script and image URL cases.
- `src/tests/cases/parsers.ts` — search, details, chapters, and reader fixtures.
- `src/tests/cases/resolver.ts` — concurrency, ordering, retry, and throttle cases.
- `src/tests/fixtures/mangahere.ts` — minimal sanitized HTML/script strings.
- `docs/verification/device-test.md` — repeatable Paperback installation and acceptance checklist.

---

### Task 1: Establish the Paperback 0.9 Build and Test Baseline

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `package-lock.json` via `npm install --package-lock-only`
- Create: `tsconfig.json`
- Create: `src/tests/harness.ts`
- Create: `src/tests/MangaHere.ts`

**Interfaces:**
- Consumes: Node.js 24 and npm.
- Produces: `TestSuite.test(name, fn)` and `TestSuite.run()`; scripts `tsc`, `format`, `format:check`, `lint`, `lint:check`, `test`, `bundle`, `serve`, and `dev`.

- [ ] **Step 1: Add ignored local/build paths**

```gitignore
node_modules/
bundles/
work/
*.log
.DS_Store
Thumbs.db
.vscode/
```

- [ ] **Step 2: Add the locked package manifest**

```json
{
  "name": "mangahere-paperback",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "UNLICENSED",
  "repositoryName": "indigoxred MangaHere",
  "repositoryDescription": "Private-source MangaHere extension repository for Paperback 0.9",
  "scripts": {
    "tsc": "tsc",
    "format": "oxfmt .",
    "format:check": "oxfmt --check .",
    "lint": "oxlint --type-aware --fix",
    "lint:check": "oxlint --type-aware --deny-warnings",
    "conformance": "npm run tsc && npm run lint:check && npm run format:check",
    "test": "paperback-cli test --noConsole --output ./bundles/tests.json",
    "bundle": "paperback-cli bundle",
    "serve": "paperback-cli serve",
    "dev": "paperback-cli serve --watch"
  },
  "engines": { "node": ">=24" },
  "dependencies": {
    "cheerio": "1.2.0"
  },
  "devDependencies": {
    "@paperback/toolchain": "1.0.0-alpha.92",
    "@paperback/types": "1.0.0-alpha.92",
    "@types/chai": "5.2.3",
    "chai": "6.2.1",
    "oxfmt": "0.64.0",
    "oxlint": "1.79.0",
    "oxlint-tsgolint": "7.0.2001",
    "typescript": "7.0.2"
  }
}
```

- [ ] **Step 3: Add strict TypeScript configuration**

Use ESM-preserving bundler resolution, `target: "esnext"`, `module: "preserve"`, `moduleResolution: "bundler"`, `resolveJsonModule: true`, `noEmit: true`, `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `verbatimModuleSyntax: true`, `isolatedModules: true`, `forceConsistentCasingInFileNames: true`, and `skipLibCheck: true`.

- [ ] **Step 4: Write the failing harness smoke test**

```ts
// src/tests/MangaHere.ts
import type { TestLogger } from "@paperback/types";
import { expect } from "chai";
import { TestSuite } from "./harness.js";

export async function runTests(logger: TestLogger): Promise<void> {
  const suite = new TestSuite("MangaHere", logger);
  suite.test("test harness runs", async () => expect(true).to.equal(true));
  await suite.run();
}
```

- [ ] **Step 5: Run the test to verify the missing harness failure**

Run: `npm install && npm test`

Expected: TypeScript/bundle failure because `./harness.js` does not exist.

- [ ] **Step 6: Implement `TestSuite`**

The harness stores named async callbacks, executes each with a scoped `TestLogger`, logs `pass`/`fail` plus duration, and rethrows a final error when at least one case failed so CI receives a non-zero result.

```ts
export class TestSuite {
  private readonly cases: Array<{ name: string; run: () => Promise<void> }> = [];
  constructor(private readonly name: string, private readonly logger: TestLogger) {}
  test(name: string, run: () => Promise<void>): void { this.cases.push({ name, run }); }
  async run(): Promise<void> {
    let failures = 0;
    for (const testCase of this.cases) {
      const started = Date.now();
      const log = this.logger.list(this.name).scope(testCase.name);
      try { await testCase.run(); log.log("status", "pass"); }
      catch (error) { failures += 1; log.log("status", "fail"); log.log("error", String(error)); }
      log.log("durationMs", Date.now() - started);
    }
    if (failures > 0) throw new Error(`${failures} MangaHere test(s) failed`);
  }
}
```

- [ ] **Step 7: Verify and commit the baseline**

Run: `npm run tsc && npm test`

Expected: both commands exit 0 and `bundles/tests.json` reports one passing test.

Commit: `chore: scaffold Paperback 0.9 source repository`

---

### Task 2: Implement Legacy and Modern Identifier Compatibility

**Files:**
- Create: `src/MangaHere/constants.ts`
- Create: `src/MangaHere/identifiers.ts`
- Create: `src/tests/cases/identifiers.ts`
- Modify: `src/tests/MangaHere.ts`

**Interfaces:**
- Produces: `normalizeMangaId(input: string): string`, `normalizeChapterId(mangaId: string, input: string): string`, `mangaUrl(mangaId: string): string`, `chapterUrl(mangaId: string, chapterId: string): string`, and `chapterIdFromHref(mangaId: string, href: string): string`.
- Throws: `InvalidMangaHereIdError` for a foreign host, traversal segment, empty identifier, or chapter path outside the supplied manga.

- [ ] **Step 1: Write the failing identifier matrix**

```ts
expect(normalizeMangaId("class_no_bocchi")).to.equal("class_no_bocchi");
expect(normalizeMangaId("manga/class_no_bocchi/")).to.equal("class_no_bocchi");
expect(normalizeMangaId("https://www.mangahere.cc/manga/class_no_bocchi/?x=1#top"))
  .to.equal("class_no_bocchi");
expect(normalizeChapterId("class_no_bocchi", "c025")).to.equal("c025");
expect(normalizeChapterId("class_no_bocchi", "v01/c025")).to.equal("v01/c025");
expect(normalizeChapterId("class_no_bocchi", "manga/class_no_bocchi/v01/c025/"))
  .to.equal("v01/c025");
expect(chapterUrl("class_no_bocchi", "v01/c025"))
  .to.equal("https://www.mangahere.cc/manga/class_no_bocchi/v01/c025/1.html");
expect(() => normalizeMangaId("https://example.com/manga/class_no_bocchi"))
  .to.throw(InvalidMangaHereIdError);
expect(() => normalizeChapterId("class_no_bocchi", "../other/c001"))
  .to.throw(InvalidMangaHereIdError);
```

- [ ] **Step 2: Run tests and confirm missing exports**

Run: `npm test`

Expected: failure because `identifiers.ts` does not exist.

- [ ] **Step 3: Implement canonicalization**

Use `new URL(input, BASE_URL)` only after detecting whether input is absolute. Permit hosts `mangahere.cc` and `www.mangahere.cc`, strip query/fragment/trailing `1.html`, split decoded path segments, reject `.`/`..`/empty-decoded segments, remove an optional `manga` plus matching title prefix, and preserve all remaining chapter segments.

```ts
export function normalizeChapterId(mangaId: string, input: string): string {
  const title = normalizeMangaId(mangaId);
  const segments = normalizedPathSegments(input);
  const relative = segments[0] === "manga" ? segments.slice(2) : segments;
  if (segments[0] === "manga" && segments[1] !== title) {
    throw new InvalidMangaHereIdError("Chapter belongs to a different title");
  }
  if (relative.at(-1) === "1.html") relative.pop();
  if (relative.length === 0) throw new InvalidMangaHereIdError("Empty chapter id");
  return relative.join("/");
}
```

- [ ] **Step 4: Verify ID compatibility and commit**

Run: `npm run tsc && npm test`

Expected: all ID matrix cases pass.

Commit: `feat: preserve Paperback 0.8 MangaHere identifiers`

---

### Task 3: Implement Packed-Script and Reader Configuration Parsing

**Files:**
- Create: `src/MangaHere/models.ts`
- Create: `src/MangaHere/packed.ts`
- Create: `src/tests/fixtures/mangahere.ts`
- Create: `src/tests/cases/packed.ts`
- Modify: `src/tests/MangaHere.ts`

**Interfaces:**
- Produces: `unpackDeanEdwards(source: string): string`, `extractBulkImageUrls(script: string): string[]`, `extractResolvedImageUrl(script: string): string`, and `extractKeyExpression(unpackedScript: string): string`.
- Produces models: `BulkReaderConfig`, `TraditionalReaderConfig`, `ReaderConfig`, `PageFetchResult`, and `ResolverOptions`.

- [ ] **Step 1: Add sanitized packed-script fixtures and failing tests**

The fixtures contain a small valid `eval(function(p,a,c,k,e,d)...` sample that expands into `newImgs=['//img.example/1.jpg','//img.example/2.jpg'];`, a traditional response that expands into `pix='//img.example/';pvalue=["003.jpg"];`, and malformed samples.

```ts
expect(extractBulkImageUrls(BULK_PACKED_SCRIPT)).to.deep.equal([
  "https://img.example/1.jpg",
  "https://img.example/2.jpg",
]);
expect(extractResolvedImageUrl(PAGE_PACKED_SCRIPT)).to.equal(
  "https://img.example/003.jpg",
);
expect(() => extractResolvedImageUrl("not packed")).to.throw(
  "resolved image URL",
);
```

- [ ] **Step 2: Run tests and confirm the packed module is missing**

Run: `npm test`

Expected: failure on imports from `packed.ts`.

- [ ] **Step 3: Implement deterministic unpacking without `eval`**

Parse the payload, radix, count, and keyword table from the Dean-Edwards wrapper; unescape only backslash, single quote, carriage return, and newline sequences; replace encoded word-boundary tokens from `count - 1` down to zero; return the original string only when it is already unpacked and reject a malformed packed wrapper.

```ts
export function unpackDeanEdwards(source: string): string {
  if (!source.includes("function(p,a,c,k,e,d)")) return source;
  const args = source.match(PACKED_ARGUMENTS);
  if (!args?.[1] || !args[2] || !args[3] || args[4] === undefined) {
    throw new PackedScriptError("Malformed Dean-Edwards wrapper");
  }
  let payload = unescapePackedPayload(args[1]);
  const radix = Number(args[2]);
  const count = Number(args[3]);
  const keywords = args[4].split("|");
  for (let index = count - 1; index >= 0; index -= 1) {
    const keyword = keywords[index];
    if (keyword) payload = replaceToken(payload, encodeToken(index, radix), keyword);
  }
  return payload;
}
```

- [ ] **Step 4: Implement strict URL extraction**

Normalize protocol-relative image URLs to HTTPS, require an `http:` or `https:` URL after joining `pix` and the first `pvalue`, and throw when a packed response does not produce exactly one usable resolved page URL.

- [ ] **Step 5: Verify and commit packed parsing**

Run: `npm run tsc && npm test`

Expected: bulk and traditional extraction tests pass without executing source-provided JavaScript.

Commit: `feat: decode MangaHere reader scripts safely`

---

### Task 4: Implement Search, Metadata, Chapter, and Reader HTML Parsers

**Files:**
- Create: `src/MangaHere/parsers.ts`
- Create: `src/tests/cases/parsers.ts`
- Modify: `src/tests/fixtures/mangahere.ts`
- Modify: `src/tests/MangaHere.ts`

**Interfaces:**
- Produces: `parseListings(html: string, mode: "search" | "directory"): ParsedListing[]`, `parseMangaDetails(html: string, mangaId: string): ParsedManga`, `parseChapters(html: string, mangaId: string): ParsedChapter[]`, `parsePageMetadata(html: string): { hasNextPage: boolean }`, and `parseReader(html: string, chapterUrl: string): ReaderConfig`.

- [ ] **Step 1: Write representative failing parser tests**

```ts
expect(parseListings(SEARCH_HTML, "search")[0]).to.deep.include({
  mangaId: "class_no_bocchi",
  title: "Class No Bocchi",
  imageUrl: "https://img.example/cover.jpg",
});
expect(parseChapters(CHAPTER_LIST_HTML, "class_no_bocchi").map((x) => x.chapterId))
  .to.deep.equal(["v01/c025", "c024"]);
expect(parseReader(TRADITIONAL_READER_HTML, CHAPTER_URL)).to.deep.include({
  mode: "traditional",
  cid: "12345",
  pageCount: 3,
  pageBase: "https://www.mangahere.cc/manga/class_no_bocchi/c025",
});
```

- [ ] **Step 2: Run tests and confirm parser exports are missing**

Run: `npm test`

Expected: import failure for `parsers.ts`.

- [ ] **Step 3: Implement listing and title parsing**

Use selectors verified against the current site: `.manga-list-4-list > li` for search, `.manga-list-1-list li` for directory, `.detail-info-right-title-font`, `img.detail-info-cover-img`, `.fullcontent`, `.detail-info-right-say > a`, `.detail-info-right-title-tip`, and `.detail-info-right-tag-list > a`. Return plain parsed records; map to Paperback types only in `main.ts`.

```ts
export function parseListings(html: string, mode: "search" | "directory"): ParsedListing[] {
  const $ = cheerio.load(html);
  const selector = mode === "search" ? ".manga-list-4-list > li" : ".manga-list-1-list li";
  return $(selector).toArray().flatMap((node) => {
    const item = $(node);
    const link = item.find("a").first();
    const href = link.attr("href");
    const title = (link.attr("title") ?? link.text()).trim();
    if (!href || !title) return [];
    return [{ mangaId: normalizeMangaId(href), title, imageUrl: absoluteUrl(item.find("img").first().attr("src")) }];
  });
}
```

- [ ] **Step 4: Implement legacy chapter path extraction**

Read `ul.detail-main-list > li a` with fallback `#chapterlist ul li > a`, pass every href through `chapterIdFromHref`, preserve `vNN/cNNN` paths, parse chapter and volume numbers independently, and return `new Date(0)` only when a date cannot be parsed.

- [ ] **Step 5: Implement reader mode parsing**

Bulk mode requires a `chapter_bar` script plus a packed script containing `newImgs`. Traditional mode requires numeric `chapterid`, a positive pager count, a packed key script, and a page base derived from the canonical `/1.html` chapter URL. Missing required fields throw `MangaHereParseError` with the field name.

- [ ] **Step 6: Verify and commit HTML parsing**

Run: `npm run tsc && npm test`

Expected: fixtures yield stable legacy IDs and both reader modes parse.

Commit: `feat: parse current MangaHere pages`

---

### Task 5: Implement Ordered Bounded Page Resolution

**Files:**
- Create: `src/MangaHere/resolver.ts`
- Create: `src/tests/cases/resolver.ts`
- Modify: `src/tests/MangaHere.ts`

**Interfaces:**
- Consumes: `TraditionalReaderConfig`, `PageFetchResult`, and `extractResolvedImageUrl`.
- Produces: `resolveTraditionalPages(config, fetchPage, sleep, options?): Promise<string[]>`.
- Callback: `fetchPage(page: number, key: string): Promise<PageFetchResult>`.
- Callback: `sleep(seconds: number): Promise<void>`.

- [ ] **Step 1: Write failing concurrency and ordering tests**

Use a deferred fake fetcher that records active calls and completes pages in order 3, 1, 2. Assert maximum active requests equals three and returned URLs remain `[1.jpg, 2.jpg, 3.jpg]`.

- [ ] **Step 2: Write failing retry and throttle tests**

Test an empty first response that succeeds with an empty key on attempt two. Test page two returning 429 once and assert subsequent batches have only one active request. Test a permanently empty page and assert the promise rejects with `Unresolved MangaHere pages: 2` rather than returning a partial array.

- [ ] **Step 3: Run tests and confirm resolver is missing**

Run: `npm test`

Expected: import failure for `resolver.ts`.

- [ ] **Step 4: Implement a batch queue with dynamic width**

Initialize an indexed `Array<string | undefined>(pageCount)`, process consecutive batches of `effectiveConcurrency`, and use `Promise.allSettled` per batch. Start at `options.concurrency ?? 3`; set effective concurrency to one when any attempt reports 403 or 429. Do not launch more than the current batch width.

```ts
const pages = new Array<string | undefined>(config.pageCount);
let cursor = 1;
let width = options.concurrency ?? 3;
while (cursor <= config.pageCount) {
  const batch = Array.from({ length: Math.min(width, config.pageCount - cursor + 1) }, (_, i) => cursor + i);
  const settled = await Promise.allSettled(batch.map((page) => resolvePage(page)));
  for (let i = 0; i < settled.length; i += 1) recordResult(batch[i]!, settled[i]!);
  if (batchWasThrottled) width = 1;
  cursor += batch.length;
}
const unresolved = pages.flatMap((url, index) => url ? [] : [index + 1]);
if (unresolved.length) throw new PageResolutionError(unresolved);
return pages as string[];
```

- [ ] **Step 5: Implement bounded per-page attempts**

Attempt at most `options.maxAttempts ?? 3`; use the parsed key first and an empty key after an empty body; wait `0.5 * attempt` seconds after transient status 408, 425, 500, 502, 503, or 504; wait `attempt` seconds after 403/429; decode only status 200 with a non-empty body.

- [ ] **Step 6: Verify the resolver and commit**

Run: `npm run tsc && npm test`

Expected: concurrency never exceeds three, ordering is deterministic, throttling reduces width to one, and terminal failure returns no pages.

Commit: `feat: resolve MangaHere pages concurrently`

---

### Task 6: Integrate Networking and the Paperback Source Adapter

**Files:**
- Create: `src/MangaHere/network.ts`
- Create: `src/MangaHere/main.ts`
- Create: `src/MangaHere/pbconfig.ts`
- Modify: `src/tests/MangaHere.ts`

**Interfaces:**
- Consumes: all pure modules from Tasks 2–5.
- Produces: named export `MangaHere`, `MangaHereExtension implements ExtensionImpl<typeof MangaHereConfig>`, and Paperback methods `initialise`, `getDiscoverSections`, `getDiscoverSectionItems`, `getSearchResults`, `getMangaDetails`, `getChapters`, `getChapterDetails`, `getMangaShareUrl`, and `cloudflareBypassCompleted`.

- [ ] **Step 1: Write a failing manifest/adapter contract test**

```ts
expect(MangaHereConfig.name).to.equal("MangaHere");
expect(MangaHereConfig.version).to.equal("1.0.0-alpha.1");
expect(MangaHere).to.have.property("getMangaDetails");
expect(MangaHere).to.have.property("getChapterDetails");
```

- [ ] **Step 2: Run tests and confirm adapter imports are missing**

Run: `npm test`

Expected: import failure for `main.ts` and `pbconfig.ts`.

- [ ] **Step 3: Implement request interception and browsing limits**

Add `referer`, `origin`, default user agent, HTML accept headers, English accept-language, and cookie `isAdult=1`. Throw `CloudflareError` only when `cf-mitigated` equals `challenge`. Implement a `BrowsingRateLimiter` that delegates non-`chapterfun.ashx` requests to `BasicRateLimiter` configured for 12 requests per 10 seconds and bypasses resolver requests, whose concurrency is already controlled by `resolver.ts`.

- [ ] **Step 4: Implement Paperback mapping methods**

Search and discovery emit normalized title slugs. Manga details return `ContentRating.MATURE`. Chapters emit legacy-relative IDs and attach the supplied `SourceManga`. Search pagination carries `{ page: nextPage }`. The manifest declares discover, search, chapter, and Cloudflare-bypass capabilities with language `en` and developer `indigoxred`.

```ts
function toSearchResult(item: ParsedListing): SearchResultItem {
  return {
    mangaId: normalizeMangaId(item.mangaId),
    title: item.title,
    subtitle: item.subtitle,
    imageUrl: item.imageUrl,
    contentRating: ContentRating.MATURE,
  };
}

export const MangaHere = new MangaHereExtension();
```

`MangaHereExtension` receives the complete method bodies described in Steps 3–5 before the failing adapter test is rerun; the snippet fixes the mapping and named-export contract without duplicating those method bodies in the plan.

- [ ] **Step 5: Wire chapter details**

Canonicalize the chapter URL, request `/1.html`, parse the reader, return bulk URLs directly, or evaluate only the extracted key expression inside `Application.executeInWebView`. Build resolver requests with `referer`, `accept: */*`, and `x-requested-with: XMLHttpRequest`; pass `Application.sleep` into `resolveTraditionalPages`; emit one timing log containing chapter ID, page count, request count, retry count, throttle count, and elapsed milliseconds.

- [ ] **Step 6: Verify adapter conformance and commit**

Run: `npm run tsc && npm test && npm run bundle`

Expected: typecheck and tests pass; `bundles/versioning.json` contains one source folder named `MangaHere`.

Commit: `feat: integrate MangaHere with Paperback 0.9`

---

### Task 7: Add Original Branding, Documentation, and CI Deployment

**Files:**
- Create: `src/MangaHere/static/icon.png`
- Create: `README.md`
- Create: `.github/workflows/check.yml`
- Create: `.github/workflows/deploy.yml`
- Create: `docs/verification/device-test.md`

**Interfaces:**
- Produces: stable install path `https://indigoxred.github.io/mangahere-paperback/0.9/stable/` when GitHub Pages is available.

- [ ] **Step 1: Generate and verify an original icon**

Use the image generation skill to create a square 512×512 icon with a distinct `MH` monogram, high contrast at small sizes, no MangaHere logo copy, and no third-party artwork. Verify PNG format and exact dimensions before placing it at `src/MangaHere/static/icon.png`.

- [ ] **Step 2: Write user and developer documentation**

Document the install URL, Paperback add-repository steps, Mature-content visibility, restored-library refresh procedure, Node 24 setup, `npm ci`, conformance/test/bundle commands, public-bundle privacy limitation, and development-build versioning.

- [ ] **Step 3: Add check workflow**

On pushes and pull requests to `main`, use `actions/checkout@v6`, `actions/setup-node@v6` with Node 24/npm cache, `npm ci`, `npm run conformance`, `npm test`, and `npm run bundle`.

```yaml
name: Check
on: { push: { branches: [main] }, pull_request: { branches: [main] } }
permissions: { contents: read }
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npm run conformance
      - run: npm test
      - run: npm run bundle
```

- [ ] **Step 4: Add deployment workflow**

On manual dispatch and version tags `v*`, run the same checks, bundle, and deploy `bundles/` using `peaceiris/actions-gh-pages@v4` with `GITHUB_TOKEN`, `publish_branch: gh-pages`, and `destination_dir: 0.9/stable`. Set workflow permissions to `contents: write` and never commit a token.

```yaml
name: Deploy
on: { workflow_dispatch: {}, push: { tags: ["v*"] } }
permissions: { contents: write }
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npm run conformance
      - run: npm test
      - run: npm run bundle
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_branch: gh-pages
          publish_dir: bundles
          destination_dir: 0.9/stable
```

- [ ] **Step 5: Add the device checklist**

Include repository installation, source ID/name confirmation, Mature-source visibility, one restored 0.8 title, one new title, search, metadata, chapter list, bulk reader, 20–40-page traditional reader timing, missing/duplicate/order checks, throttling behavior, and an update through the unchanged URL.

- [ ] **Step 6: Verify documentation/build assets and commit**

Run: `npm run conformance && npm test && npm run bundle`

Expected: all commands exit 0 and the bundled source includes the 512×512 icon.

Commit: `chore: add MangaHere release pipeline`

---

### Task 8: Run Live Site Checks and Prepare the Device Benchmark

**Files:**
- Create: `docs/verification/live-check-2026-08-28.md`
- Modify only if evidence requires: selectors/constants in `src/MangaHere/parsers.ts` or request policy in `src/MangaHere/resolver.ts`.

**Interfaces:**
- Consumes: production bundle and current MangaHere pages.
- Produces: redacted evidence with URLs, status codes, page counts, timings, retry/throttle counts, and pass/fail outcomes.

- [ ] **Step 1: Check current public pages conservatively**

Fetch one directory page, one title page, and one traditional chapter page. Record final URL, HTTP status, detected selector counts, reader mode, and page count; do not download the image bodies.

- [ ] **Step 2: Prepare an exact serial/concurrent device comparison**

Record the current `RESOLVER_CONCURRENCY = 3` line and build hash. Make a local, uncommitted change to one, run `npm run bundle`, serve that bundle with `npm run serve`, and have the owner open the chosen 20–40-page chapter once while collecting the single resolver timing log. Restore the constant to three, rebuild/serve, refresh the same repository in Paperback, and open the same chapter once again. Do not commit the width-one diagnostic build.

- [ ] **Step 3: Compare and stop safely on throttling**

Record complete resolver time, page count, request count, retries, throttling count, and missing/duplicate/order outcome for both runs. Stop further performance requests if the width-three run reports any 403/429; in that case set the shipping constant to the highest tested width that did not throttle and add a resolver-policy regression test before changing code.

- [ ] **Step 4: Apply evidence-driven policy correction test-first**

If current selectors or safe concurrency differ from fixtures, first add the observed sanitized case to the relevant test file, confirm failure, make the smallest parser/policy change, and rerun all tests. Do not weaken validation to accept arbitrary HTML or URLs.

- [ ] **Step 5: Record results and commit**

Acceptance: all pages resolve exactly once in order; width three is at least twice as fast as width one, or the report documents why a lower safe width takes precedence.

Commit: `test: verify MangaHere against the live site`

---

### Task 9: Create the Private GitHub Repository and Publish a Development Build

**Files:**
- No new source files unless GitHub reports a Pages configuration requirement.

**Interfaces:**
- Produces: private repository `indigoxred/mangahere-paperback`, remote `origin`, public unlisted Pages install URL, and a development tag.

- [ ] **Step 1: Create the repository under the authenticated `indigoxred` account**

Create `mangahere-paperback` as private with no generated README, license, or `.gitignore`; verify owner and visibility before pushing.

- [ ] **Step 2: Push local history**

Set `origin` to the exact private SSH or HTTPS URL shown by GitHub and push `main`. Do not push temporary `work/` references; verify `git status --ignored` shows them excluded.

- [ ] **Step 3: Verify private Pages support**

Open repository Pages settings. If the plan does not permit Pages from a private repository, stop without changing visibility. If supported, configure Pages from the `gh-pages` branch after the first deployment.

- [ ] **Step 4: Publish the development tag**

Tag the verified commit `v1.0.0-alpha.1`, push that tag, monitor the check/deploy workflows, and confirm the public endpoint returns `versioning.json` plus the `MangaHere` bundle with HTTP 200.

- [ ] **Step 5: Hand off device testing**

Provide the stable repository URL and the exact checklist in `docs/verification/device-test.md`. Device acceptance is not claimed until the owner reports results for restored and newly searched titles.

---

## Final Verification Gate

Run from a clean checkout with Node.js 24:

```powershell
npm ci
npm run conformance
npm test
npm run bundle
git status --short
```

Expected: every command exits 0, tests report no failures, `bundles/versioning.json` lists only `MangaHere`, and the working tree is clean. Then verify the public development endpoint with an HTTP GET and wait for the owner's Paperback 0.9 device report before calling the release stable.
