# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## Issue tracking (Linear)

Issues for this repo are tracked in Linear, team **Ymir** (key `YMI`, id
`43b9b28b-ad88-40b2-a3b7-e7ba31ad62fc`), workspace `ymir-bootstrap`. There is no Linear MCP tool
installed in this environment — read/write issues via the Linear GraphQL API directly
(`https://api.linear.app/graphql`), authenticated with the `$LINEAR_API_KEY` environment
variable (passed as-is in the `Authorization` header, no `Bearer` prefix). That variable lives in
the user's interactive shell — a fresh subprocess may not inherit it; check with
`[ -z "$LINEAR_API_KEY" ]` before use, and never print the key itself.

- Create an issue:
  ```bash
  curl -s -X POST https://api.linear.app/graphql \
    -H "Content-Type: application/json" \
    -H "Authorization: $LINEAR_API_KEY" \
    -d '{"query": "mutation IssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }", "variables": {"input": {"teamId": "43b9b28b-ad88-40b2-a3b7-e7ba31ad62fc", "title": "...", "description": "..."}}}'
  ```
- Read/search issues (e.g. by team):
  ```bash
  curl -s -X POST https://api.linear.app/graphql \
    -H "Content-Type: application/json" \
    -H "Authorization: $LINEAR_API_KEY" \
    -d '{"query": "query { team(id: \"43b9b28b-ad88-40b2-a3b7-e7ba31ad62fc\") { issues { nodes { id identifier title state { name } url } } } }"}'
  ```
- Look up a single issue by identifier (e.g. `YMI-35`) via the `issue(id: "...")` query, or
  `issueUpdate(id: ..., input: {...})` to change state/assignee/etc.
- Team discovery (only needed if working across other Linear workspaces/teams):
  `query { teams { nodes { id key name } } }`.

## Pull request titles

PR titles must read `[YMI-XXX][kind] Log` — `YMI-XXX` is the Linear issue, and `[kind]` is
optional and defaults to a feature. Known kinds: `feat`/`feature`, `fix`, `perf`, `refactor`,
`doc(s)`, `test(s)`, `chore`/`ci`/`build`/`style`, `breaking`. This is not cosmetic: the release
notes are generated from these titles by `.github/scripts/changelog.sh`, one entry per merged PR
(the commits inside a PR are never listed), grouped by kind. **A PR whose title does not follow
the format — no issue key, or a kind outside that list — is left out of the release notes
entirely**; the skip is logged on stderr by the release job, but the change goes unannounced.

The branch currently checked out is generally named `YMI-<issue_number>-<short-description>`
(e.g. `YMI-34-coverage-by-files`) — the `YMI-<issue_number>` part is the Linear issue key, so it
can be used to look up the issue this branch's work is tracked against (`issue(id: "YMI-34")` or
by matching `identifier` in a team issue list).

## What this is

Gyllir is the build system and package manager for GNU-Ymir (`gyc`) projects — the `cargo`/`dub`
equivalent for Ymir. It is itself written in Ymir (`.yr`), compiled by an already-installed `gyc`
toolchain, and it drives that same `gyc` to build the projects it manages: resolving/fetching
dependencies (local paths or git repos, version-filtered), compiling, running unit tests,
generating HTML docs, and publishing package versions to a registry. It is a sibling of the
`gyc`/`gcc` compiler checkout and of `midgard` (the Ymir standard library) — unlike `midgard`,
Gyllir is a standalone CLI tool, not something other projects link against.

Since this codebase is itself Ymir, the same language rules apply here as anywhere else Ymir is
written — see `../midgard/CLAUDE.md`'s "Ymir's memory model: `dmut` / `alias` / `copy`" and
`ref` sections (in the sibling `midgard` checkout, if present) for the empirically-verified rules
on mutable-access annotations, since they are not repeated here.

## Build / run / test

Gyllir builds itself with `gyllir` (CMake is gone) — not a source bootstrap: an
already-installed, previously *released* `gyllir` compiles the current tree. Requires both `gyc`
and `gyllir` on `PATH`; `gyllir.toml` is the whole build description.

- Build: `gyllir build --release` → `./gyllir` (drop `--release` for a `-g` debug build). Output
  caches live in `.target/{debug,release,unit_debug,unit_release}`.
- `package-root = "main"` in `gyllir.toml` is load-bearing: without it `src/gyllir.yr` (matching
  the package name) is picked as the package root, `src/main.yr` is left unattached, and the
  executable fails to link with `undefined reference to 'main'`.
- Tests: `gyllir test` (or `gyllir test --dry` to only compile `./gyllir.test`, then run it
  yourself — that's what CI does, so it can pass `-cov`). Test sources live in `test/`, rooted at
  `test/__test__.yr`.
- Install: no `make install` anymore — the `.deb` is staged by the Dockerfile's `package` stage
  (binary to `/usr/bin/`, `res/{html,css,js,ico}` to `/etc/gyllir/res/...`, `bash/_gyllir` to
  `/etc/bash_completion.d/`).
- CI (`.github/workflows/*.yml`) drives the same flow through the Dockerfile: the `toolchain`
  stage installs the `gyc` and `gyllir` `.deb`s named by `YMIR_VERSION`
  (`YMIR_BOOTSTRAP_VERSION` / `GCC_VERSION` / `GYLLIR_BOOTSTRAP_VERSION`), `build` runs `gyllir
  test --dry` + `gyllir build --release`, `test` runs `./gyllir.test -sf`, `package` produces the
  `.deb`. Build the whole thing locally with the `docker build` snippet in the Dockerfile header.
- Manual smoke test: build `gyllir`, then in a scratch directory run `gyllir init`, `gyllir
  build`, `gyllir test`, `gyllir run`, `gyllir doc`, `gyllir clean --all` and check the expected
  files/output at each step.

## Architecture

Entry point `src/main.yr` constructs a `gyllir::repo::manager::GyllirManager` from `argv` and
calls `run()`; every sub-command is dispatched and implemented from there.

- `src/gyllir/args.yr` — `GyllirArgumentParser`, built on `std::config::ArgumentParser`: one
  sub-parser per command (`init`, `build`, `run`, `test`, `clean`, `doc`, `publish`, `update`),
  each returning a `&Config` of parsed flags consumed by the matching `repo/*.yr` runner.
- `src/gyllir/config/` — the `gyllir.toml` schema, all `Serializable`/deserializable via
  `std::config`:
  - `config.yr` — `GyllirPackageConfiguration`: name, license, description, `compiler` (default
    `"gyc"`), `package-root`/`test-root`, `BuildType` (`type.yr`, executable/library), `registry`
    `Url`, `Version`, authors, C `libraries`, `DependencyList`, `CustomCommandList`.
  - `dependency.yr` — `Dependency` (a `VersionFilter` + `Url`) and `DependencyList`, the
    `[dependencies.<name>]` tables in `gyllir.toml`.
  - `url.yr` — `Url`/`UrlType`: `local:<path>` or `git:<remote>`, used for both dependency
    sources and the publish `registry`.
  - `version.yr` / `version/filter.yr` — `Version` (major.minor.patch or named) and
    `VersionFilter` (`>`, `>=`, `<`, `<=`, `=` comparators used to pick a dependency's version).
  - `command.yr` — `Command`/`CustomCommandList`: user-declared pre/post build commands.
  - `lock.yr` — `LockedPackage`/`LockFile`: the `gyllir.lock` schema (`lock-version`, one
    `[[package]]` array-of-tables entry per resolved package: `name`, `url`, `version`, `sha` for
    a `git:` source, `dependencies`), plus `matches()` (does an entry still resolve a declaration), `prune()`
    (drop what the manifest no longer reaches) and `toToml()` (the sorted, canonical dump — the
    file is committed, so its bytes have to be stable).
- `src/gyllir/repo/` — one file per sub-command, all consumed by `manager.yr`'s `run()`:
  - `manager.yr` — `GyllirManager::run()` dispatch, plus `resolveDependency`/
    `selectDependencyVersion`: clones (`git:`) or symlinks (`local:`) each declared dependency
    into `.deps/<name>`, checks out the version matching its `VersionFilter`, recurses into the
    dependency's own `gyllir.toml` (cycle-guarded via the `_depPackages` map), then builds it.
    Also the lock lifecycle of a command — `loadLock` before the build, `recordResolution` per
    dependency, `writeLock` after — the `--locked`/`--offline` flags, and `gyllir update`, which
    is a `dry` build pass (dependencies resolved, nothing compiled) followed by a rewrite.
  - `init.yr` — `RepoInitializer`: interactively prompts for project metadata and writes
    `gyllir.toml`, `src/`, `test/`, `.gitignore`, then `git init`+commit.
  - `builder.yr` — `RepoBuilder`: the largest file in the repo: resolves dependencies, invokes
    `gyc`, and manages the `.target/{debug,release,unit_debug,unit_release}` build cache
    (including the YIL-based incremental-recompilation tracking mentioned in recent commits).
  - `runner.yr` — `RepoRunner`: executes the built executable or test binary as a subprocess.
  - `cleaner.yr` — `RepoCleaner`: removes `.target/` outputs, optionally `__doc/` and resolved
    `.deps/` (recursively, reusing `manager.yr`'s dependency graph).
  - `publisher.yr` — `RepoPublisher`: bumps `Version` (major/minor/patch) and pushes the new
    version to the `registry` `Url` (`local:` or `git:`).
  - `doc.yr` — `RepoDocBuilder`: entry point for `gyllir doc`, wiring `gyllir/doc/*` together.
  - `defaults.yr` — every shared filename/dirname/extension constant (`gyllir.toml`, `.deps/`,
    `.target/...`, file extensions like `.yil`/`.doc.json`) — check here before hardcoding a path
    elsewhere.
- `src/gyllir/doc/` — the documentation generator invoked by `gyllir doc`:
  - `comment/` — parses `/** ... */` doc comments into a small AST (`node/{text,code,list,
    style}.yr`) via a hand-written tokenizer/parser (`tokens.yr`, `parser.yr`, `utf.yr`).
  - `symbols/` — one model type per documented Ymir construct (`class_`, `function`, `method`,
    `enum_`, `trait_`, `ctor`, `macro_`, `template*`, `variable`, `global`, `module`, ...).
  - `types/` — mirrors Ymir's type system for rendering signatures (`class_`, `enum_`, `array`,
    `slice`, `map`, `tuple`, `option`, `fptr`, `pointer`, `range`, `scalar`, `any`).
  - `html/` — renders parsed symbols/comments to a static site (`head.yr`, `body.yr`, `foot.yr`,
    `formatter.yr`, `ressources.yr`), using the static assets under `res/`.
  - `loader.yr` — loads a previously-produced `*.doc.json` (the `-i`/`--input` flag of
    `gyllir doc`), so docs can be regenerated without recompiling the whole project.
- `src/gyllir/utils/` — `git.yr` (`GitManager`: shells out to `git` for clone/checkout/tags/
  init/commit, used by `manager.yr`, `init.yr`, `publisher.yr`), `log.yr` (colored CLI status
  output), `errors.yr` (shared exception types, e.g. `RecursiveDependency`).
- `bash/` — shell completion (`_gyllir`) and profile scripts. `gyllir_vars.sh` exports
  `GYLLIR_HOME=/usr/share/gyllir/`, but note this variable is currently **unused** anywhere in
  `src/` — treat it as dead/aspirational, not a real global-install path, unless/until code
  actually reads it (relevant to YMI-42, moving std-lib resolution off implicit global state).
- `res/` — static HTML/CSS/JS/ico assets bundled into every generated documentation site,
  installed to `/etc/gyllir/res/...`.


