/*
 * Gyllir generated coverage report — page behaviour, loaded after main.js (theme, sidebar toggle,
 * and the registration of the "ymir" highlight.js language) by res/html/coverage.html.
 *
 * Expects, from the page markup (see res/html/coverage_*.html):
 *   - `table.sortable` — a table whose `th[data-sort="text"|"num"]` headers sort its body rows
 *     by the `data-value` of the matching cells
 *   - `table.coverage-source` — one row per source line, the text of the line in its `td.cov-src`
 */
(function () {
    "use strict";

    /* ---------------------------------------------------------------------
     * Sortable summary table
     * ------------------------------------------------------------------- */

    function cellValue(row, column, numeric) {
        var cell = row.cells[column];
        var raw = cell ? (cell.getAttribute("data-value") || cell.textContent) : "";
        return numeric ? parseFloat(raw) || 0 : raw.toLowerCase();
    }

    // The header cells span several columns ("Lines" covers the bar and the percentage), so the
    // index of the first column of each header is computed from the colspans before it.
    function initSortable(table) {
        var headers = table.tHead ? table.tHead.rows[0].cells : [];
        var body = table.tBodies[0];
        var column = 0;

        Array.prototype.forEach.call(headers, function (th) {
            var index = column;
            column += th.colSpan || 1;

            var kind = th.getAttribute("data-sort");
            if (!kind || !body) return;

            th.addEventListener("click", function () {
                var ascending = th.getAttribute("aria-sort") !== "ascending";
                Array.prototype.forEach.call(headers, function (h) { h.removeAttribute("aria-sort"); });
                th.setAttribute("aria-sort", ascending ? "ascending" : "descending");

                var numeric = kind === "num";
                var rows = Array.prototype.slice.call(body.rows);
                rows.sort(function (a, b) {
                    var x = cellValue(a, index, numeric);
                    var y = cellValue(b, index, numeric);
                    var order = x < y ? -1 : (x > y ? 1 : 0);
                    return ascending ? order : -order;
                });

                rows.forEach(function (row) { body.appendChild(row); });
            });
        });
    }

    /* ---------------------------------------------------------------------
     * Annotated source highlighting
     *
     * A line on its own is not enough to highlight Ymir (a block comment or a string can span
     * several lines), so the whole file is highlighted at once, and the result is cut back into
     * lines: every span still open at the end of a line is closed there, and reopened at the
     * start of the next one.
     * ------------------------------------------------------------------- */

    function splitHighlighted(html) {
        var lines = [];
        var open = [];
        var current = "";
        var tag = /<\/?span[^>]*>|\n/g;
        var last = 0;
        var match;

        while ((match = tag.exec(html)) !== null) {
            current += html.slice(last, match.index);
            last = tag.lastIndex;

            if (match[0] === "\n") {
                lines.push(current + open.map(function () { return "</span>"; }).join(""));
                current = open.join("");
            } else if (match[0].charAt(1) === "/") {
                open.pop();
                current += match[0];
            } else {
                open.push(match[0]);
                current += match[0];
            }
        }

        lines.push(current + html.slice(last));
        return lines;
    }

    function initSourceHighlighting(table) {
        if (typeof hljs === "undefined" || !hljs.getLanguage("ymir")) return;

        var cells = table.querySelectorAll("td.cov-src");
        var text = Array.prototype.map.call(cells, function (td) { return td.textContent; }).join("\n");
        var lines = splitHighlighted(hljs.highlight(text, { language: "ymir", ignoreIllegals: true }).value);
        if (lines.length !== cells.length) return;

        Array.prototype.forEach.call(cells, function (td, i) {
            td.innerHTML = lines[i];
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        document.querySelectorAll("table.sortable").forEach(initSortable);
        document.querySelectorAll("table.coverage-source").forEach(initSourceHighlighting);
    });
})();
