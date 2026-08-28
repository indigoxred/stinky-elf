/* oxlint-disable typescript/no-floating-promises -- node:test registers top-level tests. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  InvalidMangaHereIdError,
  chapterIdFromHref,
  chapterUrl,
  mangaUrl,
  normalizeChapterId,
  normalizeMangaId,
} from "../../MangaHere/identifiers.js";

test("normalizes Netsky 0.8 title ids", () => {
  assert.equal(normalizeMangaId("class_no_bocchi"), "class_no_bocchi");
});

test("normalizes Paperback 0.9 title paths", () => {
  assert.equal(normalizeMangaId("manga/class_no_bocchi/"), "class_no_bocchi");
});

test("normalizes MangaHere title URLs", () => {
  assert.equal(
    normalizeMangaId("https://www.mangahere.cc/manga/class_no_bocchi/?source=library#details"),
    "class_no_bocchi",
  );
});

test("preserves simple legacy chapter ids", () => {
  assert.equal(normalizeChapterId("class_no_bocchi", "c025"), "c025");
});

test("preserves volume-qualified legacy chapter ids", () => {
  assert.equal(normalizeChapterId("class_no_bocchi", "v01/c025"), "v01/c025");
});

test("reduces title-prefixed chapter paths to legacy-relative ids", () => {
  assert.equal(
    normalizeChapterId("class_no_bocchi", "manga/class_no_bocchi/v01/c025/1.html"),
    "v01/c025",
  );
});

test("reduces absolute chapter URLs to legacy-relative ids", () => {
  assert.equal(
    normalizeChapterId(
      "class_no_bocchi",
      "https://www.mangahere.cc/manga/class_no_bocchi/c025/1.html?page=1",
    ),
    "c025",
  );
});

test("constructs canonical MangaHere URLs", () => {
  assert.equal(
    mangaUrl("manga/class_no_bocchi"),
    "https://www.mangahere.cc/manga/class_no_bocchi/",
  );
  assert.equal(
    chapterUrl("class_no_bocchi", "v01/c025"),
    "https://www.mangahere.cc/manga/class_no_bocchi/v01/c025/1.html",
  );
});

test("extracts complete relative chapter paths from hrefs", () => {
  assert.equal(
    chapterIdFromHref("class_no_bocchi", "/manga/class_no_bocchi/v01/c025/"),
    "v01/c025",
  );
});

test("rejects identifiers from foreign hosts", () => {
  assert.throws(
    () => normalizeMangaId("https://example.com/manga/class_no_bocchi"),
    InvalidMangaHereIdError,
  );
});

test("rejects chapter paths belonging to another title", () => {
  assert.throws(
    () => normalizeChapterId("class_no_bocchi", "manga/another_title/c001"),
    InvalidMangaHereIdError,
  );
});

test("rejects decoded traversal segments", () => {
  assert.throws(
    () => normalizeChapterId("class_no_bocchi", "v01/%2E%2E/c001"),
    InvalidMangaHereIdError,
  );
});
