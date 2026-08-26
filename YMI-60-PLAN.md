# YMI-60 — Modernize the generated HTML documentation export

## Decisions (confirmed)

- **Stack**: hand-rolled CSS + vanilla JS. No Bootstrap, no jQuery, no other framework.
- **Theming**: light/dark via CSS custom properties, `prefers-color-scheme` default, plus a
  manual toggle button persisted to `localStorage`.
- **Syntax highlighting**: keep highlight.js, vendor an updated release (still no CDN), driven
  from vanilla JS instead of jQuery.

## Key design call: keep the renderer/JS contract, replace the chrome

`src/gyllir/doc/html/body.yr` already emits stable hooks that both the old `bootdoc.js` and the
new JS can share:

- `.declaration` per symbol, `.y_decl_small` marks a "member block" (ctor/method/field groups)
- `.y_dd_decl_name` heading whose *text* starts with the kind word (`"enum "`, `"class "`,
  `"fn "`, `"let "`, ...) — the JS symbol-tree builder pattern-matches on this text, not on a
  separate data attribute
- `.symbol-link` / `.symbol-target` anchors, `id="$(Name)"` / `id="$(Name)-closing"` /
  `id="$(Name)-content"`
- `.member-list` wraps a symbol's children
- `#module-list-source` (built server-side into `header.html` from the `$(Modules)` placeholder)
  is what the JS module-tree builder reads on page load

None of this needs to change in `body.yr`. Reusing it means the doc-generation logic (all the
`dumpXxx` methods) is untouched, and the risk is contained to `res/html/*.html`, `res/css/*`,
`res/js/*`, and the thinner `head.yr`/`foot.yr`/`ressources.yr` wiring.

**One deliberate renderer+template change**: replace the JS-driven `[+]/[−]` show/hide toggles
(`.symbol-closing`, `.module-closing` click handlers) with native `<details>`/`<summary>`. This
is strictly better (works with JS disabled, gets browser-native keyboard/a11y support, no click
handler code to maintain) but it means `declaration.html`, `member_head.html`, `module_head.html`
and `module_table.html` change *shape* (wrapping `<div>` becomes `<details>`), which is a
coordinated edit across those four template files. `body.yr`/`foot.yr`/`head.yr` don't need to
change for this — they only feed `$(Content)`/`$(Name)`/`$(Kind)` into the templates, they don't
know about the wrapping tag.

## Current state of the tree (for reference)

- `res/css/`: `bootstrap.css`, `bootstrap.responsive.css`, `sidebar.css`, `style.css`,
  `highlight.css`
- `res/js/`: `jquery.min.js`, `bootstrap.min.js`, `bootdoc.js`, `highlight.js`
- `res/html/`: `header.html`, `footer.html`, `module_head.html`, `module_table.html`,
  `submodule.html`, `declaration.html`, `inline_code.html`, `member_head.html`, `members.html`,
  `leaf_node.html`
- `src/gyllir/doc/html/{head,body,foot,formatter,ressources}.yr`: renderer, unchanged except
  where noted above
- `src/gyllir/repo/doc.yr`: copies `res/{js,css,ico}` verbatim into the output dir
  (`createBaseDirectory`) and builds the `$(Modules)` list (`dumpModuleTable`,
  `html::ressources::LEAF_NODE` — this is the sidebar-source `<li>` list, distinct from the
  `member_head.html`/`declaration.html` template also named similarly)
- Tests: `test/doc/html/formatter.yr` only exercises `formatter::format`/`formatGitUrl` generically
  (placeholder substitution, git URL rewriting) — it asserts nothing about template *content*, so
  it's not at risk from any of this.

## Work items (claimable independently once the contract above is fixed)

1. **CSS** (`res/css/`): drop `bootstrap*.css`; new `style.css` with CSS custom properties for
   both palettes, responsive grid/flexbox layout (collapsible sidebar on mobile), styles for
   `<details>/<summary>`, keep `.y_decl`/`.y_decl_small`/`.y_dd_decl`/`.symbol-link`/etc. class
   names since JS + renderer both target them. Update `highlight.css` to match the new hljs
   release + both themes.
2. **JS** (`res/js/`) — done: `jquery.min.js`/`bootstrap.min.js`/`bootdoc.js` deleted,
   `highlight.js` replaced with the vendored highlight.js v11.12.0 UMD core build (still no CDN;
   fetched from `@highlightjs/cdn-assets` on npm — no "ymir" grammar exists so highlighting stays
   a no-op plaintext pass same as before, this is purely a version bump), and `res/js/main.js`
   added: module tree sidebar from `#module-list-source`, symbol tree sidebar built by walking
   `.declaration` elements and reading `data-kind`/`.symbol-target` (see contract below —
   simpler and more robust than the old regex-on-text-content approach), breadcrumb, goto-symbol
   search, theme toggle + `localStorage`, mobile sidebar toggle, `.desc-closing` handler,
   `hljs.highlightElement` per code block. No more manual `[+]/[−]` toggle handlers — that's
   native `<details>` now. `PackageSeparator` is gone (it was always `"_"`; `main.js` reads the
   `href` gyllir already writes into `#module-list-source` instead of recomputing it).
3. **Templates + the `<details>` renderer change** (`res/html/*.html`, coordinated): restructure
   `header.html`/`footer.html` for the new layout (drop navbar/`row-fluid` grid markup, add
   theme-toggle button, keep `#module-list-source`, `#gotosymbol`, `#module-breadcrumb`,
   `#declaration-list` IDs since JS depends on them), and switch `declaration.html`,
   `member_head.html`, `module_head.html`, `module_table.html` to `<details>/<summary>`.
4. **Verification**: `gyllir build --release`, then `gyllir doc` against this repo (or a scratch
   project) and manually check: sidebar module tree, symbol tree + search, cross-module links
   (`dumpType`'s generated `<a class="symbol-link" href="...">`), collapse/expand, mobile viewport
   layout, dark/light toggle + system preference, syntax highlighting. Also run `gyllir test`
   (only `test/doc/html/formatter.yr` touches this area and shouldn't need changes, but confirm).

## Markup contract for `res/css/style.css` (item 1, landing now)

CSS is being written first against a target markup shape; item 3 (templates) must match it:

- Page skeleton: `header.topbar` (contains `button.sidebar-toggle`, `a.brand`, `form#gotosymbol`
  with `input.search-input` + `ul#search-results`, `a.topbar-link` to the git URL,
  `button.theme-toggle`) → `div.layout` (contains `nav.sidebar#sidebar` and `main.content`) →
  `footer.site-footer`.
- Sidebar: `ul#module-list-source.hidden` (unchanged data source consumed by JS, still built
  server-side from `$(Modules)`), then `section.sidebar-section` > `h2` + `ul#module-list.tree`
  (`<noscript>$(Modules)</noscript>` fallback inside it), then a second
  `section.sidebar-section#symbol-section[hidden]` > `h2` + `ul#symbol-list.tree`. Tree nodes are
  `<li>`; expandable ones wrap a nested `<ul>` inside a `<details>`/`<summary>` pair
  (`li > details > summary` for a node with children, `li > a` for a leaf).
- Breadcrumb: `nav#module-breadcrumb.breadcrumb` (unchanged id), main declarations unchanged id
  `div#declaration-list`.
- Declarations: `declaration.html` becomes `<details class="declaration y_decl" open><summary>
  <span class="symbol-target" id="$(Name)">&nbsp;</span> <span class="y_symbol_kind
  kind-$(Kind)" data-kind="$(Kind)">$(Kind)</span> <span
  class="y_symbol_name symbol-link">$(Name)</span> $(Templates)</summary><div
  class="declaration-content" id="$(Name)-content">$(Content)</div></details>` — the
  `.symbol-target` span is load-bearing: `main.js` overwrites its `id` with a unique
  `name_index`/`name-parent_index` anchor while building the sidebar symbol tree (the raw
  `$(Name)` isn't unique across overloads/nesting, same as the old bootdoc.js scheme), and
  `.y_symbol_name`/`.symbol-target` must both be direct children of `summary` for
  `main.js`'s `":scope > summary .y_symbol_kind"` etc. selectors to find them. Note the
  `kind-$(Kind)` class (mirrors the existing `y_symbol_kind`/`data-kind` text) is what
  `style.css` uses to color-code each symbol kind (`kind-class`, `kind-enum`, `kind-fn`,
  `kind-trait`, `kind-macro`, `kind-let`, `kind-mod`, `kind-ctor`, `kind-def`, `kind-record`,
  `kind-entity`, `kind-template`, `kind-assert`). `member_head.html`/`module_head.html` become
  `<details class="member-group" open><summary>$(Kind)</summary><div
  class="member-list">$(Content)</div></details>`. `$(Name)-closing` spans and the
  `symbol-closing`/`module-closing` classes go away — `<details>` provides the toggle natively.
  **Caught during item 3's manual verification**: `member_head.html`/`module_head.html`/
  `module_table.html`'s own group-wrapper `<div>` must *not* reuse the `declaration-content`
  class — `main.js`'s `directDeclarations()` walks up from every `.declaration` looking for a
  `.declaration-content` ancestor to decide "this belongs to a deeper nesting level, some other
  declaration owns it"; reusing that class on a `member-group`'s wrapper made every declaration
  inside a `Methods`/`Fields`/... group look one level too deep and silently vanish from the
  sidebar symbol tree and search index (the page content itself still rendered fine — only the
  sidebar/search were affected, which is why it wasn't obvious from a screenshot alone). Group
  wrappers use `.member-list` (member_head.html) or the new `.member-group-body` class
  (module_head.html/module_table.html) instead; `.declaration-content` is now exclusively the
  per-symbol content wrapper `main.js` depends on.
- `.desc-closing` (from `src/gyllir/doc/comment/node.yr`, used for long `@param`/`@return` doc
  blocks) is a separate, smaller, pre-existing toggle that is *not* being converted to
  `<details>` in this pass — it stays a plain clickable span with a small JS handler in item 2.
  CSS just needs `cursor: pointer` on it.
- Symbol cross-reference links generated by `body.yr`'s `dumpType` keep the `symbol-link` class
  as-is (already handled).
- `main.js` needs `window.GYLLIR_DOC = { title: "$(Title-ish, the qualified module name)",
  sourceRepo: "$(GitURL)" }` set inline in `footer.html` before `<script src="js/main.js">` —
  replaces the old loose `Title`/`SourceRepository`/`PackageSeparator` globals (`PackageSeparator`
  is dropped, see item 2). `head.yr`'s `HtmlHeader` already receives the raw module name before
  it's blended into `Title` (`self._project ~ " " ~ self._name`), so `foot.yr`/`HtmlFooter`
  either needs the bare module name passed through too, or `head.yr` needs to stop concatenating
  the project name into `$(Title)` and let the `<title>` tag do `$(Project) — $(Name)` itself —
  worth deciding when implementing item 3, since `main.js`'s breadcrumb/current-module-highlight
  logic needs the *bare* qualified module name, not `"project name"`.
- `#search-results` (a `<ul>`, initially `hidden`) must sit inside `form#gotosymbol`, sibling to
  `input.search-input`, for `main.js`'s dropdown positioning/`form.contains(evt.target)` checks.

## Open questions / judgment calls left to whoever picks up each piece

- Icon set (`res/ico/*.png`) is left as-is for now — swapping to inline SVG is a nice-to-have,
  not called for by the issue; flag if it looks wrong against the new theme.
- Search (item 2) can start as simple substring/typeahead matching against the symbol name list,
  no need for fuzzy matching.

---

# Follow-up: search scoping + `gyllir doc serve`'s `/symbol` endpoint

## Problem with what landed in item 2

`main.js`'s goto-symbol search covers the whole site by *downloading the whole site*:
`loadGlobalSearchIndex()` fetches every other module page, re-parses it with `DOMParser`, and
re-derives the anchor ids that page will assign to its own symbols
(`computeModuleSymbolIndex()` mirroring `populateSymbolList()`), caching the result in
`sessionStorage`. That is O(pages) requests on the first focus of the search box, only works
over http(s) (nothing loads from `file://`), and keeps two anchor-numbering implementations in
sync by hand.

## Decision

Split the two cases instead of making static pages pretend to be a server:

- **`gyllir doc` (static output)** — search stays **local to the page being viewed**: the index is
  exactly what `populateSymbolList()` already returns for the current module. No cross-page
  fetching, no `sessionStorage` cache, works from `file://`.
- **`gyllir doc serve`** — the server owns the global index and answers `POST /symbol`. The page
  queries it as the user types.

The whole-site index therefore exists **once, in gyllir, in Ymir**, built from the `.doc.json`
the doc build just produced — not re-derived in the browser from generated HTML.

## Contract

### `POST /symbol`

Request body (JSON):

```json
{ "query": "buildTar", "type": "fn" }
```

- `query` — required, non-empty; matched case-insensitively.
- `type` — optional; when present and non-empty, filters on the symbol kind. Vocabulary is the
  `data-kind` one already used in the generated HTML (`fn`, `ctor`, `class`, `record`, `entity`,
  `trait`, `enum`, `def`, `macro`, `let`, `module`), plus the aliases `function`/`method` → `fn`,
  `global`/`field` → `let`.

Response `200 application/json`:

```json
{ "results": [ { "name": "RepoBuilder.run", "kind": "fn",
                 "module": "gyllir::repo::builder", "url": "gyllir_repo_builder.html" } ],
  "total": 1 }
```

- `name` — qualified **inside its page**, `.`-joined (`Class.method`), i.e. exactly the
  `symbolQualifiedName()` scheme `main.js` builds for the page-local index.
- `url` — the page file name, same `Path(module, sep-> "::").toStr(sep-> "_") ~ ".html"` rule
  `doc.yr`'s `generatePage`/`dumpModuleTable` use.
- Ranking: exact name, then prefix-of-last-segment, then substring; capped at 50 results, `total`
  counting every match so a capped answer is recognizable. **Landed as a count, not the
  `"truncated": false` of the first draft**: `std::config::json`'s dumper writes a `Bool` as the
  *string* `"false"` (that is how `gyc`'s own doc json spells booleans, cf. `loader.yr` matching
  `Str(value-> "true")`), and `"false"` is truthy in javascript.
- `400` on a body that is not JSON or carries no `query`; `GET /symbol?query=…&type=…` is
  accepted too, purely so the endpoint can be poked with `curl`.

### No anchor ids on the wire

The server deliberately does **not** compute `#anchor` fragments: those ids are assigned by
`main.js` at page load (`name_index`, nested `parent_index-name_index`) and mirroring that
numbering server-side is exactly the fragile duplication this change removes. A result links to
`<url>?symbol=<qualified name>`; on load `main.js` looks that name up in the page-local index it
has just built and jumps to it (`highlightSymbol`, then rewrite `location.hash`). A stale name
just lands on the right page without a jump.

### Telling the two modes apart

`RepoDocServer` adds ` serve: true,` to the `window.GYLLIR_DOC = {` object `footer.html` already
writes into every page, in each `text/html` response it serves (`withServeFlag`, unit tested in
`test/repo/doc_server.yr`); a page whose configuration object is not found is served untouched and
stays page-local. Static output never carries the flag. Rejected alternatives: a `js/serve.js`
referenced from `header.html` (404s on static output), and probing `/symbol` on first focus (404
noise + latency on static hosts).

**Why the flag rather than an injected `<script>` tag** (which is what the first draft said): the
generated pages do not html-escape the code they render, so a `pub def` holding a literal
`"<script>…</script>"` — which is exactly what such a marker would be — comes back out as a *live*
script tag inside `doc_server.yr`'s own documentation page, setting the flag on a statically
generated page. Escaping that properly is a separate fix (`body.yr` deliberately embeds real
`<a class="symbol-link">` markup inside its code blocks, so it cannot simply escape the whole
block), tracked outside this change.

## Work items

All four landed on this branch (see `git log`), each verifiable on its own:

1. **`src/gyllir/doc/index.yr`** (new) — `SymbolIndex`: build a flat `[SymbolEntry]`
   (`name`, `kind`, `module`, `url`) by walking the `&Symbol` tree `SymbolLoader` returns, and
   `search(query, kind, limit)` implementing the filter + ranking above. Names/kinds must mirror
   what `html/body.yr` writes into `declaration.html` (`Name` is `Path(name, sep-> "::").file()`,
   `Kind` is the `data-kind` string), including class/trait members, ctors, fields, enum members,
   macro rules, and template inners (`Template.inners`, same unwrapping as
   `HtmlBody::loadElement`). Unit-testable without a socket → `test/doc/index.yr`.
2. **`src/gyllir/repo/doc_server.yr` + `manager.yr` wiring** — resolve the served target's
   `.doc.json` (`defaults::targetCacheDir(cwd, target, __CACHE_DOC_DIR__)/<outputName>.doc.json`,
   same rule as `doc.yr`), preload + `SymbolIndex` it at startup, register the `/symbol` route,
   JSON request/response via `std::config::json::{parse,dump}`, and add the `serve: true` flag to
   the page configuration of served HTML. Failure to load the json is a warning + an empty index, not a fatal error:
   serving the pages still works.
3. **`res/js/main.js`** — two-mode search: delete `loadGlobalSearchIndex()`,
   `computeModuleSymbolIndex()` and the `sessionStorage` global cache; page-local matching by
   default (placeholder "Search this page…"); when `GYLLIR_DOC.serve` is set, debounced
   `POST /symbol` (placeholder "Go to symbol…", module label on each result, fall back to the
   local index if the request fails). Plus the `?symbol=` landing handler.
4. **Docs + verification** — document `gyllir doc serve` and `/symbol` in `doc/cli.html`
   (neither is documented at all yet), add `serve` and its `--host`/`--port`/`--output` flags to
   `bash/_gyllir`, then verify by hand: `gyllir doc` (static, local-only search, works from
   `file://`) and `gyllir doc serve` (cross-module search, `curl -X POST localhost:8000/symbol`).

## Settled

- "Search bar exists only when serving" means *the bar stays, its scope shrinks*: static pages keep
  a search input restricted to the current page (placeholder "Search this page…", vs "Go to
  symbol…" when served). Making it disappear entirely from static output would be a one-line flip
  in item 3 (hide the form unless `config.serve`).

## Left open

- The generated pages do not escape `<`/`>`/`&` in the code they render (see above): any
  documented symbol whose rendered code contains markup is emitted verbatim into the page. Worth
  its own issue — the fix has to escape at the leaf level, since `dumpType` legitimately writes
  `<a>` elements into those same code blocks.
- Nothing in the served pages can be checked locally against an installed `gyllir` older than this
  branch: `ressources::RES_ROOT` reads `/etc/gyllir/res`, so `gyllir doc` renders with the
  *installed* templates, not the ones in `res/`. The `/symbol` endpoint and the flag injection were
  verified against a hand-built page from this branch's `res/html/*`.
