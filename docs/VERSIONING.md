# Versioning and releases

This repository uses **calendar versioning (CalVer)** for product releases documented on GitHub and in [CHANGELOG.md](../CHANGELOG.md).

## Scheme

- **Format:** `YYYY.M.patch` (npm-compatible semver).
- **Marketing / Git tag:** `vYYYY.M.0` for the monthly baseline (for example `v2026.4.0`).
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

4. **GitHub Release** — From the repository **Releases** page, choose “Draft a new release”, select the tag, title `YYYY.M.0 — Month YYYY`, and paste the corresponding section from `CHANGELOG.md` as the description.

## Historical tags

Tags `v2025.3.0` … `v2026.4.0` point to month-end snapshots (or month-to-date for the current period) so the history is navigable even before GitHub Releases were curated.

## Relation to in-app announcements

The application may show a release announcement driven by configuration such as `src/config/releaseAnnouncement.ts`. When you publish a version, align that constant with the same version string users should see, if applicable.

## Commits

Prefer [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, scopes) so future changelog sections can be generated or audited more easily.
