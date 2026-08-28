# Paperback Runtime URL Fix — 2026-08-28

## Device symptoms

- Discover sections reported `Could not convert JSValue: Invalid URL:`.
- Opening a restored MangaHere chapter reported `Reader chapter URL is invalid`.

## Root cause

The extension used Node's global `URL` class. Paperback 0.9 extensions instead use the `URL`
implementation exported by `@paperback/types`. The Node test environment supplied the missing
global and hid the runtime incompatibility.

## Regression coverage

Two adapter tests remove `globalThis.URL` before calling the real extension:

- discovery must return a valid MangaHere cover URL;
- a traditional chapter must return its complete ordered page list.

Both tests failed before the production change with the same code paths seen on device and pass
after importing and using Paperback's URL implementation.

## Live smoke check

With `globalThis.URL` deliberately unavailable, the compiled adapter returned:

- Popular: 70 valid items;
- Latest Updates: 70 valid items;
- Onepunch-Man chapter 237: 23 unique ordered page URLs.

The smoke test requested only HTML and resolver responses; it did not download image bodies.
