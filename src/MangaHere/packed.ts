const PACKED_MARKER = "function(p,a,c,k,e,d)";
const PACKED_ARGUMENTS =
  /\}\s*\(\s*'((?:\\.|[^'])*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'((?:\\.|[^'])*)'\s*\.split\(\s*'\|'\s*\)/;

export class PackedScriptError extends Error {
  override readonly name = "PackedScriptError";
}

function unescapePackedPayload(payload: string): string {
  return payload
    .replace(/\\r/g, "\r")
    .replace(/\\n/g, "\n")
    .replace(/\\(['"\\])/g, "$1");
}

function encodeToken(value: number, radix: number): string {
  const prefix = value < radix ? "" : encodeToken(Math.floor(value / radix), radix);
  const remainder = value % radix;
  const character =
    remainder > 35 ? String.fromCharCode(remainder + 29) : remainder.toString(36);
  return prefix + character;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function unpackDeanEdwards(source: string): string {
  if (!source.includes(PACKED_MARKER)) return source;

  const match = source.match(PACKED_ARGUMENTS);
  if (!match?.[1] || !match[2] || !match[3] || match[4] === undefined) {
    throw new PackedScriptError("Malformed Dean-Edwards wrapper");
  }

  let payload = unescapePackedPayload(match[1]);
  const radix = Number(match[2]);
  const count = Number(match[3]);
  const keywords = match[4].split("|");
  if (!Number.isInteger(radix) || radix < 2 || radix > 62 || !Number.isInteger(count)) {
    throw new PackedScriptError("Dean-Edwards wrapper has invalid numeric arguments");
  }

  for (let index = count - 1; index >= 0; index -= 1) {
    const keyword = keywords[index];
    if (!keyword) continue;
    const token = encodeToken(index, radix);
    payload = payload.replace(new RegExp(`\\b${escapeRegex(token)}\\b`, "g"), keyword);
  }

  return payload;
}

function normalizeHttpImageUrl(value: string): string {
  const candidate = value.startsWith("//") ? `https:${value}` : value;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new PackedScriptError("Reader did not produce a valid HTTP image URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new PackedScriptError("Reader did not produce an HTTP image URL");
  }
  return parsed.href;
}

export function extractBulkImageUrls(source: string): string[] {
  const unpacked = unpackDeanEdwards(source);
  const array = unpacked.match(/\bnewImgs\s*=\s*\[([\s\S]*?)\]\s*;/)?.[1];
  if (array === undefined) throw new PackedScriptError("Reader did not contain newImgs");

  const pages = Array.from(array.matchAll(/['"]([^'"]+)['"]/g), (match) =>
    normalizeHttpImageUrl(match[1] ?? ""),
  );
  if (pages.length === 0) throw new PackedScriptError("Reader did not contain bulk image URLs");
  return pages;
}

export function extractResolvedImageUrl(source: string): string {
  const unpacked = unpackDeanEdwards(source);
  const base = unpacked.match(/\bpix\s*=\s*['"]([^'"]+)['"]/)?.[1];
  const image = unpacked.match(/\bpvalue\s*=\s*\[\s*['"]([^'"]+)['"]/)?.[1];
  if (!base || !image) {
    throw new PackedScriptError("Reader response did not contain a resolved image URL");
  }

  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(image) || image.startsWith("//")) {
    return normalizeHttpImageUrl(image);
  }

  const normalizedBase = normalizeHttpImageUrl(base);
  return normalizeHttpImageUrl(new URL(image, normalizedBase).href);
}

export function extractKeyExpression(source: string): string {
  const unpacked = unpackDeanEdwards(source);
  const assignment = unpacked.match(
    /\b(?:var\s+)?(?:key|secretKey|guidkey)\s*=\s*([^;]+)\s*;/i,
  )?.[1];
  if (assignment?.trim()) return assignment.trim();

  const firstQuote = unpacked.search(/['"]/);
  const semicolon = firstQuote >= 0 ? unpacked.indexOf(";", firstQuote) : -1;
  if (firstQuote >= 0 && semicolon > firstQuote) {
    return unpacked.slice(firstQuote, semicolon).trim();
  }
  throw new PackedScriptError("Reader did not contain a secret-key expression");
}
