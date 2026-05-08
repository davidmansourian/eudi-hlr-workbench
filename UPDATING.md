# Refreshing the bundle for a new ARF release

The bundled snapshot in `eudi_knowledge_bundle/` is what the workbench reads at build time. When the EUDI Wallet team publishes a new ARF version (or a new Commission Implementing Regulation lands on EUR-Lex), the bundle and a handful of mappings in `hlr_explorer_src/build_hlr_graph.py` need a re-look.

This document is the checklist for that work.

## Sources of truth

- **ARF text + annexes + discussion papers** — <https://eudi.dev/latest/> (rendered) and <https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework> (markdown).
- **Reference-implementation feature map** — `feature-map.md` in the same GitHub org's `eudi-doc-architecture-and-reference-framework` repo.
- **EU Regulations / CIRs** — EUR-Lex (<https://eur-lex.europa.eu/>). Note: EUR-Lex blocks scripted access behind a JS challenge — fetch manually or use the GitHub mirrors when available.

## Step 1 — refresh the bundle

What lives under `eudi_knowledge_bundle/` and where it comes from:

| Path | Source |
|---|---|
| `01-arf-main.md` | ARF main document |
| `annexes/high-level-requirements.csv` | ARF Annex 2.01 (HLRs as CSV) |
| `annexes/annex-1-definitions.md` | ARF Annex 1 |
| `annexes/annex-2.0{1,2,3}-*.md` | ARF Annex 2 (HLR variants) |
| `annexes/annex-3.0{1,2}-*.md` | PID and mDL rulebooks |
| `annexes/annex-4-service-blueprints/` | Annex 4 PDFs + extracted text |
| `annexes/annex-5.0{1,2}-*.md` | Design guide |
| `annexes/annex-6-certification-requirements.{pdf,txt}` | Certification Annex |
| `discussion-topics/` | ARF discussion papers (lettered a, b, …, plus -rr refinement rounds) |
| `legal-texts/text/*.txt`, `legal-texts/pdf/*.pdf` | EUR-Lex CIRs and Regulations |
| `reference-implementation/feature-map.md` | Reference-impl feature map |
| `rulebooks-catalog/` | Rulebook catalogue |
| `technical-specifications/` | TS01–TS14 |
| `media/` | Figures referenced from `01-arf-main.md`, design guide, etc. — **don't prune** |
| `my-synthesis/` | Hand-written flashcards (only update if you want to extend the deck) |

Re-pull each directory from the upstream repos. Keep file names stable — the build script references them by name. If the ARF team renames a discussion paper or annex, you'll need to update the corresponding constant (see Step 2).

## Step 2 — re-audit the hand-coded mappings

These constants in `hlr_explorer_src/build_hlr_graph.py` encode editorial decisions that can't be derived from the raw bundle. Open the file, jump to each line, and confirm the mapping is still correct.

| Constant | Line | What to check |
|---|---|---|
| `KNOWN_PREFIXES` | ~48 | Add any new HLR prefix that appears in the new CSV (e.g., a new topic introduces `FOO_01` style refs). |
| `TOPIC_TO_TS` | ~61 | Topic → Technical Spec list. Re-check if a new TS was added or a topic's scope shifted. |
| `TOPIC_TO_LEGAL` | ~69 | Topic → CIR/Reg list. Re-check if a new CIR was adopted that touches an existing topic, or a new topic appears. |
| `TS_META` | ~84 | TS code → human title. Add new TS rows as they appear. |
| `LEGAL_META` | ~100 | Legal-doc short-code → (long title, year, kind). Add any newly cited regulation. |
| `LEGAL_FILE` | ~575 | Short-code → file stem under `legal-texts/text/`. Update if you renamed legal text files in Step 1. |
| `LEGAL_CELEX` | ~593 | Short-code → CELEX number (used to map EUR-Lex URLs back to internal panels). |
| `LEGAL_ELI` | ~611 | Short-code → ELI URL fragment (alternate identifier). |
| `FEATMAP_TO_FEAT` | ~632 | `feature-map.md` heading text → workbench feature ID. If the EU team renames a feature heading, fix the mapping here. |
| `TOPIC_REFIMPL_EXTRA` | ~650 | Topics that don't map cleanly to a single feature get manual ref-impl status overrides. Re-check these against the new feature-map. |
| `DISC_TO_TOPIC` | ~825 | Discussion-paper letter → ARF Topic number(s). New discussion papers (next free letter) need an entry; old ones need re-checking if the paper's scope was rewritten. |
| `DISC_TITLES` | ~854 | Discussion-paper letter → human title. Update if a paper was renamed. |
| `CURATED_DELTAS` | ~888 | Hand-written summaries of what each refinement round (`-rr` paper) changes vs. its original. **This is the most labour-intensive step**: when a new -rr paper is published, read both papers side-by-side and write a fresh delta entry (additions / changes / removals). |
| `NARRATIVES`, `LEARNING_PATHS` | ~435 / further down | Hand-curated reading paths reference HLR IDs and Topic numbers. If the new ARF renumbers either, fix the references. |
| `SERVICE_BLUEPRINTS` | search for `SERVICE_BLUEPRINTS` | Mermaid sequence diagrams hand-written from Annex 4 PDFs (top 4 blueprints). If Annex 4 changes the depicted flows, redraw. |
| `SUPPLEMENTAL_DEFS` | ~1081 | Hand-written glossary entries that supplement Annex 1. Add new acronyms as they appear. |

If the ARF reorganises Topics (renumbers, splits, merges), most of these constants need attention — Topic numbers are the integration point throughout the build.

## Step 3 — rebuild

```bash
python3 hlr_explorer_src/build_hlr_graph.py
```

The script writes `hlr_explorer_src/hlr_graph.json` (intermediate) and bakes `index.html` (the HLR Workbench) at the project root.

## Step 4 — smoke-test in the browser

Open `index.html` and walk through:

1. **Graph loads** — node count in the header pill is sensible.
2. **HLR detail** — pick any HLR; cross-references render as clickable links; reference-impl badge appears.
3. **Topic detail** — pick a topic with a service blueprint (e.g., Topic 40 → Annex 4.01); Mermaid diagram renders.
4. **Legal panel** — open a CIR; recitals / articles / annexes are sectioned; an inline `Article N(...)` reference scrolls to the right anchor.
5. **Discussion paper** — open one with a refinement round (Topics C, E, J, X); the curated delta panel shows the additions/changes/removals.
6. **Search** — type a known HLR ID (e.g., `WUA_27`); it ranks and opens.
7. **Quiz** — start a session; cards have meaningful questions and answers.
8. **Cosmos mode** — press `F`, then `F` again to exit; sidebar still visible after exit.

## Step 5 — commit

The committed artifacts that change between releases:
- `eudi_knowledge_bundle/` (refreshed snapshot)
- `hlr_explorer_src/build_hlr_graph.py` (mapping updates + curated deltas)
- `index.html` (rendered output)

Keep `EUDI_BRIEFING_MOBILE.html` updated by hand if the prose needs to follow ARF revisions — there's no build step for the briefing.
