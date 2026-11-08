import * as cheerio from "cheerio";
import { URL as PaperbackURL } from "@paperback/types";

import { BASE_URL } from "./constants.js";
import { chapterIdFromHref, normalizeMangaId } from "./identifiers.js";
import type { ParsedChapter, ParsedListing, ParsedManga, ReaderConfig } from "./models.js";
import { extractBulkImageUrls, extractKeyExpression } from "./packed.js";

const PACKED_MARKER = "function(p,a,c,k,e,d)";

export class MangaHereParseError extends Error {
  override readonly name = "MangaHereParseError";
}

function absoluteUrl(value: string | undefined): string {
  if (!value?.trim()) return "";

  try {
    const candidate = value.trim().startsWith("//") ? `https:${value.trim()}` : value.trim();
    const parsed = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(candidate)
      ? new PaperbackURL(candidate)
      : new PaperbackURL(BASE_URL).update(candidate);
    if (parsed.protocol !== "http" && parsed.protocol !== "https") return "";
    if (parsed.protocol === "http" && parsed.hostname.toLowerCase() === "fmcdn.mangahere.com") {
      parsed.setProtocol("https");
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

function optionalText(value: string): string | undefined {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

export function parseListings(html: string, mode: "search" | "directory"): ParsedListing[] {
  const $ = cheerio.load(html);
  const itemSelector = mode === "search" ? ".manga-list-4-list > li" : ".manga-list-1-list li";

  return $(itemSelector)
    .toArray()
    .flatMap((node): ParsedListing[] => {
      const item = $(node);
      const titleLink =
        mode === "search"
          ? item.find(".manga-list-4-item-title > a").first()
          : item.find("a").first();
      const href = titleLink.attr("href");
      const title = optionalText(titleLink.attr("title") ?? titleLink.text());
      if (!href || !title) return [];

      const subtitle = optionalText(
        item
          .find(mode === "search" ? ".manga-list-4-item-tip" : ".manga-list-1-item-subtitle")
          .first()
          .text(),
      );
      const listing: ParsedListing = {
        mangaId: normalizeMangaId(href),
        title,
        imageUrl: absoluteUrl(item.find("img").first().attr("src")),
      };
      if (subtitle) listing.subtitle = subtitle;
      return [listing];
    });
}

function normalizeStatus(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim().toLowerCase();
  if (normalized.includes("complete")) return "Completed";
  if (normalized.includes("ongoing")) return "Ongoing";
  return "Unknown";
}

export function parseMangaDetails(html: string, mangaId: string): ParsedManga {
  const $ = cheerio.load(html);
  const fallbackTitle = normalizeMangaId(mangaId).replace(/[_-]+/g, " ");
  const author = optionalText($(".detail-info-right-say > a").first().text());
  const parsed: ParsedManga = {
    title: optionalText($(".detail-info-right-title-font").first().text()) ?? fallbackTitle,
    thumbnailUrl: absoluteUrl($("img.detail-info-cover-img").first().attr("src")),
    synopsis: optionalText($(".fullcontent").first().text()) ?? "",
    status: normalizeStatus($(".detail-info-right-title-tip").first().text()),
    genres: $(".detail-info-right-tag-list > a")
      .toArray()
      .flatMap((node) => optionalText($(node).text()) ?? []),
  };
  if (author) parsed.author = author;
  return parsed;
}

function numberFromChapterPath(chapterId: string, prefix: "c" | "v"): number {
  const match = chapterId.match(new RegExp(`(?:^|/)${prefix}(\\d+(?:\\.\\d+)?)`, "i"));
  const value = Number(match?.[1]);
  return Number.isFinite(value) ? value : 0;
}

function parsePublishDate(value: string): Date {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (/^yesterday$/i.test(normalized)) {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date;
  }
  if (/^today$/i.test(normalized)) return new Date();

  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? new Date(0) : new Date(timestamp);
}

export function parseChapters(html: string, mangaId: string): ParsedChapter[] {
  const $ = cheerio.load(html);
  const primary = $("ul.detail-main-list > li");
  const items = primary.length > 0 ? primary : $("#chapterlist ul li");

  return items.toArray().flatMap((node): ParsedChapter[] => {
    const item = $(node);
    const link = item.find("a").first();
    const href = link.attr("href");
    if (!href) return [];

    const chapterId = chapterIdFromHref(mangaId, href);
    return [
      {
        chapterId,
        title: optionalText(item.find("p.title3").first().text()) ?? chapterId,
        chapNum: numberFromChapterPath(chapterId, "c"),
        volume: numberFromChapterPath(chapterId, "v"),
        publishDate: parsePublishDate(item.find("p.title2").first().text()),
      },
    ];
  });
}

export function parsePageMetadata(html: string): { hasNextPage: boolean } {
  const $ = cheerio.load(html);
  const anchors = $(".pager-list-left a").toArray();
  const numbered = anchors.flatMap((node) => {
    const page = Number(optionalText($(node).text()));
    return Number.isInteger(page) && page > 0 ? [page] : [];
  });
  if (numbered.length === 0) return { hasNextPage: false };

  const activeNode = $(".pager-list-left a.active").first();
  const active = Number(optionalText(activeNode.text())) || Math.min(...numbered);
  return { hasNextPage: Math.max(...numbered) > active };
}

function scriptBodies(html: string): string[] {
  const $ = cheerio.load(html);
  return $("script")
    .toArray()
    .map((node) => $(node).html() ?? "");
}

function readerPageBase(chapterUrl: string): string {
  let parsed: PaperbackURL;
  try {
    parsed = new PaperbackURL(chapterUrl);
  } catch {
    throw new MangaHereParseError("Reader chapter URL is invalid");
  }
  if (!/\/1\.html$/i.test(parsed.path)) {
    throw new MangaHereParseError("Reader chapter URL does not end in 1.html");
  }

  parsed.setPath(parsed.path.replace(/\/1\.html$/i, ""));
  parsed.setQueryItems(undefined);
  parsed.fragment = undefined;
  return parsed.toString();
}

export function parseReader(html: string, chapterUrl: string): ReaderConfig {
  const $ = cheerio.load(html);
  const scripts = scriptBodies(html);
  const isBulk = $("script[src]")
    .toArray()
    .some((node) => ($(node).attr("src") ?? "").includes("chapter_bar"));

  if (isBulk) {
    const packedPages = scripts.find(
      (script) => script.includes(PACKED_MARKER) && script.includes("newImgs"),
    );
    if (!packedPages) throw new MangaHereParseError("Bulk reader is missing page script");
    return { mode: "bulk", pages: extractBulkImageUrls(packedPages) };
  }

  const cid = html.match(/\bchapterid\s*=\s*['"]?(\d+)/i)?.[1];
  if (!cid) throw new MangaHereParseError("Traditional reader is missing chapter id");

  const pageCount = Math.max(
    0,
    ...$(".pager-list-left a")
      .toArray()
      .flatMap((node) => {
        const page = Number($(node).attr("data-page") ?? optionalText($(node).text()));
        return Number.isInteger(page) && page > 0 ? [page] : [];
      }),
  );
  if (pageCount < 1) throw new MangaHereParseError("Traditional reader is missing page count");

  const keyScript = scripts.find((script) => script.includes(PACKED_MARKER));
  if (!keyScript) throw new MangaHereParseError("Traditional reader is missing key script");

  return {
    mode: "traditional",
    cid,
    pageCount,
    pageBase: readerPageBase(chapterUrl),
    chapterUrl,
    keyExpression: extractKeyExpression(keyScript),
  };
}
