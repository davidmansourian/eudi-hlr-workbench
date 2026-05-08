# EUDI Wallet — Engineering Reference

A self-contained, browser-based reference for the EUDI Architecture and Reference Framework (ARF). Two HTML files, no backend, no build step at runtime.

| File | What it is |
|---|---|
| [`index.html`](index.html) | The HLR Workbench — interactive graph of every High-Level Requirement, topic, technical specification, legal doc, and discussion paper, with curated overlays (compliance lens, learning paths, atlas, quiz, cosmos visualisation). |
| [`EUDI_BRIEFING_MOBILE.html`](EUDI_BRIEFING_MOBILE.html) | An engineering briefing — long-form narrative explainer of the ecosystem, roles, lifecycles, trust model, and certification. Mobile-first reading layout. |

The two are cross-linked: the workbench has a "Briefing" pill in its header; the briefing has a "Workbench" pill in its header.

## Run it

Just open either HTML file in a browser. They load Cytoscape and Mermaid from CDN; no server needed. Personal annotations (HLR statuses, notes, bookmarks, path progress, quiz state) live in your browser's `localStorage` and never leave your device.

## Source

The workbench is rebuilt from `hlr_explorer_src/` via:

```bash
python3 hlr_explorer_src/build_hlr_graph.py
```

See [`hlr_explorer_src/README.md`](hlr_explorer_src/README.md) for the source layout. The briefing is hand-edited HTML.

## Sources used

All material is from public EU publications:

- **[EUDI Architecture and Reference Framework](https://eudi.dev/latest/)** — the ARF main document, all annexes (HLRs, definitions, rulebooks, service blueprints, design guide, certification requirements), discussion papers, technical specifications.
- **EU regulations and CIRs** — Regulation (EU) 2024/1183 + the 14 Commission Implementing Regulations referenced from the ARF, parsed into navigable form for offline reading.
- **[Reference implementation](https://github.com/eu-digital-identity-wallet)** — the EU's public Android/iOS demo apps and verifier, used to surface shipping status per feature.

The bundled snapshot of these sources is in `eudi_knowledge_bundle/`. The ARF is informative; only **Regulation (EU) 2024/1183** and the adopted CIRs are legally binding.

## License and attribution

The original work in this repository (the HLR Workbench source and rendered HTML, the Engineering Briefing, the curated overlays) is licensed under the MIT License — see [`LICENSE`](LICENSE).

The bundled material in `eudi_knowledge_bundle/` is a snapshot of public EU publications — primarily the EUDI Architecture and Reference Framework, distributed by the European Commission under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/), and EU Regulations / Commission Implementing Regulations from EUR-Lex. That material keeps its upstream licences.

See [`NOTICE.md`](NOTICE.md) for full attribution and source links. Only Regulation (EU) 2024/1183 and the adopted CIRs are legally binding; the ARF and everything derived from it (including this repository) is informative.

## Updating for new ARF releases

When the EUDI Wallet team publishes a new ARF version, the bundle and a handful of mappings in `hlr_explorer_src/build_hlr_graph.py` need a re-look. See [`UPDATING.md`](UPDATING.md) for the checklist.
