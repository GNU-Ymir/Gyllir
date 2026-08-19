/*
 * Gyllir generated documentation — page behaviour.
 * Vanilla JS, no framework/library dependency (besides the vendored highlight.js).
 *
 * Expects, from the page markup (see res/html/*.html):
 *   - `window.GYLLIR_DOC = { title, sourceRepo }` set inline before this script loads
 *   - `#module-list-source` — hidden <li><a href="…url…">qualified::name</a></li> list, the
 *     data source for the sidebar module tree
 *   - `#module-list` — sidebar <ul class="tree"> to populate with the module tree
 *   - `#symbol-section` / `#symbol-list` — sidebar section + <ul class="tree"> for the current
 *     page's symbol tree
 *   - `#module-breadcrumb` — breadcrumb <nav>
 *   - `#declaration-list` — the page content, made of nested `.declaration` elements, each a
 *     `<details>` whose `<summary>` holds `.y_symbol_kind[data-kind]`, `.y_symbol_name` and
 *     `.symbol-target[id]`
 *   - `#gotosymbol` / `.search-input` / `#search-results` — the goto-symbol search form
 *   - `.theme-toggle` / `.sidebar-toggle` — top bar buttons
 */
(function () {
    "use strict";

    var config = window.GYLLIR_DOC || {};
    var THEME_KEY = "gyllir-doc-theme";

    /* ---------------------------------------------------------------------
     * Theme (light/dark, system preference + manual override)
     * ------------------------------------------------------------------- */

    function initTheme() {
        var root = document.documentElement;
        var toggle = document.querySelector(".theme-toggle");
        var stored = localStorage.getItem(THEME_KEY);
        if (stored === "light" || stored === "dark") {
            root.setAttribute("data-theme", stored);
        }

        function current() {
            var attr = root.getAttribute("data-theme");
            if (attr) return attr;
            return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        }

        function refresh() {
            if (toggle) {
                toggle.textContent = current() === "dark" ? "☀" : "☾";
                toggle.setAttribute("aria-label", "Switch to " + (current() === "dark" ? "light" : "dark") + " theme");
            }
        }

        if (toggle) {
            toggle.addEventListener("click", function () {
                var next = current() === "dark" ? "light" : "dark";
                root.setAttribute("data-theme", next);
                localStorage.setItem(THEME_KEY, next);
                refresh();
            });
        }

        refresh();
    }

    /* ---------------------------------------------------------------------
     * Mobile sidebar toggle
     * ------------------------------------------------------------------- */

    function initSidebarToggle() {
        var toggle = document.querySelector(".sidebar-toggle");
        var sidebar = document.getElementById("sidebar");
        if (!toggle || !sidebar) return;

        toggle.addEventListener("click", function () {
            var root = document.documentElement;
            if (root.hasAttribute("data-sidebar-open")) {
                root.removeAttribute("data-sidebar-open");
            } else {
                root.setAttribute("data-sidebar-open", "");
            }
        });

        document.addEventListener("click", function (evt) {
            var root = document.documentElement;
            if (!root.hasAttribute("data-sidebar-open")) return;
            if (sidebar.contains(evt.target) || toggle.contains(evt.target)) return;
            root.removeAttribute("data-sidebar-open");
        });
    }

    /* ---------------------------------------------------------------------
     * Module tree (sidebar)
     * ------------------------------------------------------------------- */

    function readModuleList() {
        var source = document.getElementById("module-list-source");
        if (!source) return [];

        return Array.prototype.map.call(source.querySelectorAll("li > a"), function (a) {
            return { name: a.textContent.trim(), url: a.getAttribute("href") };
        });
    }

    function buildModuleTree(modules) {
        var root = { members: {} };

        modules.forEach(function (mod) {
            var parts = mod.name.split("::");
            var parent = root;

            parts.forEach(function (part, index) {
                if (index === parts.length - 1) {
                    parent.members[part] = { type: "module", name: mod.name, url: mod.url, members: {} };
                    parent = parent.members[part];
                } else {
                    var node = parent.members[part];
                    if (!node) {
                        node = { type: "package", members: {} };
                        parent.members[part] = node;
                    }
                    parent = node;
                }
            });
        });

        return root;
    }

    function isCurrentModuleBranch(qualifiedPrefix) {
        if (!config.title) return false;
        return config.title === qualifiedPrefix || config.title.indexOf(qualifiedPrefix + "::") === 0;
    }

    function populateModuleList(tree) {
        var list = document.getElementById("module-list");
        if (!list) return;

        function names(node) {
            return Object.keys(node.members).sort(function (a, b) {
                return a.localeCompare(b);
            });
        }

        function moduleLink(name, member) {
            var a = document.createElement("a");
            a.href = member.url; // already a full "*.html" href, see readModuleList()
            a.textContent = name;
            a.title = member.name;
            if (member.name === config.title) a.classList.add("current");
            return a;
        }

        function render(node, container, ancestry) {
            names(node).forEach(function (name) {
                var member = node.members[name];
                var qualified = ancestry.concat(name).join("::");
                var li = document.createElement("li");

                if (member.type === "module" && Object.keys(member.members).length === 0) {
                    li.appendChild(moduleLink(name, member));
                } else {
                    var details = document.createElement("details");
                    if (isCurrentModuleBranch(qualified)) details.open = true;

                    var summary = document.createElement("summary");
                    if (member.type === "module") {
                        summary.appendChild(moduleLink(name, member));
                    } else {
                        var span = document.createElement("span");
                        span.className = "label";
                        span.textContent = name;
                        summary.appendChild(span);
                    }
                    details.appendChild(summary);

                    var sub = document.createElement("ul");
                    details.appendChild(sub);
                    render(member, sub, ancestry.concat(name));

                    li.appendChild(details);
                }

                container.appendChild(li);
            });
        }

        render(tree, list, []);
    }

    /* ---------------------------------------------------------------------
     * Symbol tree (sidebar) — built from the declarations on the page
     * ------------------------------------------------------------------- */

    function directDeclarations(container) {
        return Array.prototype.filter.call(container.querySelectorAll(".declaration"), function (el) {
            var p = el.parentElement;
            while (p && p !== container) {
                if (p.classList.contains("declaration-content")) return false;
                p = p.parentElement;
            }
            return true;
        });
    }

    function buildSymbolTree(container) {
        if (!container) return [];

        return directDeclarations(container).map(function (decl) {
            var kindEl = decl.querySelector(":scope > summary .y_symbol_kind");
            var nameEl = decl.querySelector(":scope > summary .y_symbol_name");
            var targetEl = decl.querySelector(":scope > summary .symbol-target");
            var content = decl.querySelector(":scope > .declaration-content");

            return {
                kind: kindEl ? kindEl.dataset.kind || "" : "",
                name: nameEl ? nameEl.textContent.trim() : "",
                targetEl: targetEl,
                children: content ? buildSymbolTree(content) : []
            };
        });
    }

    // Shared with computeModuleSymbolIndex() below, so that the anchor ids a page
    // assigns to its own symbols (here) match the ids the global search index
    // predicts for that page's symbols before it has even been fetched.
    function symbolAnchorId(name, anchorPrefix, index) {
        return anchorPrefix + name + "_" + index;
    }

    function symbolQualifiedName(prefix, name) {
        return prefix ? prefix + "." + name : name;
    }

    function populateSymbolList(tree) {
        var section = document.getElementById("symbol-section");
        var list = document.getElementById("symbol-list");
        if (!list || tree.length === 0) return [];

        if (section) section.hidden = false;

        var searchIndex = [];

        function symbolLink(node, anchorId) {
            var a = document.createElement("a");
            a.className = "symbol-link kind-" + node.kind;
            a.href = "#" + anchorId;
            a.textContent = node.name;
            return a;
        }

        function render(node, container, qualifiedPrefix, anchorPrefix, index) {
            if (!node.targetEl || !node.name) return;

            var anchorId = symbolAnchorId(node.name, anchorPrefix, index);
            node.targetEl.id = anchorId;

            var qualifiedName = symbolQualifiedName(qualifiedPrefix, node.name);
            searchIndex.push({ name: qualifiedName, kind: node.kind, href: "#" + anchorId });

            var li = document.createElement("li");

            if (node.children.length > 0) {
                var details = document.createElement("details");
                var summary = document.createElement("summary");
                summary.appendChild(symbolLink(node, anchorId));
                details.appendChild(summary);

                var sub = document.createElement("ul");
                details.appendChild(sub);
                node.children.forEach(function (child, i) {
                    render(child, sub, qualifiedName, anchorId + "-", i);
                });

                li.appendChild(details);
            } else {
                li.appendChild(symbolLink(node, anchorId));
            }

            container.appendChild(li);
        }

        tree.forEach(function (node, i) {
            render(node, list, "", "", i);
        });

        return searchIndex;
    }

    /* ---------------------------------------------------------------------
     * Breadcrumb
     * ------------------------------------------------------------------- */

    function moduleNameToPath(name) {
        return name.replace(/::/g, "/") + ".yr";
    }

    function initBreadcrumb() {
        var nav = document.getElementById("module-breadcrumb");
        if (!nav || !config.title) return;

        nav.innerHTML = "";
        var parts = config.title.split("::");

        parts.forEach(function (part, i) {
            var li = document.createElement("li");
            var h2 = document.createElement("h2");
            h2.textContent = part;

            if (i === parts.length - 1 && config.sourceRepo) {
                h2.appendChild(document.createTextNode(" "));
                var a = document.createElement("a");
                a.className = "view-source";
                a.href = config.sourceRepo + moduleNameToPath(config.title);
                a.textContent = "view source";
                h2.appendChild(a);
            }

            li.appendChild(h2);
            nav.appendChild(li);
        });
    }

    /* ---------------------------------------------------------------------
     * Goto-symbol search
     * ------------------------------------------------------------------- */

    // Recomputes the search-index entries for another module's page from its raw
    // HTML, without touching the live document. Mirrors populateSymbolList()'s
    // anchor-id/qualified-name scheme (via the shared symbolAnchorId()/
    // symbolQualifiedName() helpers) so the predicted "url#anchor" matches the id
    // that page will assign to that symbol once it is actually opened.
    function computeModuleSymbolIndex(doc, moduleUrl, moduleName) {
        var tree = buildSymbolTree(doc.getElementById("declaration-list"));
        var out = [];

        function walk(nodes, qualifiedPrefix, anchorPrefix) {
            nodes.forEach(function (node, i) {
                if (!node.targetEl || !node.name) return;

                var anchorId = symbolAnchorId(node.name, anchorPrefix, i);
                var qualifiedName = symbolQualifiedName(qualifiedPrefix, node.name);
                out.push({ name: qualifiedName, kind: node.kind, module: moduleName, href: moduleUrl + "#" + anchorId });

                if (node.children.length > 0) walk(node.children, qualifiedName, anchorId + "-");
            });
        }

        walk(tree, "", "");
        return out;
    }

    // Fetches every other module's page in the background and reports the symbols
    // found in each one via onEntries, so the goto-symbol search can cover the
    // whole documentation site, not just the page currently open. Pages that fail
    // to load (offline viewing, non-http origin, ...) are silently skipped — the
    // search just falls back to whatever loaded.
    function loadGlobalSearchIndex(modules, onEntries) {
        if (typeof fetch !== "function" || typeof DOMParser === "undefined") return;

        var currentUrl = location.pathname.split("/").pop();

        modules.forEach(function (mod) {
            if (mod.url === currentUrl) return;

            fetch(mod.url).then(function (res) {
                if (!res.ok) throw new Error("failed to fetch " + mod.url);
                return res.text();
            }).then(function (html) {
                var doc = new DOMParser().parseFromString(html, "text/html");
                onEntries(computeModuleSymbolIndex(doc, mod.url, mod.name));
            }).catch(function () {
                // ignore: this module's symbols just won't be searchable
            });
        });
    }

    function initSearch(searchIndex, modules) {
        var form = document.getElementById("gotosymbol");
        var input = form ? form.querySelector(".search-input") : null;
        var results = document.getElementById("search-results");

        var hasLocalIndex = searchIndex && searchIndex.length > 0;
        var hasOtherModules = modules && modules.length > 1;

        if (!form || !input || !results || (!hasLocalIndex && !hasOtherModules)) {
            if (form) form.hidden = true;
            return;
        }

        function render(matches) {
            results.innerHTML = "";
            if (matches.length === 0) {
                results.hidden = true;
                return;
            }

            matches.slice(0, 20).forEach(function (m) {
                var li = document.createElement("li");
                var a = document.createElement("a");
                a.href = m.href;
                a.appendChild(document.createTextNode(m.name));
                if (m.module) {
                    var mod = document.createElement("span");
                    mod.className = "search-result-module";
                    mod.textContent = m.module;
                    a.appendChild(mod);
                }
                a.addEventListener("click", function () {
                    results.hidden = true;
                    input.value = "";
                });
                li.appendChild(a);
                results.appendChild(li);
            });
            results.hidden = false;
        }

        function currentMatches() {
            var q = input.value.trim().toLowerCase();
            if (q === "") return null;
            return searchIndex.filter(function (m) {
                return m.name.toLowerCase().indexOf(q) !== -1;
            });
        }

        input.addEventListener("input", function () {
            var matches = currentMatches();
            if (matches === null) {
                results.hidden = true;
                return;
            }
            render(matches);
        });

        if (modules && modules.length > 0) {
            loadGlobalSearchIndex(modules, function (entries) {
                if (entries.length === 0) return;
                searchIndex.push.apply(searchIndex, entries);
                // reflect newly-loaded modules in whatever the user already typed
                if (!results.hidden || document.activeElement === input) {
                    var matches = currentMatches();
                    if (matches !== null) render(matches);
                }
            });
        }

        form.addEventListener("submit", function (evt) {
            evt.preventDefault();
            var first = results.querySelector("a");
            if (first) first.click();
        });

        document.addEventListener("click", function (evt) {
            if (!form.contains(evt.target)) results.hidden = true;
        });
    }

    /* ---------------------------------------------------------------------
     * Symbol highlighting / anchor navigation
     * ------------------------------------------------------------------- */

    function openAncestors(el) {
        var details = el.closest("details.declaration, details.member-group");
        while (details) {
            details.open = true;
            details = details.parentElement ? details.parentElement.closest("details.declaration, details.member-group") : null;
        }
    }

    function highlightSymbol(anchorId) {
        if (!anchorId) return;
        var target = document.getElementById(anchorId);
        if (!target) return;

        openAncestors(target);

        var previous = document.querySelector(".highlighted-symbol");
        if (previous) previous.classList.remove("highlighted-symbol");

        var decl = target.closest(".declaration");
        if (decl) {
            // restart the fade-out animation
            decl.classList.remove("highlighted-symbol");
            void decl.offsetWidth;
            decl.classList.add("highlighted-symbol");
        }

        target.scrollIntoView({ block: "start" });
    }

    function initSymbolNavigation() {
        window.addEventListener("hashchange", function () {
            highlightSymbol(decodeURIComponent(location.hash.slice(1)));
        });

        document.addEventListener("click", function (evt) {
            var link = evt.target.closest("a.symbol-link[href^='#']");
            if (!link) return;
            var anchor = link.getAttribute("href").slice(1);
            if (anchor === location.hash.slice(1)) highlightSymbol(anchor);
        });

        if (location.hash.length > 1) {
            highlightSymbol(decodeURIComponent(location.hash.slice(1)));
        }
    }

    /* ---------------------------------------------------------------------
     * Long doc-comment sections ("@params"/"@returns"/…) — a small standalone
     * toggle, not converted to <details> since it sits inside a <dt>/<dd> pair.
     * ------------------------------------------------------------------- */

    function initDescClosing() {
        document.addEventListener("click", function (evt) {
            var span = evt.target.closest(".desc-closing");
            if (!span) return;

            var dt = span.closest("dt");
            var dd = dt ? dt.nextElementSibling : null;
            if (!dd || dd.tagName !== "DD") return;

            dd.hidden = !dd.hidden;
            span.textContent = dd.hidden ? "[+]" : "[−]";
        });
    }

    /* ---------------------------------------------------------------------
     * Syntax highlighting
     * ------------------------------------------------------------------- */

    function registerYmirLanguage() {
        hljs.registerLanguage("ymir", function (hljs) {
            var KEYWORDS = {
                keyword: "if else while for do match return break continue throw catch import " +
                    "use in of is with as from module extern static cte pure impl over " +
                    "self super new delete assert version debug alias copy ref dmut mut " +
                    "immutable const let fn class struct trait enum union macro type " +
                    "pub prot priv",
                type: "i8 i16 i32 i64 isize u8 u16 u32 u64 usize f32 f64 c8 c32 bool void " +
                    "string char any",
                literal: "true false null none",
            };

            return {
                name: "Ymir",
                case_insensitive: false,
                keywords: KEYWORDS,
                contains: [
                    hljs.C_LINE_COMMENT_MODE,
                    hljs.C_BLOCK_COMMENT_MODE,
                    hljs.QUOTE_STRING_MODE,
                    hljs.APOS_STRING_MODE,
                    hljs.C_NUMBER_MODE,
                    {
                        scope: "meta",
                        begin: /@[A-Za-z_]\w*/,
                    },
                    {
                        scope: "title.function",
                        begin: /\b(fn)\s+/,
                        end: /(?=[(\s])/,
                        excludeBegin: true,
                        keywords: KEYWORDS,
                    },
                    {
                        scope: "title.class",
                        begin: /\b(class|struct|trait|enum|union)\s+/,
                        end: /(?=[({\s:])/,
                        excludeBegin: true,
                        keywords: KEYWORDS,
                    },
                ],
            };
        });
    }

    /*
     * Symbol declarations embed real `<a class="symbol-link">` links in their code
     * rendering (see gyllir/doc/html/body.yr). hljs.highlightElement() rewrites
     * innerHTML from textContent, which would silently drop them, so such blocks are
     * highlighted "by hand": the links are swapped out for plain-text placeholders,
     * the resulting text is run through hljs, and the placeholders are then swapped
     * back for the original `<a>` markup inside the highlighted output.
     */
    function highlightWithLinks(block) {
        var links = [];
        var nonce = "gyllirlink" + Math.random().toString(36).slice(2) + "x";
        var placeholderHtml = block.innerHTML.replace(/<a\b[^>]*>[\s\S]*?<\/a>/g, function (match) {
            links.push(match);
            return nonce + (links.length - 1) + nonce;
        });

        var scratch = document.createElement("div");
        scratch.innerHTML = placeholderHtml;
        var text = scratch.textContent;

        var languageMatch = block.className.match(/language-(\S+)/);
        var language = languageMatch ? languageMatch[1] : undefined;
        var result = language ? hljs.highlight(text, { language: language }) : hljs.highlightAuto(text);

        var placeholderRe = new RegExp(nonce + "(\\d+)" + nonce, "g");
        var highlighted = result.value.replace(placeholderRe, function (_, i) {
            return links[Number(i)];
        });

        block.innerHTML = highlighted;
        block.classList.add("hljs");
    }

    function initHighlighting() {
        if (typeof hljs === "undefined") return;
        registerYmirLanguage();
        hljs.configure({ languages: [] });
        document.querySelectorAll("code").forEach(function (block) {
            if (block.querySelector("a")) {
                highlightWithLinks(block);
            } else {
                hljs.highlightElement(block);
            }
        });
    }

    /* ---------------------------------------------------------------------
     * Boot
     * ------------------------------------------------------------------- */

    document.addEventListener("DOMContentLoaded", function () {
        initTheme();
        initSidebarToggle();
        initHighlighting();
        initBreadcrumb();

        var modules = readModuleList();
        populateModuleList(buildModuleTree(modules));

        var tree = buildSymbolTree(document.getElementById("declaration-list"));
        var searchIndex = populateSymbolList(tree);
        initSearch(searchIndex, modules);

        initSymbolNavigation();
        initDescClosing();
    });
})();
