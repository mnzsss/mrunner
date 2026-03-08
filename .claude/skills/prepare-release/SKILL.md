---
name: prepare-release
description: Use when preparing a release, bumping versions, or getting ready to open a release PR. Analyzes conventional commits on the current branch to determine the correct semantic version bump (patch/minor/major) following semver.org spec, validates the app builds for Linux and Windows, uses release-it to bump all versions and generate changelog, and leaves everything committed and ready for a PR. Use this whenever the user mentions "release", "bump version", "version bump", "create a release", or wants to finalize work on a branch for merging.
---

# Prepare Release

Analyzes conventional commits on the current branch vs master to determine the correct semantic version bump, validates the app, then uses release-it to bump all project versions, generate changelog, and commit — leaving everything ready for a PR.

The tag is NOT created here. It is created automatically by CI (`tag-release.yml`) when the release commit is merged into master, which then triggers the full release pipeline.

**Semver reference:** Consult `references/semver.md` for the full Semantic Versioning 2.0.0 specification when determining bump level.

## Step 1: Analyze Commits

Run `git log master..HEAD --oneline` to list all commits on the current branch.

Parse each commit using conventional commit format and determine the bump level following the [Semantic Versioning 2.0.0](https://semver.org/) spec:

### Version Bump Rules (MAJOR.MINOR.PATCH)

- **MAJOR** — incompatible API changes
  - Commits with `BREAKING CHANGE:` in body/footer
  - Commits with `!` after type/scope (e.g., `feat!:`, `fix(api)!:`)

- **MINOR** — new backward-compatible functionality
  - `feat` or `feat(scope)` commits

- **PATCH** — backward-compatible fixes and internal changes
  - `fix`, `perf`, `refactor`, `docs`, `style`, `chore`, `test`, `build`, `ci`

The **highest** bump level among all commits wins. If no conventional commits are found, default to **patch**.

**Important (semver spec §4):** When the major version is `0` (e.g., `0.y.z`), the project is in initial development — the API is not considered stable. In this phase, treat `feat` as MINOR and breaking changes as MINOR unless the user explicitly requests MAJOR.

Read the current version from the root `package.json` and calculate the next version.

Present to the user:
- List of commits grouped by type
- Determined bump level with semver reasoning
- Current version → next version (e.g., `0.0.9 → 0.1.0`)

Wait for user confirmation before proceeding.

## Step 2: Validate Branch

Check the current git branch:

- **On `master`**: Suggest creating a release branch with the pattern `release/v<next-version>`. Wait for confirmation before creating it.
- **On a branch without upstream**: Set upstream with `git push -u origin <branch-name>` (release-it requires upstream).
- **On a branch with upstream**: Proceed.

## Step 3: Clean Working Directory

release-it requires a clean working directory.

If there are uncommitted changes:
1. Show the pending changes to the user
2. Use the `conventional-commit` skill to create a proper commit
3. Verify the working directory is clean before continuing

## Step 4: Validate App

Run the following checks to ensure the app is correct before releasing. **All must pass** before proceeding:

1. **Lint & Format** — `pnpm check` (biome lint/format)
2. **Rust workspace check** — `cargo check --workspace` (validates all Rust crates compile)
3. **Frontend build** — `pnpm build` (validates the renderer builds successfully)
4. **Rust tests** — `cargo test --workspace` (runs all Rust tests)

If any check fails, show the errors and work with the user to fix them before continuing.

## Step 5: Dry Run

Run the release-it dry run to preview what will happen:

```bash
pnpm release:<patch|minor|major> -- --dry-run
```

Show the output and ask for final confirmation.

## Step 6: Execute Release

Run release-it with `--ci` to skip interactive prompts (already confirmed in step 5):

```bash
pnpm release:<patch|minor|major> -- --ci
```

This triggers the release-it pipeline:
1. Bumps root `package.json` version
2. Generates/updates `CHANGELOG.md`
3. Runs `bump-version.sh` which updates:
   - `Cargo.toml` (workspace version)
   - `apps/launcher/tauri.conf.json`
   - `apps/renderer/package.json`
   - `packages/ui/package.json`
   - `Cargo.lock`
4. Commits as `chore(release): v<version>`
5. Pushes branch (no tag — tag is created by CI on master merge)

## Step 7: Report

Show the final state:
- New version number
- Files that were changed
- Branch and push status
- Next step: open the PR with `gh pr create --base master`
- Remind: once merged, CI will automatically create the tag `v<version>` and trigger the release build
