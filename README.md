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

Requires a working `gyc` toolchain (looked up as `gyc` on `PATH`, see `CMAKE_YMIR_COMPILER` in
`CMakeLists.txt`).

```sh
mkdir -p .build && cd .build
cmake ..
make
```

This compiles `src/main.yr` (and everything it transitively imports) into a single `gyllir`
binary with `gyc` — there's no per-module object-file build here, unlike Midgard.

### Installing

```sh
sudo make install
```

Installs the `gyllir` binary to `/usr/bin/` and the documentation-generator's static assets
(`res/html`, `res/css`, `res/js`, `res/ico`) to `/etc/gyllir/res/...`.

## Usage

- `gyllir init` — interactively create a new `gyllir.toml` project in the current directory
  (name, author, description, license, executable/library type, registry).
- `gyllir build [--release] [-j N] [-v]` — build the project (debug by default).
- `gyllir run [-- args...]` — build then run the produced executable.
- `gyllir test [--release] [--dry] [-j N] [-v]` — build and run the unit test suite (`--dry` to
  only compile, not run).
- `gyllir clean [-a|--all] [--doc]` — remove generated build outputs; `--doc` also removes
  generated documentation, `--all` also removes resolved dependencies.
- `gyllir doc [-i input.doc.json] [-o outputDir]` — generate the HTML documentation site.
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
registry = "local:/home/jane/.local/gyllir/my-project"

[dependencies.somelib]
version = ">=1.2.0"
url = "git:https://github.com/example/somelib"
```

Dependencies are resolved into `.deps/<name>` (git-cloned or symlinked for `local:` urls),
version-filtered per the declared `VersionFilter` (`>`, `>=`, `<`, `<=`, `=`), and built
recursively before the current package.

## Contributing

- Every change is tracked by a [Linear](https://linear.app) issue in the **Ymir** team (key
  `YMI`) — open one before starting work if it doesn't already exist.
- Name the branch after the issue: `YMI-<issue_number>-<short-description>` (e.g.
  `YMI-39-create-ci`).
- Name the pull request the same way, prefixed with the issue key (e.g.
  `YMI-39: Create CI`), so it's traceable back to the Linear issue.

## License

GPLv3 — see [LICENSE](LICENSE).
