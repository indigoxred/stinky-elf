/* oxlint-disable typescript/no-floating-promises -- node:test registers top-level tests. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ContentRating,
  DiscoverSectionType,
  SourceIntents,
  type Request,
  type SourceManga,
} from "@paperback/types";

import { MangaHere, MangaHereExtension } from "../../MangaHere/main.js";
import MangaHereConfig, {
  MangaHereConfig as NamedMangaHereConfig,
} from "../../MangaHere/pbconfig.js";
import {
  BULK_READER_HTML,
  CHAPTER_LIST_HTML,
  DIRECTORY_HTML,
  MANGA_DETAILS_HTML,
  SEARCH_HTML,
  TRADITIONAL_READER_HTML,
} from "../fixtures/mangahere.js";

async function withoutGlobalUrl<T>(operation: () => Promise<T>): Promise<T> {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "URL");
  Object.defineProperty(globalThis, "URL", { configurable: true, value: undefined });
  try {
    return await operation();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "URL", descriptor);
    else Reflect.deleteProperty(globalThis, "URL");
  }
}

async function withoutConsoleInfo<T>(operation: () => Promise<T>): Promise<T> {
  const descriptor = Object.getOwnPropertyDescriptor(console, "info");
  Object.defineProperty(console, "info", { configurable: true, value: undefined });
  try {
    return await operation();
  } finally {
    if (descriptor) Object.defineProperty(console, "info", descriptor);
    else Reflect.deleteProperty(console, "info");
  }
}

test("publishes the exact MangaHere source identity for restored libraries", () => {
  assert.equal(MangaHereConfig, NamedMangaHereConfig);
  assert.equal(MangaHereConfig.name, "MangaHere");
  assert.equal(MangaHereConfig.version, "1.0.0-alpha.7");
  assert.equal(MangaHereConfig.contentRating, ContentRating.MATURE);
  assert.deepEqual(MangaHereConfig.developers, [
    { name: "indigoxred", github: "https://github.com/indigoxred" },
  ]);
  assert.deepEqual(MangaHereConfig.capabilities, [
    SourceIntents.SEARCH_RESULT_PROVIDING,
    SourceIntents.CHAPTER_PROVIDING,
    SourceIntents.DISCOVER_SECTION_PROVIDING,
    SourceIntents.CLOUDFLARE_BYPASS_PROVIDING,
  ]);
});

test("exports a complete Paperback 0.9 source adapter", () => {
  for (const method of [
    "initialise",
    "getDiscoverSections",
    "getDiscoverSectionItems",
    "getSearchResults",
    "getMangaDetails",
    "getChapters",
    "getChapterDetails",
    "cloudflareBypassCompleted",
  ] as const) {
    assert.equal(typeof MangaHere[method], "function", `${method} should be implemented`);
  }
});

test("maps search results to legacy title ids and carries pagination", async () => {
  const requests: Request[] = [];
  const extension = new MangaHereExtension({
    requestText: async (request: Request) => {
      requests.push(request);
      return { status: 200, body: SEARCH_HTML };
    },
  });

  const result = await extension.getSearchResults(
    { title: "Class No Bocchi" },
    undefined,
    undefined,
  );

  assert.match(requests[0]?.url ?? "", /\/search\?title=Class%20No%20Bocchi&page=1$/);
  assert.deepEqual(result, {
    items: [
      {
        mangaId: "class_no_bocchi",
        title: "Class No Bocchi",
        imageUrl: "https://img.example/cover.jpg",
        subtitle: "Updated today",
        contentRating: ContentRating.MATURE,
      },
    ],
    metadata: { page: 2 },
  });
});

test("returns valid Popular and Latest cards without a global URL", async () => {
  const requests: Request[] = [];
  const extension = new MangaHereExtension({
    requestText: async (request: Request) => {
      requests.push(request);
      return { status: 200, body: DIRECTORY_HTML };
    },
  });

  const results = await withoutGlobalUrl(async () =>
    Promise.all(
      [
        { id: "popular", title: "Popular" },
        { id: "latest", title: "Latest Updates" },
      ].map((section) =>
        extension.getDiscoverSectionItems({
          ...section,
          type: DiscoverSectionType.simpleCarousel,
        }),
      ),
    ),
  );

  const expectedItems = [
    {
      type: "simpleCarouselItem",
      mangaId: "class_no_bocchi",
      title: "Class No Bocchi",
      imageUrl: "https://img.example/cover.jpg",
      subtitle: "Comedy",
      contentRating: ContentRating.MATURE,
    },
  ];
  assert.deepEqual(
    results.map((result) => result.items),
    [expectedItems, expectedItems],
  );
  assert.deepEqual(
    requests.map((request) => request.url),
    ["https://www.mangahere.cc/directory/1.htm", "https://www.mangahere.cc/directory/1.htm?latest"],
  );
});

test("maps title details and volume-qualified chapters onto the restored source", async () => {
  const extension = new MangaHereExtension({
    requestText: async (request: Request) => ({
      status: 200,
      body: request.url.includes("/manga/") ? MANGA_DETAILS_HTML : CHAPTER_LIST_HTML,
    }),
  });
  const sourceManga = await extension.getMangaDetails("class_no_bocchi");

  assert.equal(sourceManga.mangaId, "class_no_bocchi");
  assert.equal(sourceManga.mangaInfo.primaryTitle, "Class No Bocchi");
  assert.equal(sourceManga.mangaInfo.contentRating, ContentRating.MATURE);
  assert.deepEqual(sourceManga.mangaInfo.tagGroups?.[0]?.tags, [
    { id: "Comedy", title: "Comedy" },
    { id: "Martial%20Arts", title: "Martial Arts" },
  ]);

  const chapterExtension = new MangaHereExtension({
    requestText: async (_request: Request) => ({ status: 200, body: CHAPTER_LIST_HTML }),
  });
  const chapters = await chapterExtension.getChapters(sourceManga);
  assert.deepEqual(
    chapters.map((chapter) => ({
      chapterId: chapter.chapterId,
      chapNum: chapter.chapNum,
      volume: chapter.volume,
      sameSource: chapter.sourceManga === sourceManga,
    })),
    [
      { chapterId: "v01/c025", chapNum: 25, volume: 1, sameSource: true },
      { chapterId: "c024", chapNum: 24, volume: 0, sameSource: true },
    ],
  );
});

function sourceManga(): SourceManga {
  return {
    mangaId: "class_no_bocchi",
    mangaInfo: {
      thumbnailUrl: "https://img.example/cover.jpg",
      synopsis: "",
      primaryTitle: "Class No Bocchi",
      secondaryTitles: [],
      contentRating: ContentRating.MATURE,
    },
  };
}

test("returns bulk reader pages directly", async () => {
  const extension = new MangaHereExtension({
    requestText: async (_request: Request) => ({ status: 200, body: BULK_READER_HTML }),
  });

  assert.deepEqual(
    await extension.getChapterDetails({
      chapterId: "c025",
      sourceManga: sourceManga(),
      langCode: "en",
      chapNum: 25,
    }),
    {
      id: "c025",
      mangaId: "class_no_bocchi",
      pages: ["https://img.example/1.jpg", "https://img.example/2.jpg"],
    },
  );
});

test("decodes the inert reader key without loading untrusted HTML in a WebView", async () => {
  const resolverRequests: Request[] = [];
  const extension = new MangaHereExtension({
    requestText: async (request: Request) => {
      if (!request.url.includes("chapterfun.ashx")) {
        return { status: 200, body: TRADITIONAL_READER_HTML };
      }
      resolverRequests.push(request);
      const page = Number(new URL(request.url).searchParams.get("page"));
      return {
        status: 200,
        body: `pix='https://img.example/';pvalue=['${page}.jpg'];`,
      };
    },
    sleep: async (_seconds: number) => {},
    log: (_event: string, _details: Record<string, number | string>) => {},
  });

  const details = await extension.getChapterDetails({
    chapterId: "c025",
    sourceManga: sourceManga(),
    langCode: "en",
    chapNum: 25,
  });

  assert.deepEqual(
    resolverRequests.map((request) => {
      const url = new URL(request.url);
      return {
        cid: url.searchParams.get("cid"),
        page: url.searchParams.get("page"),
        key: url.searchParams.get("key"),
        referer: request.headers?.referer,
      };
    }),
    [1, 2, 3].map((page) => ({
      cid: "12345",
      page: String(page),
      key: "abcd",
      referer: `https://www.mangahere.cc/manga/class_no_bocchi/c025/${page}.html`,
    })),
  );
  assert.deepEqual(details, {
    id: "c025",
    mangaId: "class_no_bocchi",
    pages: ["https://img.example/1.jpg", "https://img.example/2.jpg", "https://img.example/3.jpg"],
  });
});

test("opens a traditional chapter in the Paperback runtime without a global URL", async () => {
  const extension = new MangaHereExtension({
    requestText: async (request: Request) => {
      if (!request.url.includes("chapterfun.ashx")) {
        return { status: 200, body: TRADITIONAL_READER_HTML };
      }
      const page = Number(/[?&]page=(\d+)/.exec(request.url)?.[1]);
      return {
        status: 200,
        body: `pix='https://img.example/chapters/';pvalue=['${page}.jpg'];`,
      };
    },
    sleep: async (_seconds: number) => {},
    log: (_event: string, _details: Record<string, number | string>) => {},
  });

  const details = await withoutGlobalUrl(() =>
    extension.getChapterDetails({
      chapterId: "c025",
      sourceManga: sourceManga(),
      langCode: "en",
      chapNum: 25,
    }),
  );

  assert.ok("pages" in details);
  assert.deepEqual(details.pages, [
    "https://img.example/chapters/1.jpg",
    "https://img.example/chapters/2.jpg",
    "https://img.example/chapters/3.jpg",
  ]);
});

test("opens a traditional chapter when the Paperback console has no info method", async () => {
  const extension = new MangaHereExtension({
    requestText: async (request: Request) => {
      if (!request.url.includes("chapterfun.ashx")) {
        return { status: 200, body: TRADITIONAL_READER_HTML };
      }
      const page = Number(/[?&]page=(\d+)/.exec(request.url)?.[1]);
      return {
        status: 200,
        body: `pix='https://img.example/chapters/';pvalue=['${page}.jpg'];`,
      };
    },
    sleep: async (_seconds: number) => {},
  });

  const details = await withoutConsoleInfo(() =>
    extension.getChapterDetails({
      chapterId: "c156",
      sourceManga: sourceManga(),
      langCode: "en",
      chapNum: 156,
    }),
  );

  assert.ok("pages" in details);
  assert.equal(details.pages.length, 3);
});
