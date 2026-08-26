# Gyllir

Gyllir is the build system and package manager for [GNU-Ymir](https://github.com/GNU-Ymir) (`gyc`)
projects — the `cargo`/`dub` equivalent for Ymir. It builds `.yr` sources into executables or
libraries, resolves and fetches package dependencies (local paths or git repositories, version
filtered), runs unit tests, generates HTML documentation from doc comments, and publishes package
versions to a registry.

It is one component of a larger Ymir toolchain checkout: `gyllir` itself is compiled by a `gyc`
already installed on the machine, and drives that same `gyc` to build the projects it manages.

## Getting started

Building and running Gyllir requires a `gyc` toolchain already installed on the machine (check
with `gyc --version`) — this repo does not build `gyc` itself, only the `gyllir` binary. See
[Building](#building) to compile it and [Usage](#usage) for the available commands.

## Layout

- `src/main.yr` — entry point, hands off to `gyllir::repo::manager::GyllirManager`.
- `src/gyllir/args.yr` — CLI argument parsing (`GyllirArgumentParser`), one sub-parser per
  command (`init`, `build`, `run`, `test`, `clean`, `doc`, `publish`).
- `src/gyllir/config/` — `gyllir.toml` schema: package metadata (`config.yr`), dependencies and
  version filters (`dependency.yr`, `version.yr`, `version/filter.yr`), dependency/registry URLs
  (`url.yr`, `local:`/`git:`), build type (`type.yr`), custom pre/post commands (`command.yr`).
- `src/gyllir/repo/` — the core of each sub-command, one file per command plus shared pieces:
  - `manager.yr` — `GyllirManager`, dispatches parsed args to the right runner below.
  - `init.yr` — `gyllir init`: interactively creates `gyllir.toml`, `src/`, `test/`, `.gitignore`,
    and an initial git commit.
  - `builder.yr` — `gyllir build`/`test`: resolves dependencies, invokes `gyc`, tracks YIL/object
    caching under `.target/`.
  - `manager.yr` (`resolveDependency`/`selectDependencyVersion`) — clones/symlinks dependencies
    into `.deps/<name>`, checks out the version matching each dependency's `VersionFilter`.
  - `runner.yr` — `gyllir run`/the run step of `gyllir test`: executes the built binary.
  - `cleaner.yr` — `gyllir clean`: removes generated outputs (`.target/`), docs (`__doc/`), and
    optionally resolved dependencies.
  - `publisher.yr` — `gyllir publish`: bumps the package version and pushes it to the configured
    registry (a `local:` or `git:` `Url`).
  - `doc.yr` — `gyllir doc`: drives documentation generation (see below).
  - `defaults.yr` — shared filenames/paths/extensions (`gyllir.toml`, `.deps/`, `.target/`, ...).
- `src/gyllir/doc/` — documentation generator: `comment/` parses doc comments into a small AST
  (`node/{text,code,list,style}.yr`), `symbols/` models documented Ymir symbols (classes,
  functions, enums, traits, templates, ...), `types/` models Ymir types for rendering, `html/`
  renders the result to a static HTML site (`res/html`, `res/css`, `res/js`, `res/ico`).
- `src/gyllir/utils/` — `git.yr` (`GitManager`, shells out to `git`), `log.yr` (colored CLI
  logging), `errors.yr` (shared error/exception types).
- `bash/` — shell completion (`_gyllir`) and profile scripts (`gyllir_vars.sh` exports
  `GYLLIR_HOME`), installed under `/etc/bash_completion.d` / `/etc/profile.d`.
- `res/` — static assets (`html`, `css`, `js`, `ico`) bundled into generated documentation sites.

## Building

Gyllir builds itself. Requires a working `gyc` toolchain (looked up as `gyc` on `PATH`, see the
`compiler` key of `gyllir.toml`) and an already-installed `gyllir` release — grab the latest
`.deb` from [the releases page](https://github.com/GNU-Ymir/Gyllir/releases):

```sh
sudo apt-get install ./gyllir_<version>_amd64.deb
```

Then, from the root of this repository:

```sh
gyllir build --release   # -> ./gyllir
gyllir test              # build and run the unit test suite
```

### Installing

Building a `.deb` from a checkout is done through the `Dockerfile`, which pins the `gyc` and
`gyllir` versions it builds with to `YMIR_VERSION` (see the command in the Dockerfile header, and
`.github/workflows/release.yml` for the release automation). The resulting package installs the
`gyllir` binary to `/usr/bin/`, the documentation-generator's static assets (`res/html`,
`res/css`, `res/js`, `res/ico`) to `/etc/gyllir/res/...` and the completion script to
`/etc/bash_completion.d/`.

`tools/install.sh` puts that same layout in place from a checkout, without building a package —
useful when a change to `res/` has to be tried out, since `gyllir doc` reads its templates from
`/etc/gyllir/res` (compiled into `ressources::RES_ROOT`), never from the repository:

```sh
gyllir build --release       # -> ./gyllir, what the script installs
sudo tools/install.sh        # executable, documentation assets and completion
sudo tools/install.sh -a     # only res/, keeping the released /usr/bin/gyllir in place
tools/install.sh --destdir /pkg   # stage the layout under a directory instead, no root needed
```

## Usage

- `gyllir init` — interactively create a new `gyllir.toml` project in the current directory
  (name, author, description, license, executable/library type, registry).
- `gyllir build [--release] [--locked] [--offline] [-j N] [-v]` — build the project (debug by
  default); `--locked` fails instead of writing a new `gyllir.lock`, `--offline` also forbids any
  network access.
- `gyllir run [-- args...]` — build then run the produced executable.
- `gyllir test [--release] [--dry] [--locked] [--offline] [-j N] [-v]` — build and run the unit
  test suite (`--dry` to only compile, not run).
- `gyllir clean [-a|--all] [--doc]` — remove generated build outputs; `--doc` also removes
  generated documentation, `--all` also removes resolved dependencies.
- `gyllir doc [-i input.doc.json] [-o outputDir] [--locked] [--offline]` — generate the HTML
  documentation site.
- `gyllir update [--std] [dependency...]` — resolve the dependencies again and rewrite
  `gyllir.lock`, without compiling anything; naming none updates every one of them. `--std`
  updates the std lib resolved by `[std]`, which is never named positionally.
- `gyllir publish <message> [--major|--minor|--patch] [--dry] [-y]` — bump the package version
  and publish it to the registry declared in `gyllir.toml`.

### Project configuration (`gyllir.toml`)

Created by `gyllir init`, hand-editable afterwards:

```toml
name = "my-project"
license = "MIT"
description = "A minimal Ymir app"
type = "executable"      # or "library"
version = "0.1.0"
authors = ["Jane Doe"]
compiler = "gyc"          # optional, defaults to "gyc" on PATH
package-root = "main"     # optional, root module under src/ (defaults to src/__lib__.yr for a library, src/main.yr for an executable)
test-root = "__test__"    # optional, root module under test/ (defaults to test/__test__.yr)
registry = "local:/home/jane/.local/gyllir/my-project"

[dependencies.somelib]
version = ">=1.2.0"
url = "git:https://github.com/example/somelib"
```

Dependencies are resolved into `.deps/<name>` (git-cloned or symlinked for `local:` urls),
version-filtered per the declared `VersionFilter` (`>`, `>=`, `<`, `<=`, `=`), and built
recursively before the current package.

### Lock file (`gyllir.lock`)

`gyllir.toml` declares which versions are acceptable, `gyllir.lock` records the one that was
resolved — the whole graph, transitively, each `git:` package pinned to the exact commit its
version pointed at. It is written next to the manifest by `build`/`run`/`test`/`doc`, and is meant
to be **committed**: it is what makes the same commit build the same dependencies on another
machine, or a month later.

```toml
lock-version = 1

[[package]]
name = "somelib"
url = "git:https://github.com/example/somelib"
version = "1.4.2"
sha = "9f1c0d0a1b0e5f6d7c8b9a0f1e2d3c4b5a697887"
```

A build honors it and never bumps a pinned version, even when a newer tag exists upstream — it
re-resolves only what the lock file does not pin (a new dependency, a url that changed, a filter
narrowed past the pinned version). `gyllir update [<name>]` is the deliberate bump, `--locked`
turns an out-of-date lock file into an error (the CI mode), and `--offline` additionally forbids
cloning, fetching and pulling.

## Contributing

- Every change is tracked by a [Linear](https://linear.app) issue in the **Ymir** team (key
  `YMI`) — open one before starting work if it doesn't already exist.
- Name the branch after the issue: `YMI-<issue_number>-<short-description>` (e.g.
  `YMI-39-create-ci`).
- Name the pull request the same way, prefixed with the issue key (e.g.
  `YMI-39: Create CI`), so it's traceable back to the Linear issue.

## License

GPLv3 — see [LICENSE](LICENSE).
