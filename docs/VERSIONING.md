# Versioning and releases

This repository uses **calendar versioning (CalVer)** for product releases documented on GitHub and in [CHANGELOG.md](../CHANGELOG.md).

## Scheme

- **Format:** `YYYY.M.patch` (npm-compatible semver).
- **Marketing / Git tag:** `vYYYY.M.patch` — for example `v2026.4.0` for the **first** April snapshot, then `v2026.4.1` if you publish **another** snapshot the same calendar month (close-of-month, etc.). Within **May**, you might ship `v2026.5.0` mid-month and `v2026.5.1` at month end.
- **GitHub Release:** Each tag should have a matching **Release** on GitHub (the Releases page lists those; bare tags alone do not). Release notes mirror [CHANGELOG.md](../CHANGELOG.md).
- **Meaning:**
  - `YYYY` — year.
  - `M` — month number without leading zero (4 = April).
  - `patch` — `0` = first monthly baseline tag for ongoing work that month (plus historical convention); **`1`, `2`, …** = additional documented snapshots **in the same month** (month-close after a mid-month release, phased rollouts). Patches stay **semver-compatible** (`npm`).

The `version` field in [package.json](../package.json) reflects the **current release line** (typically the latest closed month or the in-progress month after updating the changelog).

## Monthly release process

1. **Freeze the changelog** — Move items from `[Unreleased]` in `CHANGELOG.md` into a new section `[YYYY.M.0] - YYYY-MM-DD` using the last day of the month (or today if you are cutting mid-month and naming it clearly).
2. **Bump `package.json`** — Set `"version"` to `YYYY.M.0` (or the appropriate patch).
3. **Tag the tree** — Create an **annotated** tag on the commit that should represent **that snapshot** (close-of-month, mid-month, etc.):

   ```bash
   git tag -a v2026.4.0 -m "Release 2026.4.0 (April 2026)"
   git push -u origin your-branch
   git push origin v2026.4.0
   ```

   `scripts/tag-monthly-release.sh` creates **`vYYYY.M.0`** only; for **`vYYYY.M.1`** and later use the same pattern with `-a v2026.4.1` and message text that states the snapshot (month-close, mid-month).

4. **GitHub Release** — Publish a release for the tag (UI: **Releases → Draft a new release**). Title example: `2026.4.0 (2026-04-30)`. Paste the new section from `CHANGELOG.md` as the description.

   With [GitHub CLI](https://cli.github.com/) (`gh`), after writing the notes to a file:

   ```bash
   gh release create v2026.4.0 --title "2026.4.0 (2026-04-30)" --notes-file ./release-notes.md
   ```

## Historical releases

Older tags (`v2025.3.0` … `v2026.4.0`) use the same naming scheme; see [CHANGELOG.md](../CHANGELOG.md) and **Releases** for the authoritative timeline (`2026.4.1`, `2026.5.x`, … add intra-month milestones when needed).

## Relation to in-app announcements

The application may show a release announcement driven by configuration such as `src/config/releaseAnnouncement.ts`. When you publish a version, align that constant with the same version string users should see, if applicable.

## Commits

Prefer [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, scopes) so future changelog sections can be generated or audited more easily.
