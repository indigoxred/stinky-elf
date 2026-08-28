# MangaHere Live Compatibility Check — 2026-08-28

These read-only checks exercised the production parsers against the current MangaHere website.
They did not download image bodies.

## Results

| Surface | URL | Result |
| --- | --- | --- |
| Directory | `https://www.mangahere.cc/directory/1.htm` | HTTP 200; 70 listings parsed; next-page metadata detected |
| Search | `https://www.mangahere.cc/search?title=one%20piece&page=1` | HTTP 200; 12 listings parsed; `one_piece` was the first stable ID; next-page metadata detected |
| Title | `https://www.mangahere.cc/manga/onepunch_man/` | HTTP 200; title, cover, synopsis, status, six genres, author, and 418 chapters parsed |
| Traditional reader | `https://www.mangahere.cc/manga/onepunch_man/c237/1.html` | HTTP 200; reader mode `traditional`; 23 pages; chapter ID `c237` |

The first traditional-reader batch was probed at concurrency width three. All three resolver
requests returned HTTP 200 in 348 ms total, with no HTTP 403 or 429. The responses decoded in
source order to page filename suffixes `001.jpg`, `002.jpg`, and `003.jpg` on MangaHere's image
CDN. Only the small obfuscation responses were fetched.

After the security review removed all WebView evaluation, the same live chapter was checked again
through the strict inert-string decoder. It decoded a 16-character key, and a width-three probe
returned three unique ordered pages with HTTP 200 in 184 ms. This second result is also a bounded
connectivity observation, not a device benchmark.

## Interpretation

- The live directory, search, title, chapter, and traditional-reader markup still matches the
  implemented selectors and decoder.
- The live reader still requires a separate `chapterfun.ashx` resolver request per page.
- Width-three concurrency works against the current endpoint and preserves the page indices in
  this bounded probe.
- The current reader key can be decoded without executing the source document or arbitrary
  JavaScript.
- The 348 ms result is a connectivity check, not an end-to-end device benchmark.
- Full-page completeness, duplicate detection, visual ordering, Cloudflare handoff, and restored
  Paperback 0.8 library attachment remain on-device acceptance checks.

See [the device acceptance checklist](device-test.md) for the remaining tests.
