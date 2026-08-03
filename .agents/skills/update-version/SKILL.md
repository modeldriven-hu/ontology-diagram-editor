---
name: update-version
description: Update this repository's extension version consistently across package.json, package-lock.json, and CHANGELOG.md. Use whenever a user requests a version bump, release version change, package version update, or preparation of a named release.
---

# Update Version

Keep all package-version fields synchronized and make a changelog entry mandatory for
every version update.

## Workflow

1. Read `package.json`, the root fields of `package-lock.json`, and the beginning of
   `CHANGELOG.md`. Inspect the current work or user-provided release notes to understand
   what belongs in the release entry.
2. Validate that the requested version is a valid semantic version. Do not infer a
   different major, minor, or patch number when the user supplied one explicitly.
3. Update all of these fields together:
   - `package.json` top-level `version`.
   - `package-lock.json` top-level `version`.
   - `package-lock.json` root package entry at `packages[""].version`.
4. Update `CHANGELOG.md` in the same change. Never report a version bump complete
   without this step.
   - Preserve the `## [Unreleased]` heading.
   - Add `## [<version>] - YYYY-MM-DD` immediately after `Unreleased`, using the current
     local date unless the user specifies a release date.
   - If that version heading already exists, update it instead of creating a duplicate.
   - Summarize notable user-visible additions, changes, and fixes in concise past-tense
     bullets.
   - Do not rewrite historical release entries.
5. Verify the three package-version values match the requested version, confirm exactly
   one changelog heading exists for it, and run `git diff --check`.
6. Report the files changed and validation performed. Do not create a commit, tag, or
   release unless the user explicitly requests it.

## Changelog Guidance

- Prefer release notes supported by the current diff, feature documentation, tests, or
  explicit user context.
- Group closely related implementation details into one user-facing bullet.
- Mention compatibility or migration behavior when it affects existing diagrams.
- Leave `Unreleased` empty after cutting a version unless genuine unreleased changes
  remain.

## Required Validation

Use a read-only check equivalent to:

```text
package.json version == package-lock.json version == package-lock.json packages[""].version
CHANGELOG.md contains exactly one heading for the target version
git diff --check succeeds
```
