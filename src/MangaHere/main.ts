import {
  ContentRating,
  DiscoverSectionType,
  type Chapter,
  type ChapterDetails,
  type Cookie,
  type DiscoverSection,
  type DiscoverSectionItem,
  type ExtensionImpl,
  type Metadata,
  type PagedResults,
  type Request,
  type SearchQuery,
  type SearchResultItem,
  type SortingOption,
  type SourceManga,
} from "@paperback/types";

import { BASE_URL } from "./constants.js";
import { chapterUrl, mangaUrl, normalizeMangaId } from "./identifiers.js";
import { MangaHereNetwork, type MangaHereTextResponse } from "./network.js";
import {
  parseChapters,
  parseListings,
  parseMangaDetails,
  parsePageMetadata,
  parseReader,
} from "./parsers.js";
import { decodeKeyExpression } from "./packed.js";
import MangaHereConfig from "./pbconfig.js";
import { resolveTraditionalPages } from "./resolver.js";

type RequestText = (request: Request) => Promise<MangaHereTextResponse>;
type Sleep = (seconds: number) => Promise<void>;

export type MangaHereExtensionOptions = {
  requestText?: RequestText;
  sleep?: Sleep;
  initialiseNetwork?: () => void;
  now?: () => number;
  log?: (event: string, details: Record<string, number | string>) => void;
};

const network = new MangaHereNetwork();

function pageFromMetadata(metadata: Metadata | undefined): number {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) return 1;
  const page = (metadata as { page?: unknown }).page;
  return typeof page === "number" && Number.isInteger(page) && page > 0 ? page : 1;
}

function nextPageMetadata(html: string, page: number): Metadata | undefined {
  return parsePageMetadata(html).hasNextPage ? { page: page + 1 } : undefined;
}

function toSearchResult(item: ReturnType<typeof parseListings>[number]): SearchResultItem {
  const result: SearchResultItem = {
    mangaId: normalizeMangaId(item.mangaId),
    title: item.title,
    imageUrl: item.imageUrl,
    contentRating: ContentRating.MATURE,
  };
  if (item.subtitle) result.subtitle = item.subtitle;
  return result;
}

function toDiscoverItem(item: ReturnType<typeof parseListings>[number]): DiscoverSectionItem {
  const result: DiscoverSectionItem = {
    type: "simpleCarouselItem",
    mangaId: normalizeMangaId(item.mangaId),
    title: item.title,
    imageUrl: item.imageUrl,
    contentRating: ContentRating.MATURE,
  };
  if (item.subtitle) result.subtitle = item.subtitle;
  return result;
}

export class MangaHereExtension implements ExtensionImpl<typeof MangaHereConfig> {
  private readonly requestText: RequestText;
  private readonly sleep: Sleep;
  private readonly initialiseNetwork: () => void;
  private readonly now: () => number;
  private readonly log: (event: string, details: Record<string, number | string>) => void;

  constructor(options: MangaHereExtensionOptions = {}) {
    this.requestText = options.requestText ?? ((request) => network.requestText(request));
    this.sleep = options.sleep ?? ((seconds) => Application.sleep(seconds));
    this.initialiseNetwork = options.initialiseNetwork ?? (() => network.initialise());
    this.now = options.now ?? (() => Date.now());
    this.log = options.log ?? ((event, details) => console.log(event, JSON.stringify(details)));
  }

  async initialise(): Promise<void> {
    this.initialiseNetwork();
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    return [
      {
        id: "popular",
        title: "Popular",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "latest",
        title: "Latest Updates",
        type: DiscoverSectionType.simpleCarousel,
      },
    ];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata?: Metadata,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = pageFromMetadata(metadata);
    const suffix = section.id === "latest" ? "?latest" : "";
    const response = await this.load({
      url: `${BASE_URL}/directory/${page}.htm${suffix}`,
      method: "GET",
    });
    const result: PagedResults<DiscoverSectionItem> = {
      items: parseListings(response.body, "directory").map(toDiscoverItem),
    };
    const next = nextPageMetadata(response.body, page);
    if (next !== undefined) result.metadata = next;
    return result;
  }

  async getSearchResults(
    query: SearchQuery<Metadata>,
    metadata: Metadata | undefined,
    _sortingOption: SortingOption | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = pageFromMetadata(metadata);
    const response = await this.load({
      url: `${BASE_URL}/search?title=${encodeURIComponent(query.title)}&page=${page}`,
      method: "GET",
    });
    const result: PagedResults<SearchResultItem> = {
      items: parseListings(response.body, "search").map(toSearchResult),
    };
    const next = nextPageMetadata(response.body, page);
    if (next !== undefined) result.metadata = next;
    return result;
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const normalizedId = normalizeMangaId(mangaId);
    const response = await this.load({ url: mangaUrl(normalizedId), method: "GET" });
    const parsed = parseMangaDetails(response.body, normalizedId);

    return {
      mangaId: normalizedId,
      mangaInfo: {
        thumbnailUrl: parsed.thumbnailUrl,
        synopsis: parsed.synopsis,
        primaryTitle: parsed.title,
        secondaryTitles: [],
        contentRating: ContentRating.MATURE,
        status: parsed.status,
        author: parsed.author,
        shareUrl: mangaUrl(normalizedId),
        tagGroups: parsed.genres.length
          ? [
              {
                id: "genres",
                title: "Genres",
                tags: parsed.genres.map((genre) => ({
                  id: encodeURIComponent(genre),
                  title: genre,
                })),
              },
            ]
          : [],
      },
    };
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const normalizedId = normalizeMangaId(sourceManga.mangaId);
    const response = await this.load({ url: mangaUrl(normalizedId), method: "GET" });
    return parseChapters(response.body, normalizedId).map((chapter) => ({
      chapterId: chapter.chapterId,
      sourceManga,
      langCode: "en",
      chapNum: chapter.chapNum,
      volume: chapter.volume,
      title: chapter.title,
      publishDate: chapter.publishDate,
    }));
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const mangaId = normalizeMangaId(chapter.sourceManga.mangaId);
    const canonicalUrl = chapterUrl(mangaId, chapter.chapterId);
    const readerResponse = await this.load({ url: canonicalUrl, method: "GET" });
    const reader = parseReader(readerResponse.body, canonicalUrl);

    if (reader.mode === "bulk") {
      return { id: chapter.chapterId, mangaId, pages: reader.pages };
    }

    const started = this.now();
    let requestCount = 0;
    let retryCount = 0;
    let throttleCount = 0;
    const attempts = new Map<number, number>();
    const secretKey = decodeKeyExpression(reader.keyExpression);

    try {
      const pages = await resolveTraditionalPages(
        { ...reader, secretKey },
        async (page, key) => {
          requestCount += 1;
          const pageAttempts = (attempts.get(page) ?? 0) + 1;
          attempts.set(page, pageAttempts);
          if (pageAttempts > 1) retryCount += 1;

          const requestUrl =
            `${BASE_URL}/chapterfun.ashx?cid=${encodeURIComponent(reader.cid)}` +
            `&page=${page}&key=${encodeURIComponent(key)}`;
          const response = await this.requestText({
            url: requestUrl,
            method: "GET",
            headers: {
              accept: "*/*",
              referer: `${reader.pageBase}/${page}.html`,
              "x-requested-with": "XMLHttpRequest",
            },
          });
          if (response.status === 403 || response.status === 429) throttleCount += 1;
          return response;
        },
        this.sleep,
      );
      return { id: chapter.chapterId, mangaId, pages };
    } finally {
      this.log("MangaHere resolver", {
        chapterId: chapter.chapterId,
        pageCount: reader.pageCount,
        requestCount,
        retryCount,
        throttleCount,
        elapsedMs: this.now() - started,
      });
    }
  }

  getMangaShareUrl(mangaId: string): string {
    return mangaUrl(mangaId);
  }

  async cloudflareBypassCompleted(
    _request: Request,
    _cookies: Cookie[],
    _localStorage: Record<string, string>,
  ): Promise<void> {}

  private async load(request: Request): Promise<MangaHereTextResponse> {
    const response = await this.requestText(request);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`MangaHere request failed with HTTP ${response.status}`);
    }
    return response;
  }
}

export const MangaHere = new MangaHereExtension();
