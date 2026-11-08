/* oxlint-disable typescript/no-floating-promises -- node:test registers top-level tests. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  MangaHereParseError,
  parseChapters,
  parseListings,
  parseMangaDetails,
  parsePageMetadata,
  parseReader,
} from "../../MangaHere/parsers.js";
import {
  BULK_READER_HTML,
  CHAPTER_LIST_HTML,
  CHAPTER_URL,
  DIRECTORY_HTML,
  MANGA_DETAILS_HTML,
  SEARCH_HTML,
  TRADITIONAL_READER_HTML,
} from "../fixtures/mangahere.js";

test("parses search listings with legacy title ids", () => {
  assert.deepEqual(parseListings(SEARCH_HTML, "search"), [
    {
      mangaId: "class_no_bocchi",
      title: "Class No Bocchi",
      imageUrl: "https://img.example/cover.jpg",
      subtitle: "Updated today",
    },
  ]);
});

test("parses directory listings with legacy title ids", () => {
  assert.deepEqual(parseListings(DIRECTORY_HTML, "directory"), [
    {
      mangaId: "class_no_bocchi",
      title: "Class No Bocchi",
      imageUrl: "https://img.example/cover.jpg",
      subtitle: "Comedy",
    },
  ]);
});

test("parses title metadata", () => {
  assert.deepEqual(parseMangaDetails(MANGA_DETAILS_HTML, "class_no_bocchi"), {
    title: "Class No Bocchi",
    thumbnailUrl: "https://img.example/cover.jpg",
    synopsis: "A sanitized synopsis.",
    author: "Example Author",
    status: "Completed",
    genres: ["Comedy", "Martial Arts"],
  });
});

test("returns HTTPS cover URLs when MangaHere serves HTTP CDN links", () => {
  const sourceUrl =
    "http://fmcdn.mangahere.com/store/manga/11912/cover.jpg?token=example&ttl=1794211200";
  const expectedUrl =
    "https://fmcdn.mangahere.com/store/manga/11912/cover.jpg?token=example&ttl=1794211200";

  const search = SEARCH_HTML.replace("//img.example/cover.jpg", sourceUrl.replaceAll("&", "&amp;"));
  const details = MANGA_DETAILS_HTML.replace(
    "//img.example/cover.jpg",
    sourceUrl.replaceAll("&", "&amp;"),
  );

  assert.equal(parseListings(search, "search")[0]?.imageUrl, expectedUrl);
  assert.equal(parseMangaDetails(details, "class_no_bocchi").thumbnailUrl, expectedUrl);
});

test("preserves complete legacy-relative chapter paths", () => {
  const chapters = parseChapters(CHAPTER_LIST_HTML, "class_no_bocchi");
  assert.deepEqual(
    chapters.map((chapter) => chapter.chapterId),
    ["v01/c025", "c024"],
  );
  assert.deepEqual(
    chapters.map(({ chapNum, volume }) => ({ chapNum, volume })),
    [
      { chapNum: 25, volume: 1 },
      { chapNum: 24, volume: 0 },
    ],
  );
  assert.equal(chapters[0]?.publishDate.getFullYear(), 2026);
});

test("parses current chapter links for a restored Netsky 0.8 title alias", () => {
  const current = "a_sword_master_childhood_friend_power_harassed_me_harshly";
  const legacy = `${current}_so_i_broke_off_our_relationship_and_make_a`;
  const html = CHAPTER_LIST_HTML.replaceAll("class_no_bocchi", current).replace(
    "v01/c025",
    "c029.3",
  );

  const chapters = parseChapters(html, legacy);

  assert.deepEqual(
    chapters.map((chapter) => chapter.chapterId),
    ["c029.3", "c024"],
  );
});

test("detects another listing page", () => {
  assert.deepEqual(parsePageMetadata(SEARCH_HTML), { hasNextPage: true });
  assert.deepEqual(parsePageMetadata(DIRECTORY_HTML), { hasNextPage: false });
});

test("parses bulk reader pages", () => {
  assert.deepEqual(parseReader(BULK_READER_HTML, CHAPTER_URL), {
    mode: "bulk",
    pages: ["https://img.example/1.jpg", "https://img.example/2.jpg"],
  });
});

test("parses traditional reader configuration", () => {
  assert.deepEqual(parseReader(TRADITIONAL_READER_HTML, CHAPTER_URL), {
    mode: "traditional",
    cid: "12345",
    pageCount: 3,
    pageBase: "https://www.mangahere.cc/manga/class_no_bocchi/c025",
    chapterUrl: CHAPTER_URL,
    keyExpression: "'ab'+'cd'",
  });
});

test("rejects traditional readers without a chapter id", () => {
  assert.throws(
    () => parseReader(TRADITIONAL_READER_HTML.replace("chapterid", "chapter"), CHAPTER_URL),
    (error: unknown) => error instanceof MangaHereParseError && /chapter id/i.test(error.message),
  );
});
