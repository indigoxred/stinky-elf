# Paperback 0.9 Device Acceptance Checklist

Record the extension commit and source version before testing.

## Repository and source identity

- [ ] Add the repository URL to Paperback 0.9.
- [ ] Confirm the installed source ID/name is exactly `MangaHere`.
- [ ] Confirm the source is visible when Mature extensions are enabled.
- [ ] Confirm the source icon is the owner-supplied elf image.

## Restored Paperback 0.8 library title

- [ ] Open one title restored from a Paperback 0.8 backup without changing its source record.
- [ ] Confirm the missing-source error disappears after installing this source.
- [ ] Refresh title details successfully.
- [ ] Refresh the chapter list successfully.
- [ ] Confirm the restored title remains in its existing library collections.
- [ ] Open one legacy chapter whose ID is `cNNN`.
- [ ] If available, open one legacy volume-qualified chapter whose ID is `vNN/cNNN`.

## Newly searched title

- [ ] Search for a known MangaHere title.
- [ ] Add/open the result and confirm cover, title, synopsis, author, status, and genres.
- [ ] Confirm chapter numbers and volume numbers are sensible.
- [ ] Confirm pagination can load another search or directory page.

## Reader correctness

- [ ] Open one bulk-reader chapter and confirm every page loads.
- [ ] Open one traditional-reader chapter with roughly 20–40 pages.
- [ ] Confirm no page is missing.
- [ ] Confirm no page appears twice.
- [ ] Confirm pages remain in source order.
- [ ] Confirm a failed page does not leave a partially readable chapter.
- [ ] If Paperback exposes logs, record `pageCount`, `requestCount`, `retryCount`,
      `throttleCount`, and `elapsedMs` from the single `MangaHere resolver` line.

## Performance and throttling

- [ ] Open the selected traditional chapter once using the diagnostic width-one bundle.
- [ ] Record complete resolver time and verify all pages.
- [ ] Reinstall/refresh the width-three bundle and open the same chapter once.
- [ ] Record complete resolver time and verify all pages.
- [ ] Stop repeated performance requests if any HTTP 403 or 429 is observed.
- [ ] Confirm the shipping build falls back to sequential requests after throttling.

## Update path

- [ ] Publish a later development version to the unchanged repository URL.
- [ ] Refresh repositories in Paperback.
- [ ] Confirm the source update is offered without removing/re-adding the repository.
- [ ] Confirm the restored and newly searched titles still open after updating.

## Result record

Record:

- Device and iOS version:
- Paperback version:
- Extension version/commit:
- Restored title:
- New title:
- Bulk chapter:
- Traditional chapter:
- Width-one elapsed time:
- Width-three elapsed time:
- Retry/throttle observations:
- Missing/duplicate/order outcome:
- Pass/fail and notes:
