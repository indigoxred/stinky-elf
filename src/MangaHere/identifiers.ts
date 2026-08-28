import { URL as PaperbackURL } from "@paperback/types";

import { BASE_URL, MANGAHERE_HOSTS } from "./constants.js";

const SAFE_SEGMENT = /^[A-Za-z0-9._~-]+$/;

export class InvalidMangaHereIdError extends Error {
  override readonly name = "InvalidMangaHereIdError";
}

function decodeSegment(segment: string): string {
  let decoded: string;

  try {
    decoded = decodeURIComponent(segment);
  } catch {
    throw new InvalidMangaHereIdError("Identifier contains invalid percent encoding");
  }

  if (decoded === "." || decoded === "..") {
    throw new InvalidMangaHereIdError("Identifier contains a traversal segment");
  }
  if (!SAFE_SEGMENT.test(decoded)) {
    throw new InvalidMangaHereIdError(`Identifier contains an invalid segment: ${decoded}`);
  }

  return decoded;
}

function relativePath(input: string): string {
  const fragmentIndex = input.indexOf("#");
  const withoutFragment = fragmentIndex >= 0 ? input.slice(0, fragmentIndex) : input;
  const queryIndex = withoutFragment.indexOf("?");
  return queryIndex >= 0 ? withoutFragment.slice(0, queryIndex) : withoutFragment;
}

function normalizedPathSegments(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) throw new InvalidMangaHereIdError("Identifier is empty");
  if (trimmed.includes("\\")) {
    throw new InvalidMangaHereIdError("Identifier contains a backslash");
  }

  const isAbsolute = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(trimmed);
  const isProtocolRelative = trimmed.startsWith("//");
  let path: string;

  if (isAbsolute || isProtocolRelative) {
    let parsed: PaperbackURL;
    try {
      parsed = new PaperbackURL(isProtocolRelative ? `https:${trimmed}` : trimmed);
    } catch {
      throw new InvalidMangaHereIdError("Identifier is not a valid URL");
    }

    if (!MANGAHERE_HOSTS.has(parsed.hostname.toLowerCase())) {
      throw new InvalidMangaHereIdError("Identifier uses a foreign host");
    }
    if (parsed.protocol !== "https" && parsed.protocol !== "http") {
      throw new InvalidMangaHereIdError("Identifier uses an unsupported protocol");
    }
    path = parsed.path;
  } else {
    path = relativePath(trimmed);
  }

  const rawSegments = path.split("/").filter((segment) => segment.length > 0);
  if (rawSegments.length === 0) throw new InvalidMangaHereIdError("Identifier has no path");
  return rawSegments.map(decodeSegment);
}

export function normalizeMangaId(input: string): string {
  const segments = normalizedPathSegments(input);
  if (segments[0]?.toLowerCase() === "manga") segments.shift();
  if (segments.length !== 1 || !segments[0]) {
    throw new InvalidMangaHereIdError("Title identifier must contain exactly one slug");
  }
  return segments[0];
}

function isCompatibleMangaAlias(storedTitle: string, embeddedTitle: string): boolean {
  return storedTitle.startsWith(`${embeddedTitle}_`) || embeddedTitle.startsWith(`${storedTitle}_`);
}

function normalizeChapterIdInternal(
  mangaId: string,
  input: string,
  allowCompatibleAlias: boolean,
): string {
  const title = normalizeMangaId(mangaId);
  const segments = normalizedPathSegments(input);

  if (segments.at(-1)?.toLowerCase() === "1.html") segments.pop();

  if (segments[0]?.toLowerCase() === "manga") {
    segments.shift();
    const embeddedTitle = segments.shift();
    if (
      embeddedTitle !== title &&
      (!allowCompatibleAlias || !embeddedTitle || !isCompatibleMangaAlias(title, embeddedTitle))
    ) {
      throw new InvalidMangaHereIdError("Chapter belongs to a different title");
    }
  } else if (segments.length > 1 && segments[0] === title) {
    segments.shift();
  }

  if (segments.length === 0) {
    throw new InvalidMangaHereIdError("Chapter identifier has no relative path");
  }
  return segments.join("/");
}

export function normalizeChapterId(mangaId: string, input: string): string {
  return normalizeChapterIdInternal(mangaId, input, false);
}

function encodePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function mangaUrl(mangaId: string): string {
  return `${BASE_URL}/manga/${encodePath(normalizeMangaId(mangaId))}/`;
}

export function chapterUrl(mangaId: string, chapterId: string): string {
  const title = normalizeMangaId(mangaId);
  const chapter = normalizeChapterId(title, chapterId);
  return `${BASE_URL}/manga/${encodePath(title)}/${encodePath(chapter)}/1.html`;
}

export function chapterIdFromHref(mangaId: string, href: string): string {
  return normalizeChapterIdInternal(mangaId, href, true);
}
