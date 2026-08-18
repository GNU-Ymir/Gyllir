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
            a.href = member.url + ".html";
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

            var anchorId = anchorPrefix + node.name + "_" + index;
            node.targetEl.id = anchorId;

            var qualifiedName = qualifiedPrefix ? qualifiedPrefix + "." + node.name : node.name;
            searchIndex.push({ name: qualifiedName, anchor: anchorId, kind: node.kind });

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

    function initSearch(searchIndex) {
        var form = document.getElementById("gotosymbol");
        var input = form ? form.querySelector(".search-input") : null;
        var results = document.getElementById("search-results");

        if (!form || !input || !results || !searchIndex || searchIndex.length === 0) {
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
                a.href = "#" + m.anchor;
                a.textContent = m.name;
                a.addEventListener("click", function () {
                    results.hidden = true;
                    input.value = "";
                });
                li.appendChild(a);
                results.appendChild(li);
            });
            results.hidden = false;
        }

        input.addEventListener("input", function () {
            var q = input.value.trim().toLowerCase();
            if (q === "") {
                results.hidden = true;
                return;
            }
            render(searchIndex.filter(function (m) {
                return m.name.toLowerCase().indexOf(q) !== -1;
            }));
        });

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

    function initHighlighting() {
        if (typeof hljs === "undefined") return;
        hljs.configure({ languages: [] });
        document.querySelectorAll("code").forEach(function (block) {
            hljs.highlightElement(block);
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

        populateModuleList(buildModuleTree(readModuleList()));

        var tree = buildSymbolTree(document.getElementById("declaration-list"));
        var searchIndex = populateSymbolList(tree);
        initSearch(searchIndex);

        initSymbolNavigation();
        initDescClosing();
    });
})();
