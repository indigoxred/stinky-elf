import { URL as PaperbackURL } from "@paperback/types";

const PACKED_MARKER = "function(p,a,c,k,e,d)";
const PACKED_ARGUMENTS =
  /\}\s*\(\s*'((?:\\.|[^'])*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'((?:\\.|[^'])*)'\s*\.split\(\s*'\|'\s*\)/;
const MAX_PACKED_KEYWORDS = 2048;

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
  const character = remainder > 35 ? String.fromCharCode(remainder + 29) : remainder.toString(36);
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
  if (count < 0 || count > MAX_PACKED_KEYWORDS || count !== keywords.length) {
    throw new PackedScriptError("Dean-Edwards wrapper has an invalid keyword count");
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
  let parsed: PaperbackURL;
  try {
    parsed = new PaperbackURL(candidate);
  } catch {
    throw new PackedScriptError("Reader did not produce a valid HTTP image URL");
  }
  if (parsed.protocol !== "https" && parsed.protocol !== "http") {
    throw new PackedScriptError("Reader did not produce an HTTP image URL");
  }
  return parsed.toString();
}

export function extractBulkImageUrls(source: string): string[] {
  const unpacked = unpackDeanEdwards(source);
  const array = unpacked.match(/\bnewImgs\s*=\s*\[([\s\S]*?)\]\s*;/)?.[1];
  if (array === undefined) throw new PackedScriptError("Reader did not contain newImgs");

  const pages = Array.from(array.matchAll(/['"]([^'"]+)['"]/g), (match) =>
    normalizeHttpImageUrl(match[1] ?? ""),
  );
  if (pages.length === 0) throw new PackedScriptError("Reader did not contain bulk image URLs");
  if (new Set(pages).size !== pages.length) {
    throw new PackedScriptError("Reader contained a duplicate bulk image URL");
  }
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
  const parsedBase = new PaperbackURL(normalizedBase);
  const directory = parsedBase.path.endsWith("/")
    ? parsedBase.path
    : parsedBase.path.replace(/[^/]*$/, "");
  parsedBase.update(image.startsWith("/") ? image : `${directory}${image}`);
  return normalizeHttpImageUrl(parsedBase.toString());
}

export function extractKeyExpression(source: string): string {
  const unpacked = unpackDeanEdwards(source);
  const assignment = unpacked.match(
    /\b(?:var\s+)?(?:key|secretKey|guidkey)\s*=\s*([^;]+)\s*;/i,
  )?.[1];
  if (assignment?.trim()) return assignment.trim();
  throw new PackedScriptError("Reader did not contain a secret-key expression");
}

function decodeEscape(expression: string, cursor: number): { value: string; cursor: number } {
  const escape = expression[cursor];
  if (escape === undefined) throw new PackedScriptError("Reader key ended in an escape");

  const simple: Record<string, string> = {
    "0": "\0",
    b: "\b",
    f: "\f",
    n: "\n",
    r: "\r",
    t: "\t",
    v: "\v",
    "\\": "\\",
    "'": "'",
    '"': '"',
  };
  if (simple[escape] !== undefined) return { value: simple[escape], cursor: cursor + 1 };

  const widths: Record<string, number> = { x: 2, u: 4 };
  const width = widths[escape];
  if (width !== undefined) {
    const digits = expression.slice(cursor + 1, cursor + 1 + width);
    if (digits.length !== width || !/^[\dA-Fa-f]+$/.test(digits)) {
      throw new PackedScriptError("Reader key contained an invalid hexadecimal escape");
    }
    return { value: String.fromCharCode(Number.parseInt(digits, 16)), cursor: cursor + 1 + width };
  }

  throw new PackedScriptError("Reader key contained an unsupported escape");
}

export function decodeKeyExpression(expression: string): string {
  let cursor = 0;
  let key = "";
  let expectLiteral = true;

  while (cursor < expression.length) {
    while (/\s/.test(expression[cursor] ?? "")) cursor += 1;
    if (cursor >= expression.length) break;

    if (!expectLiteral) {
      if (expression[cursor] !== "+") {
        throw new PackedScriptError("Reader key was not a safe string literal expression");
      }
      cursor += 1;
      expectLiteral = true;
      continue;
    }

    const quote = expression[cursor];
    if (quote !== "'" && quote !== '"') {
      throw new PackedScriptError("Reader key was not a safe string literal expression");
    }
    cursor += 1;
    let closed = false;
    while (cursor < expression.length) {
      const character = expression[cursor];
      if (character === quote) {
        cursor += 1;
        closed = true;
        break;
      }
      if (character === "\\") {
        const decoded = decodeEscape(expression, cursor + 1);
        key += decoded.value;
        cursor = decoded.cursor;
        continue;
      }
      key += character;
      cursor += 1;
    }
    if (!closed) throw new PackedScriptError("Reader key contained an unterminated string");
    expectLiteral = false;
  }

  if (expectLiteral || !key) {
    throw new PackedScriptError("Reader key was not a safe string literal expression");
  }
  return key;
}
