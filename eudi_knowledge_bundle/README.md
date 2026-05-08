# EUDI Wallet Knowledge Bundle

A self-contained snapshot of the European Digital Identity Wallet documentation, ready to drop into a Claude Project (or any RAG / search system).

**Compiled:** 2026-05-07
**Reviewed:** 2026-05-07 (post-audit; CSV, CHANGELOG, FAQ, TS API artifacts, and meta files added)
**ARF edition:** 2026.05 (latest as of compilation)
**Total content:** 100 files, ~7 MB (markdown + 13 PDFs + JSON/XSD/UML/YAML data models + CSV)

---

## How to use this bundle

### Option 1 — Claude Project (recommended)

1. Go to **claude.ai**, create a new Project (e.g. "EUDI Wallet").
2. Upload the entire contents of this folder *except* the `_meta/` folder. Drag and drop works; you can select all files at once.
3. Add a Project description like: *"This Project contains the European Digital Identity Wallet Architecture & Reference Framework, all annexes, the canonical HLR CSV, all discussion topics, all technical specifications and their data-model artifacts, and a structured engineering briefing. When answering, prefer concrete references to specific files and HLR identifiers (e.g. WIAM_14, ISSU_05). The ARF is informative; only Reg (EU) 2024/1183 and adopted CIRs are legally binding."*
4. Start a chat in the Project. Every chat in that Project will have access to all uploaded files.

### Option 2 — Drop into Claude Code or another tool

Point the tool at this folder. Files are clean markdown (mostly) and load cleanly. The PDFs (Annex 4 service blueprints + Annex 6 Certification Requirements) need a PDF-aware reader.

### Option 3 — Search/RAG yourself

The corpus is small enough (~7 MB) that you don't need RAG, but if you want one: chunk per `## ` heading, embed with any sentence-level model, and you'll get good retrieval quality.

---

## What's in here

```
eudi_knowledge_bundle/
├── README.md                            (this file)
│
├── 01-arf-main.md                       (the entire ARF main document, ~400 KB, 6,036 lines)
│
├── annexes/
│   ├── README.md                        (annex index)
│   ├── annex-1-definitions.md           (every term + meaning)
│   ├── annex-2.01-high-level-requirements.md       (introduction; points to CSV + by-topic/by-category .md)
│   ├── annex-2.02-high-level-requirements-by-topic.md      (~260 KB — HLRs by topic)
│   ├── annex-2.03-high-level-requirements-by-category.md   (~260 KB — same HLRs by actor)
│   ├── high-level-requirements.csv      ★ canonical authoritative HLR source (657 rows, ~656 HLRs)
│   ├── annex-3.01-pid-rulebook.md       (redirect stub — see rulebooks-catalog/pid/)
│   ├── annex-3.02-mDL-rulebook.md       (redirect stub — see rulebooks-catalog/mdl/)
│   ├── annex-5.01-design-guide.md
│   ├── annex-5.02-design-guide-data-sharing-scenarios.md
│   ├── annex-4-service-blueprints/      (12 PDFs — operational sequence diagrams)
│   └── annex-6-certification-requirements.pdf
│
├── discussion-topics/                   (28 papers; both integrated and 2026 refinement-round versions)
│   ├── README.md                        ★ integration mapping — which papers landed in which ARF version
│   ├── a-privacy-risks-and-mitigations.md
│   ├── aa-support-of-electronic-payments-SCA-with-wallet.md   (integrated as Topic 20)
│   ├── b-re-issuance-and-batch-issuance-of-pids-and-attestations.md
│   ├── c-wallet-unit-attestation.md                  (original)
│   ├── c-rr-wallet-unit-attestations.md              (2026 refinement — WIA/KA split)
│   ├── d-embedded-disclosure-policies.md
│   ├── e-pseudonyms-including-user-authentication-mechanism.md      (integrated)
│   ├── e-rr-pseudonyms-including-user-authentication-mechanism.md   (2026 refinement)
│   ├── f-digital-credential-api.md
│   ├── g-zero-knowledge-proof.md
│   ├── h-transaction-logs-kept-by-the-wallet.md
│   ├── i-natural-person-representing-another-natural-person.md
│   ├── j-wallet-to-wallet-interactions.md            (original)
│   ├── j-rr-wallet-to-wallet-interactions.md         (2026 refinement)
│   ├── k-combined-presentation-of-attestations.md
│   ├── l+m-data-deletion-and-reporting-of-wrp-to-dpa.md
│   ├── n-export-and-data-portability.md
│   ├── o-catalogues-for-attestations.md
│   ├── p-secure-cryptographic-interface-between-the-Wallet-Instance-and-WSCA.md
│   ├── q-interface-user-wallet-instance.md
│   ├── r-authentication-of-user-to-device.md         (integrated as Topic 40)
│   ├── s-certificate-transparancy.md
│   ├── t-support-and-maintenance-by-the-wallet-provider.md   (integrated as Topic 56)
│   ├── u-eudi-wallet-trust-mark.md
│   ├── v-pid-rulebook.md
│   ├── w-transactional-data-for-payments-and-other-use-cases.md
│   ├── x-relying-party-registration.md               (original)
│   ├── x-rr-relying-party-registration.md            (2026 refinement)
│   └── z-device-bound-attestations.md
│
├── technical-specifications/             (TS1 through TS14 + concrete data models)
│   ├── README.md
│   ├── guide.md                          (how to read the TS docs)
│   ├── ts1-eudi-wallet-trust-mark.md
│   ├── ts2-notification-publication-provider-information.md
│   ├── ts3-wallet-unit-attestation.md                       (THE most-referenced TS)
│   ├── ts4-zkp.md
│   ├── ts5-common-formats-and-api-for-rp-registration-information.md
│   ├── ts6-common-set-of-rp-information-to-be-registered.md
│   ├── ts7-common-interface-for-data-deletion-request.md
│   ├── ts8-common-interface-for-reporting-of-wrp-to-dpa.md
│   ├── ts9-wallet-to-wallet-interactions.md
│   ├── ts10-data-portability-and-download-(export).md
│   ├── ts11-interfaces-and-formats-for-catalogue-of-attributes-and-catalogue-of-schemes.md
│   ├── ts12-electronic-payments-SCA-implementation-with-wallet.md
│   ├── ts13-zksnarks.md
│   ├── ts14-zkps-from-mms.md
│   └── api/                              ★ concrete data models — JSON Schema, XSD, OpenAPI, UML
│       ├── ts1-trustmarkresource-data-model.json
│       ├── ts1-wallettrustmarkinformation-data-model.json
│       ├── ts2-eudi-provider.json
│       ├── ts2-eudi-provider.xsd
│       ├── ts2-openapi-eudi-provider.json
│       ├── ts5-json-common-rp-data-model.json
│       ├── ts5-openapi31-registrar-api.yml
│       ├── ts5-umldiagram.uml
│       ├── ts5-xsd-common-rp-data-model.xsd
│       ├── ts11-cat-attestations-model.uml
│       ├── ts11-cat-attrib-model.uml
│       ├── ts11-cat-of-attestations-jwt-openapi31.yml
│       ├── ts11-cat-of-attributes-datamodel.json
│       ├── ts11-cat-of-attributes-datamodel.xsd
│       ├── ts11-json-cat-attestations-data-model.json
│       ├── ts11-xds-cat-attestations-data-model.xds
│       ├── ts12-urn-eudi-sca-account_access-1-data-model.json
│       ├── ts12-urn-eudi-sca-emandate-1-data-model.json
│       ├── ts12-urn-eudi-sca-login_risk_transaction-1-data-model.json
│       └── ts12-urn-eudi-sca-payment-1-data-model.json
│
├── rulebooks-catalog/                    (canonical attestation rulebooks repo, mirroring upstream layout)
│   ├── README.md
│   ├── pid/pid-rulebook.md               (the real PID Rulebook, ~32 KB)
│   ├── mdl/mdl-rulebook.md               (small — ISO/IEC 18013-5 does most of the work)
│   └── template/attestation-rulebook-template.md   (template every Rulebook follows)
│
├── reference-implementation/
│   ├── README.md                         (the org's reference-impl README)
│   ├── repositories-list.md              (every iOS/Android/JVM/Python repo)
│   ├── feature-map.md                    (delivered + planned features)
│   ├── FAQ.md                            (FAQ for the reference impl)
│   └── roadmap-README.md                 (the public roadmap repo's README)
│
├── my-synthesis/                         (work I produced on top of the sources)
│   ├── 00-engineering-briefing.md        (~88 KB — main onboarding doc, 1,312 lines)
│   ├── engineering-briefing-mobile.html  (mobile-friendly typeset version)
│   ├── flashcards.md                     (atomic-recall card deck)
│   ├── flashcards.tsv                    (Anki-importable)
│   └── first-week-plan.md                (day-by-day study plan)
│
└── _meta/                                (metadata + governance files; not for upload to a Project)
    ├── manifest.txt                      (file inventory + sizes)
    ├── CHANGELOG.md                      (ARF version history — useful for noticing what's new)
    ├── docs-index.md                     (the upstream docs site index)
    ├── CONTRIBUTING.md                   (how upstream accepts contributions)
    └── SECURITY.md                       (upstream security disclosure policy)
```

---

## Where to start (suggested reading order)

### If you have 30 minutes

Read `my-synthesis/00-engineering-briefing.md`. It's a structured 32-section overview, written specifically for engineers, that covers the whole ecosystem.

### If you have 2 hours

1. The engineering briefing (above).
2. `01-arf-main.md` Chapters 1–5 (foundations, roles, architecture, data model). Skim Chapter 6 (trust model) — come back to it as needed.
3. `annexes/annex-1-definitions.md` — every term you'll see in any other document.
4. `my-synthesis/flashcards.md` — read once, no rote memorisation.

### If you have a week

Follow `my-synthesis/first-week-plan.md`, which is built around the PID + remote presentation flow as an exemplar. Day-by-day, with concrete code-tracing tasks against the reference implementation.

### If you're going deep

After the above:

1. `annexes/high-level-requirements.csv` — load this in a spreadsheet; it's the authoritative HLR list. Filter by Topic, Category, or Part to navigate.
2. `annexes/annex-2.02-...by-topic.md` — read the topics relevant to your area. The HLR identifier prefixes are listed in `flashcards.md`.
3. `technical-specifications/ts3-wallet-unit-attestation.md` if you touch security/keys; pair with `technical-specifications/api/` for concrete schemas.
4. `technical-specifications/ts9-wallet-to-wallet-interactions.md` if you touch W2W.
5. `technical-specifications/ts12-electronic-payments-SCA-implementation-with-wallet.md` if you touch payments.
6. The relevant discussion topic paper for any feature you're building — these capture the *reasoning* behind the HLRs.

---

## What's deliberately NOT in this bundle

- **The Regulation text and CIRs** — these are stable EU legal texts at `eur-lex.europa.eu` / `data.europa.eu`. Cite them by number from your Project; downloading every CIR (which would ~triple the bundle size) buys little.
- **GitHub Issues for individual standards** — the standards-and-tech-specs repo links most ETSI/ISO/OIDF references to GitHub Issues for tracking. The substantive content of those standards lives behind paywalls (ETSI, ISO) or on standards-body sites (W3C, OIDF, IETF).
- **Source code of the reference implementation** — repo URLs are listed in `reference-implementation/repositories-list.md`. Clone the repos you actually need.
- **Image/media assets from the ARF repo** — diagrams referenced in the markdown will render with broken images. If you need them, fetch the `media/` folders from the source repos.
- **Files of zero size upstream** — `rulebooks/pid/README.md` and `rulebooks/mdl/README.md` are 0 bytes upstream (placeholders). Excluded.

---

## Audit trail (so you can trust this bundle)

This bundle was built and then audited. Specifically I verified:

| Check | Result |
| --- | --- |
| All files non-empty (≥500 bytes) or legitimately tiny | ✓ Only annex-3.01/3.02 stubs are tiny — they are upstream redirects to `rulebooks-catalog/`. mDL Rulebook itself is small upstream (53 lines) — confirmed against API. |
| No 404 / "Not Found" content in markdown files | ✓ None found. |
| Canonical HLR CSV included | ✓ `annexes/high-level-requirements.csv` (~656 HLRs). The path is `hltr/high-level-requirements.csv` upstream — different from what I initially expected. |
| All 28 discussion-topic papers + README | ✓ |
| All 14 EC Technical Specifications | ✓ TS1–TS14, all from the standards-and-tech-specs repo |
| TS API artifacts (data models) | ✓ All 20 JSON/XSD/UML/YAML files for TS1, TS2, TS5, TS11, TS12 |
| Rulebooks Catalog mirrors upstream | ✓ pid/, mdl/, template/ subdirectories |
| Annex 4 PDFs | ✓ All 12 service blueprints |
| Annex 6 PDF | ✓ Certification Requirements |
| ARF main repo's `docs/technical-specifications/` files | ✓ Verified to be redirect stubs only; canonical TS docs live in the standards repo (already included). |
| ARF repo's main markdown is up to date | ✓ Pulled from `main` branch at compile time |

Files that were small or empty but legitimately so:
- `annexes/annex-3.01-pid-rulebook.md` — upstream redirect stub (real content in `rulebooks-catalog/pid/`)
- `annexes/annex-3.02-mDL-rulebook.md` — upstream redirect stub (real content in `rulebooks-catalog/mdl/`)
- `rulebooks-catalog/mdl/mdl-rulebook.md` — genuinely short upstream because mDL is fully specified by ISO/IEC 18013-5 (so the Rulebook is a thin EUDI-specific overlay)

---

## Project description suggestion (paste into Claude Project setup)

> This Project contains the complete European Digital Identity Wallet Architecture and Reference Framework (ARF) corpus as of 2026.05:
>
> - The ARF main document (Chapters 1–11)
> - All annexes (Annex 1 Definitions, Annex 2 HLRs by-topic and by-category and the canonical CSV, Annex 3 PID + mDL Rulebooks, Annex 4 service-blueprint PDFs, Annex 5 design guide + data-sharing scenarios, Annex 6 certification requirements PDF)
> - All 28 discussion-topic papers including 2026 refinement-round versions for Topics C, E, J, X
> - All 14 EC Technical Specifications (TS1–TS14) plus their concrete data-model artifacts (JSON Schema, XSD, OpenAPI, UML)
> - The canonical Attestation Rulebooks Catalog (PID, mDL, and the rulebook template)
> - Reference-implementation overview, repositories list, FAQ, feature map, and roadmap
> - A structured engineering briefing, flashcards, and a study plan as supplementary synthesis
>
> When answering questions:
>
> - Cite specific file names and HLR identifiers (e.g. *"per WIAM_14a in annex-2.02-...md"*).
> - Treat the ARF as **informative**; only **Regulation (EU) 2024/1183** and the adopted **Commission Implementing Regulations** (CIRs) are legally binding. Distinguish clearly when a requirement comes from law vs ARF guidance.
> - When checking authoritative HLR text, prefer `high-level-requirements.csv` (the canonical machine-readable source) over the .md files (which are derived from it).
> - Note when content is from a 2026 refinement-round paper vs the integrated ARF — refinements may not yet be normative.
> - Distinguish the four attestation categories (PID, QEAA, PuB-EAA, EAA) and their respective trust mechanisms.
> - Default to the latest Topic-C-refinement terminology: **WUA = umbrella**, with **WIA** (Wallet Instance Attestation) and **KA** (Key Attestation) as its two components.

---

## Source URLs (for staying current)

The live primary sources, in case you want to refresh this bundle later:

- **ARF site:** `https://eudi.dev/latest/`
- **ARF source repo:** `https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework`
- **Standards & Technical Specifications repo:** `https://github.com/eu-digital-identity-wallet/eudi-doc-standards-and-technical-specifications`
- **Attestation Rulebooks Catalog:** `https://github.com/eu-digital-identity-wallet/eudi-doc-attestation-rulebooks-catalog`
- **Reference Implementation org:** `https://github.com/eu-digital-identity-wallet`
- **Roadmap repo:** `https://github.com/eu-digital-identity-wallet/eudi-wallet-reference-implementation-roadmap`
- **Functional Conformance:** `https://conformance.eudi.dev/latest/`
- **Demo Issuer:** `https://issuer.eudiw.dev/`
- **Demo Verifier:** `https://verifier.eudiw.dev/`
- **Discussions / roadmap:** `https://github.com/eu-digital-identity-wallet/eudi-wallet-reference-implementation-roadmap/discussions`
- **Project board (active topics):** `https://github.com/orgs/eu-digital-identity-wallet/projects/36`
- **Canonical HLR CSV path:** `hltr/high-level-requirements.csv` in the main ARF repo (note: not under `docs/annexes/`)

To refresh this bundle in a few months, the simplest method is to clone the three GitHub repos listed above into the relevant subfolders.
