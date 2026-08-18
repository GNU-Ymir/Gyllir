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
