/* oxlint-disable typescript/no-floating-promises -- node:test registers top-level tests. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  PackedScriptError,
  extractBulkImageUrls,
  extractKeyExpression,
  extractResolvedImageUrl,
  unpackDeanEdwards,
} from "../../MangaHere/packed.js";
import {
  BULK_PACKED_SCRIPT,
  KEY_PACKED_SCRIPT,
  MALFORMED_PACKED_SCRIPT,
  PAGE_PACKED_SCRIPT,
} from "../fixtures/mangahere.js";

test("expands Dean-Edwards keyword tokens without eval", () => {
  assert.equal(
    unpackDeanEdwards(BULK_PACKED_SCRIPT),
    "newImgs=['//img.example/1.jpg','//img.example/2.jpg'];",
  );
});

test("returns already-unpacked scripts unchanged", () => {
  assert.equal(unpackDeanEdwards("const page = 1;"), "const page = 1;");
});

test("extracts ordered HTTPS bulk image URLs", () => {
  assert.deepEqual(extractBulkImageUrls(BULK_PACKED_SCRIPT), [
    "https://img.example/1.jpg",
    "https://img.example/2.jpg",
  ]);
});

test("extracts one resolved page URL from pix and pvalue", () => {
  assert.equal(extractResolvedImageUrl(PAGE_PACKED_SCRIPT), "https://img.example/003.jpg");
});

test("extracts the secret-key expression without evaluating it", () => {
  assert.equal(extractKeyExpression(KEY_PACKED_SCRIPT), "'ab'+'cd'");
});

test("rejects malformed Dean-Edwards wrappers", () => {
  assert.throws(() => unpackDeanEdwards(MALFORMED_PACKED_SCRIPT), PackedScriptError);
});

test("rejects a response without a resolved image URL", () => {
  assert.throws(
    () => extractResolvedImageUrl("pix='//img.example/';pvalue=[];"),
    /resolved image URL/i,
  );
});

test("rejects non-HTTP image URLs", () => {
  assert.throws(
    () => extractResolvedImageUrl("pix='javascript:';pvalue=['alert(1)'];"),
    /HTTP image URL/i,
  );
});
