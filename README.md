# MangaHere for Paperback 0.9

Private source repository for an independently implemented MangaHere extension owned by
`indigoxred`.

The source ID and named export are exactly `MangaHere`. Title IDs remain legacy slugs such as
`class_no_bocchi`, and chapter IDs remain legacy-relative paths such as `c025` or `v01/c025`.
Those identity rules are intended to let titles restored from Netsky's Paperback 0.8 MangaHere
source reconnect when this 0.9 source is installed.

## Install

The planned development repository URL is:

```text
https://indigoxred.github.io/mangahere-paperback/0.9/stable/
```

The URL will work only after the private repository's deployment workflow succeeds and GitHub
Pages is available for the owner's plan. Do not make the source repository public merely to
enable Pages.

In Paperback 0.9:

1. Enable Mature extensions for the active profile.
2. Open **Settings → Extensions → Add Repository**.
3. Paste the repository URL above.
4. Install **MangaHere**.
5. Open a restored MangaHere title and refresh its details and chapters.

If a restored title still shows a missing-source error, confirm that the installed source name is
exactly `MangaHere`, then restart Paperback and refresh that title again.

## Reader performance

MangaHere's traditional reader exposes each page URL through a separate `chapterfun.ashx`
request. This extension resolves up to three pages concurrently while retaining source order. It
retries bounded transient failures, falls back to sequential requests after HTTP 403 or 429, and
rejects the complete chapter if even one page remains unresolved. It never returns a partial page
array or accepts duplicate page URLs.

Bulk-reader chapters return their embedded image list directly.

The reader key is decoded only from a strict concatenation of inert string literals. MangaHere's
HTML and scripts are never executed in a WebView, and malformed or oversized packed scripts fail
closed.

## Privacy and ownership

- The source repository is private and belongs only to `indigoxred`.
- It is not a fork and carries no third-party Git history.
- The extension contains no credentials, access tokens, or durable bypass logic.
- Cloudflare challenges are handed to Paperback's supported bypass flow.
- If GitHub Pages is used, the compiled extension bundle and icon are necessarily accessible at
  the unlisted install URL even though the source repository remains private.

## Development

Requirements:

- Node.js 24
- pnpm 11.19.0

Install and verify:

```powershell
pnpm install --frozen-lockfile
pnpm run conformance
pnpm test
pnpm run test:paperback
pnpm run bundle
```

The bundle command writes the installable repository to `bundles/`. A valid build contains only
the `MangaHere` source in `bundles/versioning.json`.

For on-device development, run `pnpm run serve`, add the displayed local repository URL in
Paperback, and follow [the device checklist](docs/verification/device-test.md).

## Versioning

Development builds use prerelease versions such as `1.0.0-alpha.1`. Keep the source folder, named
export, and source ID unchanged across updates so restored library records remain attached.
