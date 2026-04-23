# Versioning and releases

This repository uses **calendar versioning (CalVer)** for product releases documented on GitHub and in [CHANGELOG.md](../CHANGELOG.md).

## Scheme

- **Format:** `YYYY.M.patch` (npm-compatible semver).
- **Marketing / Git tag:** `vYYYY.M.0` for the monthly baseline (for example `v2026.4.0`).
- **GitHub Release:** Each tag should have a matching **Release** on GitHub (the Releases page lists those; bare tags alone do not). Releases for `v2025.3.0` … `v2026.4.0` are published and use the same notes as [CHANGELOG.md](../CHANGELOG.md).
- **Meaning:**
  - `YYYY` — year.
  - `M` — month number without leading zero (4 = April).
  - `patch` — optional corrections during that month (documentation-only hotfixes, cherry-picks). Most monthly snapshots stay at `.0`.

The `version` field in [package.json](../package.json) reflects the **current release line** (typically the latest closed month or the in-progress month after updating the changelog).

## Monthly release process

1. **Freeze the changelog** — Move items from `[Unreleased]` in `CHANGELOG.md` into a new section `[YYYY.M.0] - YYYY-MM-DD` using the last day of the month (or today if you are cutting mid-month and naming it clearly).
2. **Bump `package.json`** — Set `"version"` to `YYYY.M.0` (or the appropriate patch).
3. **Tag the tree** — Create an annotated tag on the commit that should represent that month (usually the last commit merged in that month):

   ```bash
   git tag -a v2026.4.0 -m "Release 2026.4.0 (April 2026)"
   git push -u origin your-branch
   git push origin v2026.4.0
   ```

4. **GitHub Release** — Publish a release for the tag (UI: **Releases → Draft a new release**). Title example: `2026.4.0 (2026-04-30)`. Paste the new section from `CHANGELOG.md` as the description.

   With [GitHub CLI](https://cli.github.com/) (`gh`), after writing the notes to a file:

   ```bash
   gh release create v2026.4.0 --title "2026.4.0 (2026-04-30)" --notes-file ./release-notes.md
   ```

## Historical releases

Tags `v2025.3.0` … `v2026.4.0` point to month-end snapshots (April 2026 is month-to-date where noted in the changelog). Each has a **GitHub Release** so the timeline is visible under **Releases**.

## Relation to in-app announcements

The application may show a release announcement driven by configuration such as `src/config/releaseAnnouncement.ts`. When you publish a version, align that constant with the same version string users should see, if applicable.

## Commits

Prefer [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, scopes) so future changelog sections can be generated or audited more easily.
