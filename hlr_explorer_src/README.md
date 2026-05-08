# EUDI HLR Workbench — source

The rendered tool lives one level up at `../index.html` and is the
only artifact you open in a browser. Everything in this directory is the
**source** that the build concatenates into that single file.

## Build

```bash
python3 hlr_explorer_src/build_hlr_graph.py
```

This:

1. Reads `../eudi_knowledge_bundle/` (CSV, markdown, legal text, PDFs).
2. Writes `hlr_graph.json` (intermediate, ~2 MB — the parsed graph + overlays).
3. Concatenates `shell.html` + `style.css` + every `js/*.js` (alphabetical, hence the numeric prefix) and substitutes the placeholders `__CSS__`, `__SCRIPT__`, `__HLR_DATA__`.
4. Writes `../index.html` (~2.5 MB).

No npm. No bundler. No build cache. Idempotent.

## Source layout

```
hlr_explorer_src/
├── build_hlr_graph.py            ← build script (parsing + concat)
├── shell.html                    ← HTML skeleton with __CSS__/__SCRIPT__/__HLR_DATA__
├── style.css                     ← all styles
├── hlr_graph.json                ← build artifact (regenerated each run)
├── _archive_template.html.OLD    ← pre-split monolith (kept for reference; do not edit)
└── js/
    ├── 01_helpers.js             ← escapeHtml, debounce, getCSS, lookups, color/shape
    ├── 02_personal.js            ← localStorage personal-layer API
    ├── 03_theme_mobile.js        ← dark mode + mobile sidebar toggles
    ├── 04_graph.js               ← cytoscape init, force / topic-grid layouts
    ├── 05_filters.js             ← filter pills + applyFilters
    ├── 06_detail.js              ← detail panel (HLR / Topic / TS / Legal / Disc), linkifyText, history
    ├── 07_palette.js             ← Cmd-K command palette
    ├── 08_lens.js                ← tab switcher + compliance lens
    ├── 09_paths.js               ← learning paths (active panel, list, autosync)
    ├── 10_atlas.js               ← path atlas modal + coverage matrix
    ├── 11_quiz.js                ← SM-2-lite spaced-repetition quiz
    ├── 12_help.js                ← help modal + reset functions + hierarchy diagram
    ├── 13_blueprints.js          ← topic narrative + Mermaid blueprints + tension surfacing
    ├── 14_glossary_popover.js    ← singleton glossary tooltip
    └── 15_init.js                ← final init block
```

The numeric prefix matters — files are concatenated alphabetically so the
order of definition is deterministic. Add new modules with the next free
number and put them before `15_init.js`.

## Notes for editors

- All JS lives inside one IIFE (`(function () { … })()`) opened in `shell.html`. Modules share closure state — no `import`/`export`.
- Each module gets a `/* ----- src/js/NN.js ----- */` source-marker comment in the rendered output, so a runtime error message line number can be traced back to the originating file by greping for the nearest preceding marker.
- `hlr_graph.json` is regenerated on every build. Don't hand-edit it.
- The legal text inflation (~1 MB) is the biggest contributor to rendered size; everything else is a few hundred KB.
