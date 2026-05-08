# EUDI Wallet — Atomic-Recall Flashcards

> ~32 cards. Only things you'll quote verbatim in code/specs or look up so often that recall beats lookup. **Not** for concepts, flows, or tradeoffs — those are learned by building, not by drilling.

## How to use

- Import `EUDI_FLASHCARDS.tsv` into Anki (File → Import, tab-separated). One deck named `EUDI`.
- Or just review this file by covering the right column. Three passes spaced over a week is enough.
- **Discard a card the moment it stops feeling useful.** This is a crutch, not a curriculum.

---

## Deck 1 — Identifier strings (you'll type these)

| Q | A |
| --- | --- |
| PID mdoc attestation type? | `eu.europa.ec.eudi.pid.1` |
| PID mdoc namespace identifier? | `eu.europa.ec.eudi.pid.1` (same value as the attestation type — allowed by ISO/IEC 18013-5) |
| PID SD-JWT VC base `vct`? | `urn:eudi:pid:1` |
| Domestic PID namespace pattern (e.g. Germany)? | `eu.europa.ec.eudi.pid.de.1` (append ISO 3166-1 α-2 country code or 3166-2 region code, then optional version) |
| Portrait attribute format requirement? | JPEG only; ISO/IEC 19794-5 Full Frontal Image quality (clauses 8.2–8.4); **no** ISO 19794-5 headers/blocks (clauses 8.1, 8.5 explicitly excluded) |
| `attestation_legal_category` value for a PID? | `"PID"` |
| mDL format restriction? | mdoc only (ISO/IEC 18013-5). MUST NOT be SD-JWT VC. |
| Wallet user account auth requirement? | Independent of the Wallet Unit and the User device (so the user can revoke after device loss) |

## Deck 2 — Counts and enumerations (orientation)

| Q | A |
| --- | --- |
| How many WSCD architecture types? | 5 + Hybrid: **Remote, Local External, Local Internal, Local Native, Hybrid** |
| How many issuance methods? | 4: **A** Once-only, **B** Limited-time, **C** Rotating-batch, **D** Per-RP |
| How many pseudonym use cases? | 4: **A** Pseudonymous auth, **B** Attribute registration + pseudonymous auth, **C** Rate-limited, **D** Linkable across actors |
| How many attestation categories? | 4: PID, QEAA, PuB-EAA, EAA |
| How many design principles? | 5: User-centricity, Accessibility, Interoperability, Privacy by design, Security by design |
| How many high-level risks in the Risk Register? | R1–R14 + SR1–SR3 + technical threats TT1–TT5 |

## Deck 3 — Issuance methods (memorise the trade)

| Q | A |
| --- | --- |
| Method A? | **Once-only** attestations. Mandatory for WUAs. Fully mitigates RP linkability. Highest issuance overhead. |
| Method B? | **Limited-time**. Multiple uses, periodic re-issuance. Mandatory minimum (A or B) for all PIDs/attestations. Partial linkability mitigation. |
| Method C? | **Rotating batch**. Issued in batches; used in random order; resets when exhausted. Optional. Partial mitigation. |
| Method D? | **Per-RP**. Same RP always gets the same attestation, but different RPs get different ones. Optional. Full *intra*-RP unlinkability. |
| What's the mandatory minimum support? | A or B. Method A is **always** mandatory for WUAs specifically. |

## Deck 4 — CIRs that come up constantly

| Q | A |
| --- | --- |
| CIR 2024/2977? | PID and EAA |
| CIR 2024/2979? | Integrity & core functionalities (incl. pseudonym baseline Art 14, embedded disclosure policies in Annex III) |
| CIR 2024/2980? | Ecosystem notifications |
| CIR 2024/2981? | Certification of Wallet Solutions (Annex I = Risk Register) |
| CIR 2024/2982? | Protocols & interfaces |
| CIR 2025/848? | Registration of wallet-relying parties |
| CIR 2025/847? | Reactions to security breaches of Wallets |
| CIR 2015/1502? | Assurance levels for eID (defines LoA High requirements that PID must meet) |
| CIR 2018/389? | RTS for Strong Customer Authentication under PSD2 |

## Deck 5 — Trust topology (recurring distinction)

| Q | A |
| --- | --- |
| Trusted List vs LoTE — what's the rule? | Trusted List for QTSPs (QEAA Providers, PuB-EAA Providers). LoTE for non-QTSPs (Wallet Providers, PID Providers, Access CAs, Providers of Registration Certificates). |
| Where do RPs live in the trust topology? | **No list for RPs.** Each RP gets one or more access certificates from an Access CA; Wallet Units verify those. |
| Critical assets rule? | Must live in WSCA/WSCD (e.g. PID keys, WUA keys, high-security attestation keys). Non-critical assets may live in a keystore. |

## Deck 6 — HLR prefix → Topic (so you can navigate Annex 2.02 fast)

| Q | A |
| --- | --- |
| `OIA_` | Topic 1 — Accessing online services |
| `PID_` | Topic 3 — PID Rulebook |
| `mDL_` | Topic 4 — mDL Rulebook |
| `RPA_` | Topic 6 — Relying Party authentication & User approval |
| `VCR_` | Topic 7 — Attestation revocation |
| `WUA_` | Topic 9 — Wallet Unit / Wallet Instance Attestation |
| `ISSU_` | Topic 10 — Issuing |
| `PA_` | Topic 11 — Pseudonyms |
| `ARB_` | Topic 12 — Attestation Rulebooks |
| `QES_` | Topic 16 — Signing documents |
| `ACP_` | Topic 18 — Combined presentations / cryptographic binding |
| `DASH_` | Topic 19 — Dashboard / logs |
| `SUA_` | Topic 20 — Strong User Authentication for payments |
| `Reg_` | Topic 27 — Provider/RP registration |
| `RP_` | Topic 29 — Representation paradigm |
| `W2W_` | Topic 30 — Wallet-to-Wallet |
| `Mig_` | Topic 34 — Migration |
| `WURevocation_` | Topic 38 — Wallet Unit revocation |
| `WIAM_` | Topic 40 — Installation, activation, management |
| `EDP_` | Topic 43 — Embedded disclosure policies |
| `RPRC_` | Topic 44 — Registration certificates |
| `RPI_` | Topic 52 — RP intermediaries |
| `ZKP_` | Topic 53 — Zero-Knowledge Proofs |
| `WPSM_` | Topic 56 — Wallet Provider support & maintenance |

## Deck 7 — Protocols & key standards

| Q | A |
| --- | --- |
| Proximity presentation protocol? | ISO/IEC 18013-5 (mdoc / CBOR, over NFC, BLE, or Wi-Fi/QR engagement). **Device retrieval only** — server retrieval is forbidden (ProxId_02). |
| Remote presentation protocol? | OpenID4VP, profiled per HAIP. Response must be encrypted (OIA_09). |
| Issuance protocol? | OpenID4VCI, profiled per HAIP. |
| Remote QES integration protocol? | Cloud Signature Consortium API v2.0 (when SCA is integrated and uses a remote QSCD) — QES_07. |
| Mandatory QES output format? | PAdES (ETSI EN 319 142-1). XAdES, JAdES, CAdES, ASiC are SHOULD. |
| W2W transport? | Proximity only — ISO/IEC 18013-5 (W2W_08). |
| W3C DC API support — when? | Conditional: only when it's a W3C Recommendation, satisfies Topic F expectations, and is broadly supported across browsers/OSes (OIA_08). |

## Deck 8 — Things people get wrong

| Q | A |
| --- | --- |
| Is the ARF legally binding? | **No.** Only Reg (EU) 2024/1183 and adopted CIRs are. The ARF is informative. |
| Can the Wallet Provider see what's in the Wallet Unit? | **No.** WIAM_12a explicitly forbids it (attestations present, status, attribute values, transaction log all hidden from the Provider). |
| Does the Wallet Unit need a registration certificate? | No — registration certificates are for **PID/Attestation Providers and Relying Parties**, not Wallet Units. Wallet Units carry WUAs (and now WIAs + KAs after the Topic C refinement). |
| Can a single legal entity be both Wallet Provider and PID Provider? | Yes, if it satisfies all requirements for both and avoids conflicts of interest. |
| What's the Wallet Provider's obligation on revocation notice? | Within **24 hours**, via a **communication channel independent** of the Wallet Unit (WURevocation_14, _16). |
| Can users be tracked across RPs by default? | Default formats (mdoc, SD-JWT VC) without re-issuance permit RP linkability. Mitigation requires Method A (full) or Method B (partial), or future ZKP. |
