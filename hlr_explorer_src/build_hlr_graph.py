#!/usr/bin/env python3
"""Build the EUDI HLR graph: HLRs + Topics + TS + Legal + Features + Tensions + Narratives + Definitions + Quiz + Discussions."""

import csv
import json
import re
from pathlib import Path
from collections import defaultdict

# Project layout:
#   <project>/
#     index.html                    ← rendered output (committed)
#     eudi_knowledge_bundle/        ← bundle data (read-only sources)
#     hlr_explorer_src/             ← all build sources (this script lives here)
#       build_hlr_graph.py
#       shell.html
#       style.css
#       hlr_graph.json              ← build artifact (intermediate)
#       js/*.js
#
# All paths are derived from the location of this script so the project can be
# moved without breaking anything.
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
BUNDLE = PROJECT_DIR / "eudi_knowledge_bundle"
CSV_PATH = BUNDLE / "annexes/high-level-requirements.csv"
ANNEX1_PATH = BUNDLE / "annexes/annex-1-definitions.md"
FLASH_TSV_PATH = BUNDLE / "my-synthesis/flashcards.tsv"
FLASH_MD_PATH = BUNDLE / "my-synthesis/flashcards.md"
DISC_DIR = BUNDLE / "discussion-topics"
LEGAL_TEXT_DIR = BUNDLE / "legal-texts/text"
LEGAL_PDF_DIR_REL = "eudi_knowledge_bundle/legal-texts/pdf"  # bundle-relative path for browser links
FEATURE_MAP_PATH = BUNDLE / "reference-implementation/feature-map.md"
BLUEPRINT_DIR_REL = "eudi_knowledge_bundle/annexes/annex-4-service-blueprints"
BLUEPRINT_TEXT_DIR = BUNDLE / "annexes/annex-4-service-blueprints/text"
OUT_PATH = SCRIPT_DIR / "hlr_graph.json"

# Bake (concat-source-files) configuration
SRC_DIR = SCRIPT_DIR
SHELL_PATH = SRC_DIR / "shell.html"
STYLE_PATH = SRC_DIR / "style.css"
JS_DIR = SRC_DIR / "js"
RENDERED_HTML_PATH = PROJECT_DIR / "index.html"

# ============================================================
# HLR cross-reference detection
# ============================================================
KNOWN_PREFIXES = [
    "OIA", "PID", "mDL", "RPA", "VCR", "WUA", "ISSU", "PA", "ARB", "QES", "ACP", "DASH", "SUA",
    "ProxId", "CAT", "Reg", "LP", "RP", "W2W", "Mig", "WURevocation", "WIAM", "QTSPAS", "EDP",
    "RPRC", "DATA_DLT", "RPT_DPA", "PAD", "RPI", "ZKP", "ACC", "CT", "WPSM",
    "GenNot", "PPNot", "WPNot", "PuBPNot", "RPACANot", "TLPub",
]
prefix_alt = "|".join(re.escape(p) for p in sorted(KNOWN_PREFIXES, key=len, reverse=True))
HLR_REGEX = re.compile(rf"\b({prefix_alt})_(\d+)([a-z]*)\b")


# ============================================================
# Topic → TS / Legal mappings (audited)
# ============================================================
TOPIC_TO_TS = {
    "9":  ["TS3"], "10": ["TS3"], "12": ["TS11"],
    "19": ["TS1", "TS10", "TS12"], "20": ["TS12"], "25": ["TS11"],
    "27": ["TS5", "TS6"], "30": ["TS9"], "31": ["TS2"],
    "34": ["TS10"], "38": ["TS3"], "44": ["TS5"],
    "48": ["TS7"], "50": ["TS8", "TS10"], "52": ["TS5"],
    "53": ["TS4", "TS13", "TS14"],
}
TOPIC_TO_LEGAL = {
    "1":  ["CIR 2024/2982"], "3":  ["CIR 2024/2977"], "4":  ["CIR 2024/2977"],
    "6":  ["CIR 2024/2982", "CIR 2025/848"], "7":  ["CIR 2024/2977", "CIR 2024/2979"],
    "9":  ["CIR 2024/2977", "CIR 2024/2979"],
    "10": ["CIR 2024/2977", "CIR 2024/2982", "CIR 2015/1502"],
    "11": ["CIR 2024/2979"], "12": ["CIR 2024/2977", "CIR 2025/1569"],
    "16": ["Reg 2024/1183"],
    "20": ["Reg 2024/1183", "Dir 2015/2366", "CDR 2018/389"],
    "27": ["CIR 2025/848"], "29": ["Reg 2024/1183"],
    "31": ["CIR 2024/2980"], "38": ["CIR 2024/2977"],
    "40": ["CIR 2024/2981", "CIR 2024/2979", "CIR 2015/1502"],
    "42": ["Reg 2024/1183"], "43": ["CIR 2024/2979"], "44": ["CIR 2025/848"],
    "48": ["GDPR (Reg 2016/679)"], "50": ["GDPR (Reg 2016/679)"],
    "54": ["Dir 2016/2102", "Dir 2019/882"],
}
TS_META = {
    "TS1":  "EUDI Wallet Trust Mark",
    "TS2":  "Provider Notification & Publication",
    "TS3":  "Wallet Unit Attestations",
    "TS4":  "Zero-Knowledge Proofs",
    "TS5":  "Common formats & API for RP Registration info",
    "TS6":  "Common set of RP info to be registered",
    "TS7":  "Common interface for data-deletion requests",
    "TS8":  "Common interface for DPA reporting",
    "TS9":  "Wallet-to-Wallet interactions",
    "TS10": "Data portability and download (export)",
    "TS11": "Catalogue of Attestation Rulebooks — interfaces & formats",
    "TS12": "Electronic-payments SCA implementation",
    "TS13": "ZK-SNARKs",
    "TS14": "ZKPs from MMS",
}
LEGAL_META = {
    "Reg 2024/1183":      ("European Digital Identity Regulation (parent)", "2024", "regulation"),
    "CIR 2024/2977":      ("PID and EAA", "2024", "cir"),
    "CIR 2024/2979":      ("Integrity & core functionalities", "2024", "cir"),
    "CIR 2024/2980":      ("Ecosystem notifications", "2024", "cir"),
    "CIR 2024/2981":      ("Certification of Wallet Solutions", "2024", "cir"),
    "CIR 2024/2982":      ("Protocols & interfaces", "2024", "cir"),
    "CIR 2025/848":       ("Registration of wallet-relying parties", "2025", "cir"),
    "CIR 2025/1569":      ("PuB-EAA requirements", "2025", "cir"),
    "CIR 2015/1502":      ("LoA assurance levels (defines LoA High)", "2015", "cir"),
    "Dir 2015/2366":      ("PSD2 — Payment Services Directive 2", "2015", "directive"),
    "CDR 2018/389":       ("RTS for Strong Customer Authentication", "2018", "delegated"),
    "Dir 2016/2102":      ("Web Accessibility Directive", "2016", "directive"),
    "Dir 2019/882":       ("European Accessibility Act", "2019", "directive"),
    "GDPR (Reg 2016/679)": ("General Data Protection Regulation", "2016", "regulation"),
}


# ============================================================
# Curated FEATURES — operational clusters for the Compliance Lens
# Each maps to: prefixes/HLRs that apply, key topics, linked TS / Legal.
# ============================================================
FEATURES = [
    {
        "id": "feat_pid_issuance",
        "name": "PID Issuance",
        "icon": "🪪",
        "summary": "Issuing the Person Identification Data attestation from a Member-State PID Provider into the Wallet Unit. The most foundational issuance flow — every other attestation builds on this.",
        "primary_topics": ["3", "10", "9", "40"],
        "primary_prefixes": ["PID", "ISSU", "WUA", "WIAM"],
        "key_hlrs": ["PID_01", "PID_02", "ISSU_01", "ISSU_05", "WIAM_14", "WIAM_14a", "WUA_01"],
        "ts": ["TS3"],
        "legal": ["CIR 2024/2977", "CIR 2024/2982", "CIR 2015/1502"],
    },
    {
        "id": "feat_remote_presentation",
        "name": "Remote Presentation (OpenID4VP)",
        "icon": "🌐",
        "summary": "Presenting attestations to a Relying Party over the internet via OpenID4VP, profiled per HAIP. Includes RP authentication, scope check, embedded-disclosure-policy evaluation, user approval, and encrypted response.",
        "primary_topics": ["1", "6", "44", "43"],
        "primary_prefixes": ["OIA", "RPA", "RPRC", "EDP"],
        "key_hlrs": ["OIA_01", "OIA_03b", "OIA_03c", "OIA_09", "OIA_16", "RPA_06", "RPRC_19", "EDP_01"],
        "ts": ["TS5", "TS6"],
        "legal": ["CIR 2024/2982", "CIR 2025/848"],
    },
    {
        "id": "feat_proximity_presentation",
        "name": "Proximity Presentation (mDL / mdoc)",
        "icon": "📡",
        "summary": "Presenting attestations in person via ISO/IEC 18013-5 — mDL to a police officer's reader, age verification at a counter. NFC/BLE/QR engagement; no internet required.",
        "primary_topics": ["4", "24"],
        "primary_prefixes": ["mDL", "ProxId"],
        "key_hlrs": ["mDL_01", "ProxId_01", "ProxId_02", "ProxId_03"],
        "ts": [],
        "legal": ["CIR 2024/2977"],
        "external_specs": ["ISO/IEC 18013-5", "ISO/IEC 23220-2"],
    },
    {
        "id": "feat_qes",
        "name": "Qualified Electronic Signatures",
        "icon": "✍️",
        "summary": "Creating QES from the Wallet — local, external, or remote QSCD. Free for non-professional use. Defaults to PAdES-baseline output.",
        "primary_topics": ["16"],
        "primary_prefixes": ["QES"],
        "key_hlrs": ["QES_01", "QES_02", "QES_07", "QES_08", "QES_15", "QES_18"],
        "ts": [],
        "legal": ["Reg 2024/1183"],
        "external_specs": ["ETSI EN 319 142-1 (PAdES)", "CSC API v2.0", "ETSI TS 119 431-1/-2", "ETSI TS 119 432"],
    },
    {
        "id": "feat_sca_payments",
        "name": "Strong User Authentication for Payments",
        "icon": "💳",
        "summary": "Wallet acting as PSD2-compliant SCA authenticator — the SUA attestation includes transactional data signed in the device-binding. Supports both ASPSP-issued (2-party) and payee-issued (3-party) flows.",
        "primary_topics": ["20"],
        "primary_prefixes": ["SUA"],
        "key_hlrs": ["SUA_01", "SUA_02a", "SUA_05", "SUA_06", "SUA_07"],
        "ts": ["TS12"],
        "legal": ["Reg 2024/1183", "Dir 2015/2366", "CDR 2018/389"],
    },
    {
        "id": "feat_w2w",
        "name": "Wallet-to-Wallet",
        "icon": "🔁",
        "summary": "Holder Wallet presenting an attestation to a Verifier Wallet in proximity. Both modes are user-initiated, time-out, and the Verifier must not persist received data.",
        "primary_topics": ["30"],
        "primary_prefixes": ["W2W"],
        "key_hlrs": ["W2W_01", "W2W_05", "W2W_08", "W2W_19", "W2W_21"],
        "ts": ["TS9"],
        "legal": [],
    },
    {
        "id": "feat_pseudonyms",
        "name": "Pseudonyms",
        "icon": "🎭",
        "summary": "Generating, storing, and presenting per-RP pseudonyms via WebAuthn. Four use cases (A/B/C/D) — only A is fully supported today; C and D need additional spec work.",
        "primary_topics": ["11"],
        "primary_prefixes": ["PA"],
        "key_hlrs": ["PA_01", "PA_15", "PA_16", "PA_17", "PA_20", "PA_21"],
        "ts": [],
        "legal": ["CIR 2024/2979"],
        "external_specs": ["W3C WebAuthn L2"],
    },
    {
        "id": "feat_activation",
        "name": "Wallet Unit Activation",
        "icon": "⚡",
        "summary": "Initialising a fresh Wallet Unit: device data collection, two-factor user authentication setup, WUA + WIA issuance, user-account creation at the Wallet Provider, certification verification.",
        "primary_topics": ["40"],
        "primary_prefixes": ["WIAM"],
        "key_hlrs": ["WIAM_03", "WIAM_05", "WIAM_06", "WIAM_10", "WIAM_14", "WIAM_15"],
        "ts": [],
        "legal": ["CIR 2024/2981", "CIR 2024/2979", "CIR 2015/1502"],
    },
    {
        "id": "feat_wu_revocation",
        "name": "Wallet Unit Revocation",
        "icon": "🚫",
        "summary": "Revoking a Wallet Unit (or its individual KAs). Cascades into PID revocation. Must notify the user within 24h via an independent channel.",
        "primary_topics": ["38", "7"],
        "primary_prefixes": ["WURevocation", "VCR"],
        "key_hlrs": ["WURevocation_07", "WURevocation_09", "WURevocation_10", "WURevocation_14", "WURevocation_18"],
        "ts": ["TS3"],
        "legal": ["CIR 2024/2977"],
    },
    {
        "id": "feat_migration",
        "name": "Migration to a different Wallet Solution",
        "icon": "📦",
        "summary": "Exporting the Wallet Unit's contents (PIDs, attestations, transaction log) into a Migration Object the user can restore on a new device or different Wallet Solution.",
        "primary_topics": ["34"],
        "primary_prefixes": ["Mig"],
        "key_hlrs": ["Mig_01", "Mig_03", "Mig_04", "Mig_05", "Mig_06", "Mig_11"],
        "ts": ["TS10"],
        "legal": [],
    },
    {
        "id": "feat_dashboard_gdpr",
        "name": "Dashboard, Logs & GDPR Rights",
        "icon": "📊",
        "summary": "User-facing transaction log + dashboard. Users can review transactions, request data deletion from RPs (Art 17), report suspicious requests to a DPA, and delete their own attestations.",
        "primary_topics": ["19", "48", "50", "51"],
        "primary_prefixes": ["DASH", "DATA_DLT", "RPT_DPA", "PAD"],
        "key_hlrs": ["DASH_02", "DASH_03", "DASH_03a", "DASH_06a", "DATA_DLT_01", "RPT_DPA_01", "PAD_01"],
        "ts": ["TS7", "TS8", "TS10"],
        "legal": ["GDPR (Reg 2016/679)"],
    },
    {
        "id": "feat_disclosure_policies",
        "name": "Embedded Disclosure Policies",
        "icon": "🔐",
        "summary": "Issuer-controlled rules embedded in attestations that constrain who may receive them. Two policy types: 'Authorised RPs only' and 'Specific root of trust'.",
        "primary_topics": ["43"],
        "primary_prefixes": ["EDP"],
        "key_hlrs": ["EDP_01", "EDP_02", "EDP_03", "EDP_06", "EDP_09", "EDP_11"],
        "ts": [],
        "legal": ["CIR 2024/2979"],
    },
]


# ============================================================
# LEARNING PATHS — ordered, narrated walks through the corpus
# Each step points to one or more nodes. Per-step completion
# is tracked in localStorage by the UI.
# ============================================================
LEARNING_PATHS = [
    {
        "id": "path_first_week",
        "name": "First-week onboarding",
        "icon": "🎓",
        "summary": "Day-by-day plan for a new engineer joining the project. ~7 hours over 7 days.",
        "audience": "New to EUDI · iOS engineer · zero prior context",
        "estimated_minutes": 420,
        "steps": [
            {
                "title": "Day 1 — Lay of the land",
                "annotation": "Open the engineering briefing's §1–§4. Understand who's in the ecosystem (18 roles), what trust flows where, and the four functional clusters. Skip the deep architecture.",
                "primary": "topic_1", "covers": ["topic_1", "OIA_01"], "estimated_minutes": 60,
            },
            {
                "title": "Day 2 — PID Rulebook",
                "annotation": "The PID is your foundational attestation. Read the Topic 3 narrative, scan PID_01/02/08. Then open the canonical PID Rulebook in the bundle. Map the data model to CIR 2024/2977 Annex.",
                "primary": "topic_3", "covers": ["topic_3", "PID_01", "PID_02", "PID_08", "legal_CIR_2024-2977"], "estimated_minutes": 60,
            },
            {
                "title": "Day 3 — WUA & the trust spine",
                "annotation": "Read the Topic 9 narrative. The WIA/KA split (Topic C refinement) is critical — anticipate it. Skim TS3.",
                "primary": "topic_9", "covers": ["topic_9", "WUA_01", "WUA_03", "WUA_05", "ts_TS3"], "estimated_minutes": 60,
            },
            {
                "title": "Day 4 — Issuance protocol",
                "annotation": "Read the Topic 10 narrative. Understand the four issuance methods (A/B/C/D) — pick A for highest privacy unless you have a reason. ISSU_19/35 are critical.",
                "primary": "topic_10", "covers": ["topic_10", "ISSU_01", "ISSU_19", "ISSU_35"], "estimated_minutes": 60,
            },
            {
                "title": "Day 5 — Presentation protocol",
                "annotation": "Trace a presentation request from RP → Wallet → User approval → encrypted response. Read OIA_03b/c (HAIP profile), RPA_02 (access certs), OIA_09 (encryption), OIA_16 (RP discard).",
                "primary": "topic_6", "covers": ["topic_6", "OIA_03b", "RPA_02", "OIA_09", "OIA_16"], "estimated_minutes": 60,
            },
            {
                "title": "Day 6 — The auth contract (WIAM)",
                "annotation": "Read Topic 40 narrative. WIAM_14 is the root: LoA-High auth before any crypto op on PID assets. WIAM_14a/b/c are the extensions you must implement carefully.",
                "primary": "topic_40", "covers": ["topic_40", "WIAM_14", "WIAM_14a", "WIAM_14b", "WIAM_14c", "WIAM_15"], "estimated_minutes": 60,
            },
            {
                "title": "Day 7 — Pick one open question",
                "annotation": "Hands-on: open the demo issuer at issuer.eudiw.dev, issue a PID into the iOS demo wallet, then present it to verifier.eudiw.dev. Watch the network with mitmproxy. Map what you see to the HLRs you read.",
                "primary": "feat_pid_issuance", "covers": ["feat_pid_issuance"], "estimated_minutes": 60,
            },
        ],
    },
    {
        "id": "path_pid_e2e",
        "name": "PID Issuance — end to end",
        "icon": "🪪",
        "summary": "Trace the canonical issuance flow from spec to wire. ~3 hours.",
        "audience": "Implementing or debugging PID issuance",
        "estimated_minutes": 180,
        "steps": [
            { "title": "1. The PID Rulebook (data model)", "annotation": "What's in a PID, in both formats.", "primary": "topic_3", "covers": ["topic_3", "PID_02"], "estimated_minutes": 25 },
            { "title": "2. Legal basis: CIR 2024/2977", "annotation": "Open the legal text in the bundle. Articles 5–6 cover issuance/revocation; Annex defines the data set.", "primary": "legal_CIR_2024-2977", "covers": ["legal_CIR_2024-2977"], "estimated_minutes": 25 },
            { "title": "3. WUA — what the Issuer sees", "annotation": "How the PID Provider verifies the Wallet Unit before issuing.", "primary": "topic_9", "covers": ["topic_9", "WUA_01", "WUA_05"], "estimated_minutes": 20 },
            { "title": "4. The Issuance protocol (Topic 10)", "annotation": "OpenID4VCI per HAIP. Read narrative + key HLRs.", "primary": "topic_10", "covers": ["topic_10", "ISSU_01"], "estimated_minutes": 25 },
            { "title": "5. The four privacy methods", "annotation": "ISSU_42 family. Pick A or B. Understand the privacy implications.", "primary": "ISSU_42", "covers": ["ISSU_42"], "estimated_minutes": 20 },
            { "title": "6. User auth contract", "annotation": "WIAM_14 — LoA-High auth before any crypto op on PID assets. The non-negotiable.", "primary": "WIAM_14", "covers": ["WIAM_14", "WIAM_14a"], "estimated_minutes": 15 },
            { "title": "7. Verification at receipt", "annotation": "ISSU_19/28 — verifying the WUA + WSCD properties at issuance.", "primary": "ISSU_19", "covers": ["ISSU_19"], "estimated_minutes": 15 },
            { "title": "8. Implementing TS: TS3", "annotation": "The technical spec for WUAs. Open TS3 in the bundle.", "primary": "ts_TS3", "covers": ["ts_TS3"], "estimated_minutes": 20 },
            { "title": "9. Hands-on: trace a real issuance", "annotation": "Use issuer.eudiw.dev → demo wallet. Capture the OpenID4VCI calls. Map credential offer → token endpoint → credential endpoint to the HLRs.", "primary": "feat_pid_issuance", "covers": ["feat_pid_issuance"], "estimated_minutes": 15 },
        ],
    },
    {
        "id": "path_remote_present",
        "name": "Remote Presentation — end to end",
        "icon": "🌐",
        "summary": "From RP request → user approval → encrypted response. ~2.5 hours.",
        "audience": "Implementing OpenID4VP-based presentation",
        "estimated_minutes": 150,
        "steps": [
            { "title": "1. Topic 1 narrative — the protocol envelope", "annotation": "Online services use OpenID4VP profiled per HAIP. Get the high-level shape.", "primary": "topic_1", "covers": ["topic_1"], "estimated_minutes": 15 },
            { "title": "2. OIA_01 — the gateway", "annotation": "What the Wallet must support. A two-line requirement that's the basis of everything else.", "primary": "OIA_01", "covers": ["OIA_01"], "estimated_minutes": 10 },
            { "title": "3. HAIP profile — OIA_03b/c", "annotation": "The mandatory HAIP §5 + §6 compliance. mdoc and SD-JWT VC have different profile sections.", "primary": "OIA_03b", "covers": ["OIA_03b", "OIA_03c"], "estimated_minutes": 20 },
            { "title": "4. Topic 6 narrative — RP authentication", "annotation": "How the Wallet authenticates the RP before disclosure.", "primary": "topic_6", "covers": ["topic_6"], "estimated_minutes": 15 },
            { "title": "5. Access certificates: RPA_02", "annotation": "ETSI TS 119 475 + 119 411-8. The trust mechanism for RPs.", "primary": "RPA_02", "covers": ["RPA_02"], "estimated_minutes": 15 },
            { "title": "6. User approval flow: RPA_07", "annotation": "What the user sees. The Wallet must retain authority over approval.", "primary": "RPA_07", "covers": ["RPA_07"], "estimated_minutes": 15 },
            { "title": "7. Topic 43 — embedded disclosure policies", "annotation": "Issuer-controlled rules that constrain who may receive an attestation.", "primary": "topic_43", "covers": ["topic_43", "EDP_01"], "estimated_minutes": 15 },
            { "title": "8. Topic 44 — registration certificates", "annotation": "How RPs prove their registered scope. Includes service identifiers per Topic X refinement.", "primary": "topic_44", "covers": ["topic_44", "RPRC_19a"], "estimated_minutes": 20 },
            { "title": "9. OIA_16 — privacy hygiene", "annotation": "RP discards unique elements after use. The matching half of issuance privacy.", "primary": "OIA_16", "covers": ["OIA_16"], "estimated_minutes": 10 },
            { "title": "10. OIA_09 — encrypted response", "annotation": "Only the RP Instance can decrypt. The end-of-flow security control.", "primary": "OIA_09", "covers": ["OIA_09"], "estimated_minutes": 15 },
        ],
    },
    {
        "id": "path_auth_contract",
        "name": "The Auth Contract (deep dive)",
        "icon": "🔒",
        "summary": "Understand the WIAM_14 family — when and how the Wallet authenticates the user. ~90 minutes.",
        "audience": "Building Secure Enclave / WSCD / TEE integration",
        "estimated_minutes": 90,
        "steps": [
            { "title": "1. WIAM_14 — the root requirement", "annotation": "WSCA/WSCD authenticates user at LoA High before any crypto op on PID critical assets.", "primary": "WIAM_14", "covers": ["WIAM_14"], "estimated_minutes": 12 },
            { "title": "2. WIAM_14a — extends to WUA assets", "annotation": "Same rule for WUA private keys.", "primary": "WIAM_14a", "covers": ["WIAM_14a"], "estimated_minutes": 8 },
            { "title": "3. WIAM_14b — high-security attestations", "annotation": "Attestations of 'level of security High' (e.g. SUA payments) get the same treatment.", "primary": "WIAM_14b", "covers": ["WIAM_14b"], "estimated_minutes": 10 },
            { "title": "4. WIAM_14c — keystore relaxation", "annotation": "Non-critical assets may live in a keystore (Secure Element / TEE / TPM). Define your boundary.", "primary": "WIAM_14c", "covers": ["WIAM_14c"], "estimated_minutes": 10 },
            { "title": "5. WIAM_15 — multi-factor framework", "annotation": "The Wallet Instance authenticates the user via the device's MFA. Possession is one factor.", "primary": "WIAM_15", "covers": ["WIAM_15"], "estimated_minutes": 12 },
            { "title": "6. WIAM_15a/b/c — OS, Wallet PIN, keystore unlock", "annotation": "When OS-level auth is enough; when a Wallet-specific PIN supplements.", "primary": "WIAM_15a", "covers": ["WIAM_15a", "WIAM_15b", "WIAM_15c"], "estimated_minutes": 12 },
            { "title": "7. WIAM_17 — CIR 2015/1502 §2.2.1", "annotation": "The legal definition of LoA-High auth. Open the CIR in the bundle and read §2.2.1.", "primary": "WIAM_17", "covers": ["WIAM_17", "legal_CIR_2015-1502"], "estimated_minutes": 15 },
            { "title": "8. The 'one auth event = one Wallet Unit action' principle", "annotation": "WIAM_14's note clarifies you don't need a separate auth per crypto op. Define what 'action' means in your app.", "primary": "WIAM_14", "covers": ["WIAM_14"], "estimated_minutes": 11 },
        ],
    },
    {
        "id": "path_privacy",
        "name": "Privacy & linkability mitigation",
        "icon": "🔐",
        "summary": "The four issuance methods, RP discard, ZKP roadmap. ~2 hours.",
        "audience": "Privacy review / threat-modelling",
        "estimated_minutes": 120,
        "steps": [
            { "title": "1. Two linkability classes", "annotation": "RP linkability vs. Attestation Provider linkability. Different threats, different mitigations.", "primary": "topic_53", "covers": ["topic_53"], "estimated_minutes": 15 },
            { "title": "2. The four issuance methods", "annotation": "Method A (once-only, full mitigation), B (limited-time, partial), C (rotating-batch), D (per-RP).", "primary": "ISSU_42", "covers": ["ISSU_42"], "estimated_minutes": 20 },
            { "title": "3. ISSU_35 — unique elements at issuance", "annotation": "Salts/hashes/keys must have negligible collision probability.", "primary": "ISSU_35", "covers": ["ISSU_35"], "estimated_minutes": 10 },
            { "title": "4. OIA_16 — the RP-side discard", "annotation": "RP must drop unique elements after use. The matching half of method-A privacy.", "primary": "OIA_16", "covers": ["OIA_16"], "estimated_minutes": 10 },
            { "title": "5. ZKP Topic 53 — what's required", "annotation": "ZKP_01-09. The contract any future ZKP scheme must satisfy.", "primary": "topic_53", "covers": ["ZKP_01", "ZKP_03", "ZKP_04"], "estimated_minutes": 25 },
            { "title": "6. ZKP Topic 53 — TS landscape", "annotation": "TS4, TS13, TS14 are the three EC ZKP specs. None selected as canonical yet.", "primary": "ts_TS4", "covers": ["ts_TS4", "ts_TS13", "ts_TS14"], "estimated_minutes": 20 },
            { "title": "7. Pseudonyms and ZKP intersection", "annotation": "Topic 11 + Topic E refinement. ZKP-derived pseudonyms could enable Use Case D.", "primary": "topic_11", "covers": ["topic_11", "PA_22"], "estimated_minutes": 20 },
        ],
    },
    {
        "id": "path_wu_lifecycle",
        "name": "Wallet Unit lifecycle",
        "icon": "♻️",
        "summary": "From install through revocation. The operational backbone. ~2.5 hours.",
        "audience": "Wallet Provider operations · QA",
        "estimated_minutes": 150,
        "steps": [
            { "title": "1. Topic 40 narrative", "annotation": "Activation is multi-step: install verify → device data → MFA setup → WUA/WIA issuance → user account.", "primary": "topic_40", "covers": ["topic_40"], "estimated_minutes": 20 },
            { "title": "2. Installation", "annotation": "WIAM_01/02 — official store preferred; alternatives need authenticity verification UX.", "primary": "WIAM_01", "covers": ["WIAM_01", "WIAM_02"], "estimated_minutes": 10 },
            { "title": "3. Activation flow", "annotation": "WIAM_03/04/05 — the activation handshake with the Wallet Provider.", "primary": "WIAM_03", "covers": ["WIAM_03", "WIAM_04", "WIAM_05"], "estimated_minutes": 15 },
            { "title": "4. User account at the Wallet Provider", "annotation": "WIAM_06 — independent auth, recovery channel for revocation. Not on top of the Wallet itself.", "primary": "WIAM_06", "covers": ["WIAM_06"], "estimated_minutes": 10 },
            { "title": "5. WUA + WIA issuance", "annotation": "WIAM_10 — at least one per WSCA/WSCD + one per keystore.", "primary": "WIAM_10", "covers": ["WIAM_10"], "estimated_minutes": 10 },
            { "title": "6. The auth contract (WIAM_14)", "annotation": "LoA-High auth becomes the default before any crypto op on PID assets.", "primary": "WIAM_14", "covers": ["WIAM_14"], "estimated_minutes": 10 },
            { "title": "7. Topic 38 narrative — revocation", "annotation": "Cascades, triggers, the 24h notification rule.", "primary": "topic_38", "covers": ["topic_38"], "estimated_minutes": 20 },
            { "title": "8. Revocation triggers", "annotation": "WURevocation_09 family — security-posture, user request, death-of-natural-person.", "primary": "WURevocation_09", "covers": ["WURevocation_07", "WURevocation_09", "WURevocation_10"], "estimated_minutes": 15 },
            { "title": "9. User notification (24h, independent channel)", "annotation": "WURevocation_14/16. The Wallet Unit itself can't be the notification path.", "primary": "WURevocation_14", "covers": ["WURevocation_14"], "estimated_minutes": 10 },
            { "title": "10. Cascade to PIDs", "annotation": "WURevocation_18. PID Provider checks WUA revocation regularly; revokes PID if Wallet Unit is revoked.", "primary": "WURevocation_18", "covers": ["WURevocation_18"], "estimated_minutes": 10 },
            { "title": "11. Uninstallation", "annotation": "WIAM_13 — secure deletion of cryptographic assets at uninstall.", "primary": "WIAM_13", "covers": ["WIAM_13"], "estimated_minutes": 10 },
            { "title": "12. Migration to a different Wallet Solution", "annotation": "Topic 34 + Mig_01-Mig_11. The user-facing alternative to revocation.", "primary": "topic_34", "covers": ["topic_34", "Mig_01"], "estimated_minutes": 10 },
        ],
    },
    {
        "id": "path_qes",
        "name": "QES integration",
        "icon": "✍️",
        "summary": "Local + remote signing flows. PAdES, CSC API, the three remote modes. ~2 hours.",
        "audience": "Implementing signature features",
        "estimated_minutes": 120,
        "steps": [
            { "title": "1. Topic 16 narrative", "annotation": "Why QES matters; what's mandatory; what's free for users.", "primary": "topic_16", "covers": ["topic_16"], "estimated_minutes": 15 },
            { "title": "2. Free-of-charge requirement", "annotation": "QES_01/02 — every user has access to a qualified certificate + SCA, free for non-professional use.", "primary": "QES_01", "covers": ["QES_01", "QES_02"], "estimated_minutes": 10 },
            { "title": "3. Three remote-QES flows", "annotation": "QES_06: portal, channelled-by-Wallet, channelled-by-RP. Pick at least one.", "primary": "QES_06", "covers": ["QES_06"], "estimated_minutes": 15 },
            { "title": "4. Local vs remote QSCD", "annotation": "QES_03/04 — your Wallet Unit interfaces with whichever QSCD applies.", "primary": "QES_03", "covers": ["QES_03", "QES_04"], "estimated_minutes": 15 },
            { "title": "5. CSC API mandate", "annotation": "QES_07 — when you embed the SCA + use a remote QSCD, you must speak CSC API v2.0.", "primary": "QES_07", "covers": ["QES_07"], "estimated_minutes": 10 },
            { "title": "6. Mandatory output: PAdES", "annotation": "QES_08 — PAdES first. Other formats are SHOULD.", "primary": "QES_08", "covers": ["QES_08"], "estimated_minutes": 10 },
            { "title": "7. User authorisation", "annotation": "QES_14 — explicit per-signature consent, no batch authorisation.", "primary": "QES_14", "covers": ["QES_14"], "estimated_minutes": 10 },
            { "title": "8. QTSP requirements (server side)", "annotation": "QES_23/24 — SCAL 2 compliance. Your QTSP partner must comply.", "primary": "QES_23", "covers": ["QES_23"], "estimated_minutes": 15 },
            { "title": "9. Signature history in dashboard", "annotation": "QES_13 ties into DASH_04 — the user can review signed documents.", "primary": "QES_13", "covers": ["QES_13", "DASH_04"], "estimated_minutes": 10 },
            { "title": "10. Default signing service", "annotation": "QES_18 — your Wallet Unit ships with at least one configured.", "primary": "QES_18", "covers": ["QES_18"], "estimated_minutes": 10 },
        ],
    },
]


# ============================================================
# Topic narratives — engineer-flavored explainers, ~250 words each
# Only for the most-touched topics.
# ============================================================
NARRATIVES = {
    "1": {
        "title": "Online Services with a Wallet Unit",
        "tldr": "The remote-presentation contract: Wallet Units must speak OpenID4VP for online flows and ISO/IEC 18013-5 for proximity. This is the protocol envelope every Relying Party interaction sits inside.",
        "body": "Topic 1 is the bedrock of everything Relying Party-facing. **OIA_01** is the gateway requirement: a Wallet must support both protocols. Everything downstream — SD-JWT VC, mdoc, selective disclosure, key binding — is profiled inside these envelopes.\n\nThe practical breakdown for an iOS engineer: **OIA_03a/b/c** require strict HAIP-profile compliance (Sections 5, 5.1, 5.3). OIA_09 mandates encryption of the presentation response so only the RP Instance can decrypt it. OIA_16 is the hidden trap — the RP Instance must *immediately* discard unique elements (salts, hashes, public keys) and never propagate them. This is the Wallet's primary defence against RP linkability.\n\nOIA_08 family handles the W3C Digital Credentials API — conditional on it becoming a Recommendation. By default the Wallet only discloses attestation *types*, not their attribute presence. There's a global toggle (OIA_08d) you must build.\n\n**Watch for:** The Wallet must support both same-device and cross-device flows. Cross-device introduces session-hijacking risk that's mitigated by one-time-use tokens; the spec leans on HAIP for the exact mechanism. If you only test same-device, you're missing half the surface area.",
        "key_hlrs": ["OIA_01", "OIA_03a", "OIA_03b", "OIA_09", "OIA_16", "OIA_08"],
        "pitfalls": [
            "Forgetting to discard unique elements at the RP — easy to leak via logs.",
            "Implementing only same-device; cross-device QR flow has different security properties.",
            "Treating server retrieval (ProxId_02) as legal — it's explicitly forbidden.",
        ],
    },
    "3": {
        "title": "PID Rulebook",
        "tldr": "The exact data model + encoding for the PID. Two formats are required (mdoc + SD-JWT VC), the attribute set is fixed by CIR 2024/2977, and the technical-vs-administrative validity distinction matters more than it looks.",
        "body": "PIDs are issued in **both** mdoc and SD-JWT VC (PID_02). Same data, two encodings. The mdoc attestation type is `eu.europa.ec.eudi.pid.1`; the SD-JWT VC base type is `urn:eudi:pid:1`.\n\nMandatory attributes (PID_08): `family_name`, `given_name`, `birth_date`, `birth_place`, `nationality`. Plus mandatory metadata: `expiry_date`, `issuing_authority`, `issuing_country`. The portrait is JPEG only, ISO 19794-5 quality but **without** the 19794-5 headers (PID_03 — easy to misread).\n\n**The validity distinction**: administrative validity is what users perceive (\"my PID is good through 2030\"), encoded as the `expiry_date` attribute. Technical validity is the per-token freshness (`nbf`/`exp` in SD-JWT VC, `validFrom` in mdoc), typically days/weeks. PID Providers re-issue technically-fresh PIDs throughout the administrative lifetime — this is the privacy mechanism.\n\nDomestic namespaces (PID_06): Member States may extend with `eu.europa.ec.eudi.pid.de.1`-style domestic namespaces; these go in their own Rulebook.\n\n**Selective disclosure asymmetry**: in mdoc, the entire `nationality` array is disclosed together. In SD-JWT VC, individual nationalities can be selectively disclosed. Same data, different privacy properties.",
        "key_hlrs": ["PID_01", "PID_02", "PID_03", "PID_06", "PID_08", "PID_12"],
        "pitfalls": [
            "Treating administrative validity as technical validity (or vice versa).",
            "JPEG portrait with ISO 19794-5 headers — fails verification.",
            "Trying to selectively disclose one nationality in mdoc — must disclose all or none.",
        ],
    },
    "6": {
        "title": "Relying Party Authentication & User Approval",
        "tldr": "How the Wallet authenticates an RP and obtains user consent. Access certificates per ETSI TS 119 475 + 119 411-8. The User must be informed of the RP's identity and what attributes are requested before approving.",
        "body": "Topic 6 is the security backbone of every Wallet→RP interaction. **RPA_02** establishes the mechanism: access certificates per ETSI TS 119 475 + 119 411-8.\n\nThe sequence: Wallet receives a presentation request → verifies the RP's access certificate against a trust anchor in a notified Access CA's LoTE → checks the certificate isn't revoked → checks the RP isn't suspended → evaluates any embedded disclosure policy → presents the request to the user with the RP's name, requested attributes, and intended use.\n\nThe **user approval** half (RPA_07 family) is highly opinionated: the Wallet must *retain authority* over the approval flow (RPA_08). Failed authentications must be communicated to the user. Replay attacks are prevented by binding the request to a session.\n\n**Topic X refinement (2026)** — pushing toward one access certificate per *service* within an RP organisation. So a healthcare org running both a patient portal and a clinician portal would have two access certs, each bound to its own service identifier. This isn't yet in the integrated ARF but worth designing for.",
        "key_hlrs": ["RPA_01", "RPA_02", "RPA_06", "RPA_06a", "RPA_07", "RPA_08"],
        "pitfalls": [
            "Trusting the browser to authenticate the RP for you — the Wallet must verify, not delegate (PA_20 is a known WebAuthn gap).",
            "Forgetting Topic X refinement: a single access cert covering multiple services may need re-architecting.",
            "Not handling failed authentication gracefully — RPA_06a requires user notification.",
        ],
    },
    "9": {
        "title": "Wallet Unit Attestation (post-Topic-C: WIA + KA)",
        "tldr": "The trust mechanism by which Issuers verify a Wallet Unit before issuing PIDs/attestations. WUA is being split into Wallet Instance Attestation (WIA) and Key Attestation (KA), each with distinct revocation semantics.",
        "body": "Originally a single WUA. The 2026 Topic C refinement splits it: **WIA** attests to the integrity of the Wallet Instance (the app), used during **all** issuance. **KA** attests to the WSCA/WSCD or keystore properties for the keys involved, used only for PID and device-bound attestation issuance. \"WUA\" becomes the umbrella term.\n\n**Revocation maintenance period** is the critical new concept. WUAs are short-lived (TS3 v1.5 caps at ~24h), but PIDs are long-lived. So the Wallet Provider commits to a *revocation maintenance period* — a window during which they continue serving revocation status for the underlying object. PID expiry must not exceed this window.\n\n**Key revocation modes** (per Topic C refinement): Wallet Provider chooses *type-shared* (one revocation status across all units of a WSCD type — used for vulnerability response) or *per-instance* (individual WSCD/keystore revocation, e.g. lost smart card). Per-instance preserves unlinkability.\n\n**WUA_03** governs the cryptographic-keys section: at LoA High, key material in the WUA must come from keys generated by the secure hardware. Compliance with ETSI TS 119 412-6 is mandatory.",
        "key_hlrs": ["WUA_01", "WUA_03", "WUA_05", "WUA_22", "WUA_23"],
        "pitfalls": [
            "Forgetting that WUA validity ≠ PID validity. PID expiry is bounded by the revocation maintenance period, not by WUA freshness.",
            "Not anticipating the WIA/KA split (Topic C is in active refinement). Architect for two distinct attestation types.",
            "Treating revocation as binary across the Wallet Solution. Per-keystore revocation is granular by design.",
        ],
    },
    "10": {
        "title": "Issuance — and the four privacy methods",
        "tldr": "OpenID4VCI per HAIP. The single most important privacy decision: pick A (once-only), B (limited-time), C (rotating-batch), or D (per-RP). At least A or B is mandatory.",
        "body": "Topic 10 is the largest in the corpus (100 HLRs). The base protocol is **OpenID4VCI profiled per HAIP**, but the engineering decision that matters is the **issuance method**.\n\n**Method A (once-only)**: the Wallet receives a batch, presents each attestation exactly once, then discards it. Maximum privacy. Mandatory for WUAs (always); mandatory minimum (alongside B) for everything else.\n\n**Method B (limited-time)**: short-lived attestations, multiple uses, periodic re-issuance. Operationally simpler. Partial linkability mitigation only.\n\n**Method C (rotating-batch)**: random-ordered use across a batch, then reset. Optional. Partial mitigation.\n\n**Method D (per-RP)**: same RP gets the same attestation every time, different RPs get different ones. Optional. Full *intra-RP* unlinkability but creates an inter-RP correlation oracle.\n\n**Privacy-critical** (ISSU_35 family): unique elements (salts, hashes, batch timestamps, public keys) must have negligible collision probability and must be discarded post-issuance by both Wallet and RP. The OIA_16 RP-side discard is the matching half.\n\n**Verification responsibilities** (ISSU_19 onwards): the Issuer authenticates the Wallet via WUA → optionally validates WSCD properties → verifies the new key is hardware-protected → checks WUA revocation status. Implementing this correctly requires correct trust-anchor handling for the Wallet Provider's LoTE.",
        "key_hlrs": ["ISSU_01", "ISSU_19", "ISSU_35", "ISSU_42", "WUA_05"],
        "pitfalls": [
            "Picking Method B for everything because it's simpler — you give up full unlinkability.",
            "Forgetting to discard unique elements after presentation; logs leak privacy.",
            "Not checking WUA revocation status during issuance (ISSU_19/28 family).",
        ],
    },
    "11": {
        "title": "Pseudonyms",
        "tldr": "Per-RP unique pseudonyms via WebAuthn. CIR 2024/2979 Art 14 mandates support; only Use Case A (pseudonymous auth) is fully there today. RPs cannot refuse pseudonyms when identification isn't legally required.",
        "body": "Four use cases, only one fully supported. **Use Case A** (pseudonymous authentication) is the baseline — Wallet generates a unique pseudonym per RP, RP uses it as account identifier. **Use Case B** (attribute registration + pseudonymous auth) is partially supported. **Use Cases C** (rate-limited) and **D** (linkable across RPs) need additional spec work.\n\n**Privacy invariants** are strict (PA_15-PA_19): RP cannot derive user identity from the pseudonym, different pseudonyms per RP, colluding RPs cannot correlate, sufficient entropy to avoid collisions, user-assigned aliases never leak.\n\n**Implementation today** (PA_22): Wallet acts as a WebAuthn authenticator. The known gap: WebAuthn's RP authentication relies on the *Client* (browser) using TLS — the authenticator (Wallet) doesn't natively authenticate the RP itself. PA_20 documents this gap.\n\n**The interoperability requirement** (PA_21) calls for the Commission to publish a profile/extension of WebAuthn that closes the PA_20 gap. Until that lands, Wallet implementations rely on browser-side TLS verification.\n\n**Topic E refinement (2026)** is exploring extensions to WebAuthn vs. moving to attestation- or ZKP-based pseudonyms.",
        "key_hlrs": ["PA_01", "PA_15", "PA_16", "PA_17", "PA_20", "PA_22"],
        "pitfalls": [
            "Trusting the WebAuthn client to authenticate the RP — that's the PA_20 gap.",
            "Building support for Use Cases C/D before the spec's settled.",
            "Forgetting that RPs cannot legally refuse pseudonyms when identification isn't required.",
        ],
    },
    "16": {
        "title": "Qualified Electronic Signatures",
        "tldr": "Wallet must offer free QES for non-professional use. Local, external, or remote QSCD. Mandatory PAdES output. CSC API v2.0 for remote.",
        "body": "QES is one of the few features the Regulation explicitly requires *free of charge* for non-professional users (QES_02). Three QSCD modes: local (on-device), external (USB/NFC hardware), remote (managed by a QTSP).\n\n**The Signature Creation Application (SCA)** can be embedded in the Wallet, an external app, or hosted by the QTSP / RP. If embedded and using a remote QSCD, **CSC API v2.0** is mandatory (QES_07).\n\n**Mandatory output format**: PAdES baseline (ETSI EN 319 142-1). XAdES, JAdES, CAdES, ASiC are SHOULD. If you only ship PAdES you're compliant; if you ship XAdES only, you aren't.\n\n**Three remote-QES flows** (QES_06): authentication to a QTSP web portal, channelled by the Wallet, channelled by the RP. Wallet must support at least one.\n\n**SCAL 2** is mandatory for remote-QSCD operation (QES_23) — you cannot delegate signature creation without sole user control of the activation data.\n\nUser must explicitly authorise each signature (QES_14). The Wallet maintains a signature history (QES_13 + DASH_04).",
        "key_hlrs": ["QES_01", "QES_02", "QES_07", "QES_08", "QES_14", "QES_15"],
        "pitfalls": [
            "Shipping XAdES only — must support PAdES first.",
            "Building a remote-QES integration without verifying SCAL 2 compliance.",
            "Charging for QES on natural-person, non-professional use — that's a regulatory violation.",
        ],
    },
    "20": {
        "title": "Strong User Authentication for Payments",
        "tldr": "Wallet as PSD2 SCA authenticator. SUA attestation includes transactional data signed in the device-binding. TS12 specifies the rendering, processing, and logging rules.",
        "body": "**The SUA attestation** (Strong User Authentication attestation) is a dedicated, **device-bound** attestation issued for SCA purposes. The presentation request includes **transactional data** (amount, payee, reference) which the user must see clearly and approve.\n\n**The signature trick**: the Wallet doesn't just sign a challenge — it signs (a representation of) the transactional data using the SUA attestation's private key, via SD-JWT VC key binding or mdoc authentication. The resulting signature value is the **PSD2 authentication code**.\n\n**Two flow models**: \"Issuer-requested\" (2-party — ASPSP both issues and consumes), supports all SCA use cases. \"Payee-requested\" (3-party — separate issuer and RP), only payment-initiation SCA permitted.\n\n**TS12** (Electronic-payments SCA implementation) specifies the rendering rules — font, contrast, position, what's WYSIWYS — plus processing rules and what must be logged. Topic AA's discussion paper informed these.\n\n**Validation** (SUA_07): on receiving a request, the Wallet must validate that the transactional data is intended for the given attestation (typed correctly) before processing.",
        "key_hlrs": ["SUA_01", "SUA_02a", "SUA_05", "SUA_06", "SUA_07"],
        "pitfalls": [
            "Treating the SCA flow like ordinary OpenID4VP — TS12 has specific rendering and signing requirements.",
            "Not validating the transactional data type before signing — SUA_07.",
            "Forgetting that 3-party flows are restricted to payment initiation.",
        ],
    },
    "30": {
        "title": "Wallet-to-Wallet Interaction",
        "tldr": "Holder Wallet presents to Verifier Wallet in proximity (ISO/IEC 18013-5 only). Both modes user-initiated, time-out, no persistent storage by the Verifier.",
        "body": "**A single Wallet** can act as Holder OR Verifier — not both simultaneously, and not by accident. **W2W_05/W2W_07** require explicit mode selection by the user, with auto-exit on inactivity.\n\n**Proximity only** (W2W_08). No remote W2W. ISO/IEC 18013-5 device retrieval; OpenID4VP isn't supported here.\n\n**Presentation offer** (W2W_11/14): the Holder may pre-declare which attributes they're willing to share, which the Verifier can pick from but can't exceed. This is asymmetric: the Holder controls the upper bound.\n\n**Critical constraint** (W2W_21): the Verifier Wallet must NOT persistently store any received attestations. OIA_16 also applies — discard unique elements ASAP. The Verifier shows attributes on screen, then they're gone.\n\n**Topic J refinement (2026)** debates whether the Verifier Wallet must cryptographically authenticate itself to the Holder (binding to the protocol session). Four candidate approaches under discussion. The ARF currently doesn't require this; the refinement might add it.\n\n**TS9** specifies the wire-level extensions (presentation offer encoding, message format).",
        "key_hlrs": ["W2W_05", "W2W_08", "W2W_11", "W2W_19", "W2W_21"],
        "pitfalls": [
            "Implementing remote W2W — the spec doesn't permit it.",
            "Persisting received attestations on the Verifier side — explicit violation of W2W_21.",
            "Building before Topic J refinement settles; the cryptographic-binding requirement may change.",
        ],
    },
    "38": {
        "title": "Wallet Unit Revocation",
        "tldr": "Revoking a Wallet Unit cascades to its WUAs and (for revocable PIDs) to the PIDs themselves. Revocation must be communicated to the user within 24h via an independent channel.",
        "body": "Revocation in EUDI cascades. **WURevocation_07**: revoking a Wallet Unit means revoking its WUAs. **WURevocation_18**: a PID Provider issuing revocable PIDs must regularly check WUA revocation status; if revoked, the PID Provider MUST revoke the PID. This is a legal cascade in CIR 2024/2977 Art 5(4)(b).\n\n**Revocation triggers** (WURevocation_09 family): user request (WURevocation_10), WSCA/WSCD security breach (revoke all WUAs across all keystores — _09a/b), single keystore breach (revoke that keystore's WUAs only — _09c), critical/high security posture detected via Topic-T monitoring, death of the natural person (_11).\n\n**The 24h notification rule** (WURevocation_14): the Wallet Provider must inform the user within 24 hours of revocation, with reasons, including (if applicable) technical details about the security breach. Independent communication channel (_16) — i.e. not via the Wallet Unit itself, since the revoked Wallet Unit is by definition not trustworthy.\n\n**Death-triggered revocation** (WURevocation_11): a PID Provider can request Wallet Unit revocation when the natural person has died, identified via the Wallet Unit identifier in the WUA.",
        "key_hlrs": ["WURevocation_07", "WURevocation_09", "WURevocation_10", "WURevocation_14", "WURevocation_18"],
        "pitfalls": [
            "Not notifying the user via an independent channel — defeats the purpose.",
            "Failing to cascade Wallet Unit revocation into PID revocation; leaves zombie PIDs.",
            "Not handling the per-keystore revocation case (_09c) — revoking too coarsely loses functionality unnecessarily.",
        ],
    },
    "40": {
        "title": "Wallet Unit Activation & Management (WIAM)",
        "tldr": "The most operationally critical HLR set for an app developer. WIAM_14 (LoA High before any crypto op on PID assets) is the auth contract that flows through everything else.",
        "body": "Activation is multi-step: verify the Wallet Instance is genuine (WIAM_04), collect device + WSCD data (WIAM_05), establish two-factor user authentication (WIAM_15 family), issue WUA + WIA (WIAM_10), set up a user account at the Wallet Provider with **independent** authentication (WIAM_06).\n\n**The auth contract** (WIAM_14, _14a, _14b, _14c): WSCA/WSCD must authenticate the user **at LoA High** before any cryptographic operation on PID assets. Same for WUA assets (_14a). For attestations of \"level of security High\" (_14b). Non-critical assets may live in a keystore (_14c).\n\n**One auth event covers one Wallet Unit action** — meaning a single user authentication can cover all crypto ops needed for one user-initiated action (e.g. one presentation). Wallet Provider defines the scope of \"action\". Certification verifies adequacy.\n\n**WIAM_12a** is non-obvious: the Wallet Unit must ensure the **Wallet Provider cannot access** which attestations are present, their status, attribute values, or transaction logs. The Wallet Provider runs the infrastructure but is not allowed to surveil.\n\n**WIAM_19** (key proof): WSCA/WSCD must be able to prove possession of a private key on Wallet Instance request. **WIAM_20**: keys must be protected for their entire lifetime; cleartext export is forbidden.",
        "key_hlrs": ["WIAM_05", "WIAM_06", "WIAM_10", "WIAM_12a", "WIAM_14", "WIAM_15"],
        "pitfalls": [
            "Implementing the user account auth on top of the Wallet — _06 requires independence.",
            "Allowing the Wallet Provider visibility into Wallet contents — _12a is a hard line.",
            "Asking for user auth too often (every crypto op) when one auth event covers a Wallet Unit action.",
        ],
    },
    "53": {
        "title": "Zero-Knowledge Proofs",
        "tldr": "Specifies what a ZKP scheme MUST do if adopted. No scheme is currently selected. The only known full mitigation for Attestation Provider linkability.",
        "body": "**No ZKP scheme is selected** in the EUDI Wallet ecosystem today. Topic 53 lays out **requirements** any future scheme must meet, not a specific scheme.\n\n**Why ZKPs**: salted-hash attestations (mdoc, SD-JWT VC) are vulnerable to **Attestation Provider linkability** — colluding RPs can share the unique salts/hashes back to the AP, who then tracks the user. Currently mitigated only by org/enforcement measures and re-issuance. ZKP is the only known cryptographic full mitigation.\n\n**Requirements** (ZKP_01-09): hide all attribute values, prove inclusion of specific values, prove validity period, prove non-revocation, prove device binding. Optionally hide the issuer (sometimes you want this — sometimes not).\n\nZKP_03: support privacy-preserving binding between an attestation and a PID — *without* disclosing the linking value to the RP.\n\nZKP_04: support deriving a verifiable pseudonym from a unique-to-user attribute combined with RP-specific context. This would make Use Case D (linkable pseudonyms) implementable without breaking unlinkability.\n\n**Constraint**: must be usable in both proximity and remote flows; latency must not destroy UX. ECCG v2 algorithms only. Doesn't undermine LoA High.\n\n**TS4 / TS13 / TS14** are the three EC technical specifications drafted around this. The Commission is actively exploring ZKP-based age verification.",
        "key_hlrs": ["ZKP_01", "ZKP_03", "ZKP_04", "ZKP_05", "ZKP_07"],
        "pitfalls": [
            "Building features that depend on ZKP today — no scheme is selected.",
            "Forgetting that ZKP must work offline (proximity) AND remote.",
            "Not budgeting for ZKP latency in UX flows; the ARF caps how slow it can be.",
        ],
    },
}


# ============================================================
# Legal-doc id → text filename (under legal-texts/text/)
# Only those linked from TOPIC_TO_LEGAL get parsed and bundled.
# ============================================================
LEGAL_FILE = {
    "Reg 2024/1183":       "reg-2024-1183-eudi-regulation.txt",
    "CIR 2024/2977":       "cir-2024-2977-pid-and-eaa.txt",
    "CIR 2024/2979":       "cir-2024-2979-integrity-and-core-functionalities.txt",
    "CIR 2024/2980":       "cir-2024-2980-ecosystem-notifications.txt",
    "CIR 2024/2981":       "cir-2024-2981-certification-of-wallet-solutions.txt",
    "CIR 2024/2982":       "cir-2024-2982-protocols-and-interfaces.txt",
    "CIR 2025/848":        "cir-2025-848-rp-registration.txt",
    "CIR 2025/1569":       "cir-2025-1569-pub-eaa.txt",
    "CIR 2015/1502":       "cir-2015-1502-loa-assurance-levels.txt",
    "Dir 2015/2366":       "dir-2015-2366-psd2.txt",
    "CDR 2018/389":        "cdr-2018-389-rts-sca.txt",
    "Dir 2016/2102":       "dir-2016-2102-web-accessibility.txt",
    "Dir 2019/882":        "dir-2019-882-eaa-european-accessibility-act.txt",
    "GDPR (Reg 2016/679)": "reg-2016-679-gdpr.txt",
}

# CELEX → legal_id (used by template to intercept EUR-Lex markdown links)
LEGAL_CELEX = {
    "32024R1183":      "Reg 2024/1183",
    "32024R2977":      "CIR 2024/2977",
    "32024R2979":      "CIR 2024/2979",
    "32024R2980":      "CIR 2024/2980",
    "32024R2981":      "CIR 2024/2981",
    "32024R2982":      "CIR 2024/2982",
    "32025R0848":      "CIR 2025/848",
    "32025R1569":      "CIR 2025/1569",
    "32015R1502":      "CIR 2015/1502",
    "32015L2366":      "Dir 2015/2366",
    "32018R0389":      "CDR 2018/389",
    "32016L2102":      "Dir 2016/2102",
    "32019L0882":      "Dir 2019/882",
    "32016R0679":      "GDPR (Reg 2016/679)",
}

# Modern CELEX-less ELI URLs: "/eli/reg_impl/2024/2977/oj" → legal id
LEGAL_ELI = {
    "reg_impl/2024/2977": "CIR 2024/2977",
    "reg_impl/2024/2979": "CIR 2024/2979",
    "reg_impl/2024/2980": "CIR 2024/2980",
    "reg_impl/2024/2981": "CIR 2024/2981",
    "reg_impl/2024/2982": "CIR 2024/2982",
    "reg_impl/2025/848":  "CIR 2025/848",
    "reg_impl/2025/1569": "CIR 2025/1569",
    "reg_impl/2015/1502": "CIR 2015/1502",
    "reg_impl/2018/389":  "CDR 2018/389",
    "reg/2024/1183":      "Reg 2024/1183",
    "reg/2016/679":       "GDPR (Reg 2016/679)",
    "dir/2015/2366":      "Dir 2015/2366",
    "dir/2016/2102":      "Dir 2016/2102",
    "dir/2019/882":       "Dir 2019/882",
}


# ============================================================
# Reference-implementation feature-map → my FEATURES mapping
# ============================================================
FEATMAP_TO_FEAT = {
    "Issuance":                              ["feat_pid_issuance"],
    "Presentation":                          ["feat_remote_presentation", "feat_proximity_presentation"],
    "rQES":                                  ["feat_qes"],
    "Transaction Logs":                      ["feat_dashboard_gdpr"],
    "Pseudonyms":                            ["feat_pseudonyms"],
    "Wallet Revocation":                     ["feat_wu_revocation"],
    "Wallet to Wallet interaction":          ["feat_w2w"],
    "Migrate to a different wallet":         ["feat_migration"],
    # No 1:1 feature: handled via TOPIC_REFIMPL_EXTRA below
    "Attestation Revocation":                [],
    "Support for ZKP":                       [],
    "Wallet Backup and Restore":             [],  # cross-cuts, surface on migration
    "Request data deletion from RPs":        [],
    "Report unlawful or suspicious requests to DPA(s)": [],
}

# Topic-only ref-impl entries (no matching FEATURES entry)
TOPIC_REFIMPL_EXTRA = {
    "7":  ("Attestation Revocation", "Topic 7"),
    "53": ("Support for ZKP",        "Topic 53"),
    "48": ("Request data deletion from RPs", "Topic 48"),
    "50": ("Report unlawful or suspicious requests to DPA(s)", "Topic 50"),
    "34": ("Wallet Backup and Restore", "Topic 34"),
}


# ============================================================
# Service blueprints — hand-crafted Mermaid for top 4
# ============================================================
SERVICE_BLUEPRINTS = [
    {
        "id": "4.01",
        "title": "Wallet Initialisation and Activation",
        "topic": "40",
        "topics_extra": ["3", "9"],   # also touches PID Rulebook + WUA
        "pdf_rel": f"{BLUEPRINT_DIR_REL}/annex-4.01-eudi-wallet-initialisation-and-activation.pdf",
        "summary": "Onboarding journey: discovery → adoption → wallet setup → PID issuance.",
        "mermaid": (
            "sequenceDiagram\n"
            "    actor C as Citizen\n"
            "    participant Store as App Store\n"
            "    participant W as EUDI Wallet\n"
            "    participant WP as Wallet Provider\n"
            "    participant NAS as National Auth System\n"
            "    participant PP as PID Provider\n"
            "\n"
            "    Note over C: Discovery — articles, friends, log-in attempts<br/>(MS-defined)\n"
            "    C->>Store: Search store for the app\n"
            "    C->>Store: Read reviews (optional)\n"
            "    C->>Store: Download app\n"
            "    Store->>WP: Captures download analytics\n"
            "\n"
            "    C->>W: Open app, read T&Cs / FAQ\n"
            "    W->>W: EUDI Wallet initial setup\n"
            "    C->>W: Set up user identification/auth toward wallet\n"
            "    Note over W,NAS: User authenticates via national means\n"
            "    W->>NAS: Authenticate via national auth means\n"
            "    NAS-->>W: Identity confirmed (LoA High)\n"
            "\n"
            "    C->>W: Authenticate to proceed with PID init\n"
            "    W->>W: Authenticate the User (LoA High)\n"
            "    W->>PP: Request PID issuance\n"
            "    PP->>PP: Identify and authenticate user\n"
            "    PP->>PP: Verify EUDI Wallet status (WUA/WIA + KA)\n"
            "    PP->>W: Issue PID\n"
            "    W->>W: Store PID\n"
            "    C->>W: View PID (optional)\n"
        ),
    },
    {
        "id": "4.02",
        "title": "Online Identification & Authentication",
        "topic": "1",
        "topics_extra": ["6", "44"],
        "pdf_rel": f"{BLUEPRINT_DIR_REL}/annex-4.02-eudi-wallet-online-identification-and-authentication.pdf",
        "summary": "Citizen authenticates to a Relying Party using attestations from their Wallet.",
        "mermaid": (
            "sequenceDiagram\n"
            "    actor C as Citizen\n"
            "    participant RP as Relying Party\n"
            "    participant W as EUDI Wallet\n"
            "\n"
            "    C->>RP: Launch website / app\n"
            "    C->>RP: Request access to RP service\n"
            "    C->>RP: Select \"Authenticate via EUDI Wallet\"\n"
            "    Note over RP,W: Deep link / QR / DC API engagement\n"
            "    RP->>W: Send presentation request\n"
            "    W->>W: Verify RP authenticity (access cert)<br/>+ request validity\n"
            "    W->>C: Show requested data + requestor identity\n"
            "    C->>W: Confirm disclosure (PIN / biometrics)\n"
            "    W->>W: Authenticate the User (LoA High)\n"
            "    W->>RP: Encrypted presentation response\n"
            "    RP->>RP: Identify the citizen\n"
            "    RP->>RP: Authenticate the presentation\n"
            "    RP-->>C: Granted access (or denied)\n"
        ),
    },
    {
        "id": "4.03",
        "title": "Issuing mDL",
        "topic": "4",
        "topics_extra": ["10"],
        "pdf_rel": f"{BLUEPRINT_DIR_REL}/annex-4.03-eudi-wallet-issuing-mdl.pdf",
        "summary": "Two entry paths (wallet-initiated or provider-initiated QR) into the mDL issuance flow.",
        "mermaid": (
            "sequenceDiagram\n"
            "    actor C as Citizen\n"
            "    participant W as EUDI Wallet\n"
            "    participant M as mDL Provider Service\n"
            "\n"
            "    alt Wallet-initiated\n"
            "        C->>W: Open wallet, authenticate (PIN / biometrics)\n"
            "        C->>W: Select \"Add mDL\"\n"
            "        W->>M: Initiate issuance\n"
            "    else Provider-initiated\n"
            "        C->>M: Visit mDL provider service\n"
            "        M-->>C: Display QR (credential offer)\n"
            "        C->>W: Open wallet, authenticate\n"
            "        C->>W: Scan QR code (credential offer)\n"
            "    end\n"
            "\n"
            "    W->>W: Authenticate the User (LoA High)\n"
            "    W->>M: Request mDL (OpenID4VCI per HAIP)\n"
            "    M->>M: Authenticate the citizen\n"
            "    M->>W: Issue mDL (mdoc per ISO/IEC 18013-5)\n"
            "    W->>W: Store mDL\n"
            "    C->>W: Preview and confirm storing (optional)\n"
            "    C->>W: View mDL (optional)\n"
        ),
    },
    {
        "id": "4.06",
        "title": "Remote QES — Wallet for Authentication/Authorisation",
        "topic": "16",
        "topics_extra": [],
        "pdf_rel": f"{BLUEPRINT_DIR_REL}/annex-4.06-Remote-qes-creating-a-signature-eudi-wallet-used-for-authentication-authorisation.pdf",
        "summary": "Signature created by a remote QSCD operated by a QTSP. Wallet's only role is auth + authorisation; document never leaves RP/QTSP control.",
        "mermaid": (
            "sequenceDiagram\n"
            "    actor U as User<br/>(Wallet Holder)\n"
            "    participant W as EUDI Wallet\n"
            "    participant RP as Relying Party\n"
            "    participant Q as QTSP\n"
            "    participant QSCD as Remote QSCD<br/>(operated by QTSP)\n"
            "\n"
            "    Note over RP: Document remains under RP control\n"
            "    RP->>RP: Create document / data to sign\n"
            "    opt Optional pre-auth\n"
            "        RP->>W: Request user authentication\n"
            "        U->>W: Open wallet, authenticate\n"
            "    end\n"
            "    RP->>U: Present document for review\n"
            "    RP->>Q: Communicate document to signing service\n"
            "\n"
            "    Q->>U: Request user authentication<br/>(deep-link / QR)\n"
            "    U->>W: Identify to EUDI Wallet (Topic 4.02 flow)\n"
            "    Q->>U: Request authorisation for signature creation\n"
            "    W->>W: Authenticate user (LoA High)\n"
            "    U->>W: \"Sign with EUDI Wallet\" (per-signature consent, QES_14)\n"
            "    Q->>Q: Verify authorisation (SCAL 2)\n"
            "    Q->>Q: Access certificate info\n"
            "    Q->>Q: Compute hash digest of document\n"
            "    Q->>QSCD: Pass hash digest\n"
            "    QSCD->>QSCD: Create eSignature value\n"
            "    QSCD-->>Q: Deliver eSignature value\n"
            "    Q->>Q: Build AdES (PAdES baseline) + finalise\n"
            "    Q-->>RP: Forward signed document\n"
            "    RP->>RP: Store signed document\n"
            "    RP-->>U: View signature confirmation\n"
        ),
    },
]

# Fallback metadata for the other 8 blueprints (no Mermaid)
SERVICE_BLUEPRINT_FALLBACKS = [
    ("4.04", "mDL Proximity (supervised)", "4", "Police-officer reader scenario; ISO/IEC 18013-5 device retrieval; over NFC/BLE/QR."),
    ("4.05", "mDL Proximity (unsupervised)", "4", "Self-service reader scenario (e.g., kiosk); same protocol, different UX."),
    ("4.07", "Remote QES — Enrolment (with QTSP)", "16", "User obtains a signing certificate from a QTSP; one-time onboarding before signature flows."),
    ("4.08", "Remote QES — Channelled by Wallet", "16", "Wallet-driven model: SCA hosted in/by the Wallet, calls out to QTSP via CSC API v2."),
    ("4.09", "Remote QES — Channelled by Relying Party", "16", "RP-driven model: RP triggers the signing UX, Wallet provides authn only."),
    ("4.10", "QES — View History of Signatures", "16", "Dashboard view of historical QES creations, tying QES_13 → DASH_04."),
    ("4.11", "Local QES — Enrolment", "16", "User enrols a local QSCD (smart card / on-device key); used before local signing."),
    ("4.12", "Local QES — Creating a Signature", "16", "Signature creation on-device with local QSCD; SCA can be embedded in Wallet."),
]


# ============================================================
# Discussion-topic letter → ARF Topic number(s) mapping
# Manually curated from each paper's title + body. A letter
# may map to 0+ ARF Topic numbers (a discussion paper can
# cross-cut, or be exploratory with no single ARF home).
# ============================================================
DISC_TO_TOPIC = {
    "a":   ["53"],         # Privacy risks → ZKP-adjacent
    "aa":  ["20"],         # Payments SCA → SUA
    "b":   ["10"],         # Re-issuance / batch → Issuing
    "c":   ["9"],          # WUA → Wallet Unit Attestation
    "d":   ["43"],         # Embedded disclosure → EDP
    "e":   ["11"],         # Pseudonyms
    "f":   ["1"],          # Digital Credential API → Online services
    "g":   ["53"],         # ZKP
    "h":   ["19"],         # Transaction logs → Dashboard
    "i":   [],             # Natural-person representation — cross-cuts
    "j":   ["30"],         # W2W
    "k":   ["1", "18"],    # Combined presentation
    "l+m": ["48", "50"],   # Data deletion + DPA reporting
    "n":   ["34"],         # Export / portability → Migration
    "o":   ["12", "25"],   # Catalogues
    "p":   ["56"],         # WI/WSCA secure interface → WPSM
    "q":   ["40"],         # User/Wallet interface → WIAM
    "r":   ["40"],         # User-to-device auth → WIAM
    "s":   ["55"],         # Certificate transparency → CT
    "t":   ["56"],         # Support & maintenance → WPSM
    "u":   [],             # Trust mark — TS1, no Topic number yet
    "v":   ["3"],          # PID rulebook
    "w":   ["20"],         # Transactional data → SUA
    "x":   ["27", "44"],   # RP registration → Registration & RPRC
    "z":   ["9"],          # Device-bound attestations → WUA
}

# Pretty letter→Title mapping (so we can label nodes nicely)
DISC_TITLES = {
    "a":   "Privacy Risks and Mitigations",
    "aa":  "Support of Electronic Payments SCA",
    "b":   "Re-issuance and Batch Issuance",
    "c":   "Wallet Unit Attestations (WUA)",
    "d":   "Embedded Disclosure Policies",
    "e":   "Pseudonyms & User Authentication",
    "f":   "Digital Credentials API",
    "g":   "Zero-Knowledge Proofs",
    "h":   "Transaction Logs by the Wallet",
    "i":   "Natural Person Representing Another",
    "j":   "Wallet-to-Wallet Interactions",
    "k":   "Combined Presentation of Attestations",
    "l+m": "Data Deletion & DPA Reporting",
    "n":   "Export & Data Portability",
    "o":   "Catalogues for Attestations",
    "p":   "Secure Interface (WI ↔ WSCA)",
    "q":   "User-Wallet Interface",
    "r":   "User-to-Device Authentication",
    "s":   "Certificate Transparency",
    "t":   "Support & Maintenance by Wallet Provider",
    "u":   "EUDI Wallet Trust Mark",
    "v":   "PID Rulebook",
    "w":   "Transactional Data for Payments",
    "x":   "Relying Party Registration",
    "z":   "Device-Bound Attestations",
}


# ============================================================
# Curated refinement deltas — hand-written by reading both
# papers in each rr pair. Each delta lives on the rr node's
# JSON entry and powers the "what's changing in 2026" panel.
# ============================================================
CURATED_DELTAS = {
    # Topic C: Wallet Unit Attestations refinement (March 2026)
    # Sourced from c-rr §2.1–2.6 and §3.1–3.6 directly.
    "c": {
        "summary": "Most concrete refinement of the four — terminology and revocation semantics are stabilizing for ARF v2.9.0.",
        "additions": [
            "WIA (Wallet Instance Attestation) and KA (Key Attestation) introduced as two distinct credential types — short-lived WIA attests integrity of the Wallet Instance; KA attests WSCA/WSCD or keystore properties.",
            "Wallet Solution information (identity, version, certification) required in WIA — lets PID/Attestation Providers identify which Wallet Solution issued the attestation (Proposal 3, WUA_27).",
            "Revocation Maintenance Period — a new, separate window for which the Wallet Provider commits to maintaining revocation status, independent of the WIA/KA's short technical validity (Proposal 4).",
            "WIA technical validity capped at <24h (mandated by TS3 v1.5) to ensure freshness of the integrity check.",
            "PID expiration must not exceed the revocation maintenance period of the WIA/KA presented at issuance (WUA_30, ISSU_12c rewritten).",
            "Type-shared vs per-KA index revocation modes — Wallet Provider chooses; per-KA enables individual smart-card revocation, type-shared covers vulnerability response (WUA_28).",
            "9 new HLRs (WUA_26 through WUA_34) covering revocation chaining and explicit PID Provider obligation to verify WSCD-backed key storage.",
            "VCR_07a: per-KA revocation on user request (e.g., lost external smart card).",
        ],
        "changes": [
            "WUA becomes umbrella term covering WIA + KA — was a single concept previously.",
            "Revocation now distinguishes between the Wallet Instance and the WSCD/keystore — previously both were collapsed into a single WUA revocation.",
            "Many WUA_X requirements rewritten to use WIA/KA terminology and reference the underlying object (Wallet Instance / WSCD) rather than the token.",
            "WURevocation_07/09a/b/c/10/11: revocation actions reference the Wallet Instance directly rather than 'revoking WUAs'.",
            "WIAM_10 (activation): requires explicit WIA + KA + measure to verify Wallet Instance integrity before WIA issuance.",
            "ISSU_19/21/28/30: PID/Attestation Providers verify WIA + KA separately, no longer assume Wallet Provider identifier in token.",
        ],
        "removals": [
            "WUA_16 (key exportability attribute) deleted — trust model relies on Wallet Provider certification, no per-key independent judgement.",
            "WUA_23 merged into WUA_04 (cryptographic algorithms now under umbrella WUA term).",
        ],
    },

    # Topic E: Pseudonyms refinement (April 2026) — exploratory, mostly questions
    # Sourced from e-rr §3 (state of discussion) and §4 (open questions).
    "e": {
        "summary": "Exploratory — this round asks questions rather than proposing fixed HLRs. Output to be defined after Member-State discussion.",
        "additions": [
            "Open Question 1: should cryptographic binding of pseudonyms and (presented) attributes be required? Currently FIDO2/WebAuthn has no such binding mechanism.",
            "Open Question 2: should scope rate-limited pseudonyms (Use Case C) be supported? WebAuthn/FIDO2 isn't designed for this.",
            "Open Question 3: should linkable pseudonymous authentication (Use Case D) be supported? Workaround today is a shared FIDO server.",
            "Open Question 4: which of the five WebAuthn attestation options (Basic, Attestation CA, Anonymisation CA, Self, None) should be allowed?",
            "Open Question 5/6/7: which pseudonym implementations to mandate? Three candidates being weighed: WebAuthn/FIDO2 (current), Attested Pseudonym (EAA-based), ZKP-based (future).",
        ],
        "changes": [
            "LoA applicability for pseudonym authentication is being clarified — current ARF leaves this open.",
            "Pseudonym attestation format being weighed for standardization to avoid linkability across RPs.",
            "Use Case B' explicitly distinguished from Use Case B: 'Pseudonymous Authentication with Presentation of Attributes' (combined event) vs the prior 'Presentation, then subsequent pseudonymous auth' (sequential).",
        ],
        "removals": [
            "(No concrete removals yet — this round is gathering input, not proposing changes to ARF v2.8.0 HLRs PA_01–PA_31.)",
        ],
    },

    # Topic J: W2W refinement (April 2026)
    # Sourced from j-rr §3.2 (proposed HLRs) and §4 (technical approaches).
    "j": {
        "summary": "Single focused question: does the Verifier Wallet Unit need cryptographic device authentication within the same protocol session as the presentation request?",
        "additions": [
            "W2W_23 (proposed): Verifier Wallet Unit SHALL include a cryptographic proof of authenticity in its presentation request, bound to the protocol session.",
            "W2W_24 (proposed): Holder Wallet Unit SHALL cryptographically verify the Verifier is a genuine, non-revoked EUDI Wallet Unit before presenting the request to the Holder.",
            "W2W_25 (proposed): On verification failure or impossibility, Wallet SHALL notify the User and either block the disclosure or offer a choice. Wallet Provider chooses which behaviour.",
            "Four technical approaches enumerated (none selected): A — Wallet Unit Authentication Certificate (WUAC, X.509 + CRL); B — Verifier presents own PID in same flow (requires ISO 18013-5 extension); C — Session-bound reversed prior flow (smaller extension); D — WIA as reader-auth material (additive; reuses WIA infra).",
        ],
        "changes": [
            "STS9_30 in TS9 (currently prohibits ReaderAuth in W2W) likely to be relaxed under approach A or D once selected.",
            "HLRs phrased as SHALL initially; may weaken to SHOULD once technical approach is chosen and can mandate specifics.",
        ],
        "removals": [
            "(No removals proposed; the round is additive only.)",
        ],
    },

    # Topic X: RP Registration refinement (April 2026)
    # Sourced from x-rr §3.1 and §4 (modified/new HLRs).
    "x": {
        "summary": "Introduces 'Relying Party Service' as a first-class entity, separate from RP and from Relying Party Instance — addresses big-org over-asking risk.",
        "additions": [
            "Relying Party Service identifier: a new dimension between RP and RPI. A large RP can register multiple Services (e.g., Helsenorge / HelseCERT / HelseID under one org) each with its own intended uses.",
            "Reg_10b (new): registering entity gets ≥1 access cert per registered service.",
            "Reg_10c (new): registering entity gets ≥1 registration cert per service when issued.",
            "Reg_10d (new): RP must register which intended uses apply to which service.",
            "Reg_10e (new): PID/Attestation Providers register which attestation type each service issues.",
            "Reg_32a (new): trade name + identifier consistent across all of an entity's certificates.",
            "Reg_33/34/35 (new): access certificate carries the RP Service identifier + service trade name + format-level guidance.",
            "Compromised-RPI threat scenario formalized: without service identifiers, a hijacked RPI can over-ask attributes registered for OTHER services of the same RP.",
        ],
        "changes": [
            "RPA_06: Wallet Unit shows trade name of the RP **Service** (not just the RP) in the user-approval UI.",
            "Reg_10: PID/Attestation Providers also receive ≥1 access cert per Relying Party Instance (was implicit).",
            "Reg_31: access cert carries 'trade' name (not legal name).",
            "Many RPRC, RPI, RPACANot HLRs updated to thread through the Service identifier.",
            "TS5 Registry API: condensed WRP object replaced with Service-keyed objects; condensed response was unworkable for large orgs with multiple TradeNames.",
        ],
        "removals": [
            "Reg_10a deleted — merged into Reg_10 (PID/AP and RPs treated symmetrically).",
        ],
    },
}


# ============================================================
# Tension detection — heuristic
# Looks for relaxation/exception language NEAR an HLR-ID reference.
# ============================================================
TENSION_PATTERNS = [
    (r"\bunless\b",                           "exception"),
    (r"\bhowever\b",                          "qualification"),
    (r"\bexcept\b",                           "exception"),
    (r"\balternatively\b",                    "alternative"),
    (r"\bmay instead\b",                      "alternative"),
    (r"\bdoes not apply\b",                   "exemption"),
    (r"\bdoes NOT apply\b",                   "exemption"),
    (r"\boverrides?\b",                       "override"),
    (r"\bsupersedes?\b",                      "override"),
    (r"\btake[s]? precedence\b",              "precedence"),
    (r"\bin contrast\b",                      "contrast"),
    (r"\binstead of\b",                       "alternative"),
    (r"\bnot mandatory\b.*\bsee\b",           "softening"),
    (r"\bnotwithstanding\b",                  "override"),
    (r"\bdiffer(ent|s)\b",                    "divergence"),
]


def detect_tensions(hlrs):
    """Return list of (a_id, b_id, reason) tensions detected via heuristic."""
    tensions = []
    seen = set()
    for hid, h in hlrs.items():
        full = h["text"] + " " + h["notes"]
        # Find all HLR refs with their position
        ref_positions = [(m.start(), m.end(), f"{m.group(1)}_{m.group(2)}{m.group(3)}") for m in HLR_REGEX.finditer(full)]
        for tp_re, tp_kind in TENSION_PATTERNS:
            for tp_m in re.finditer(tp_re, full, re.IGNORECASE):
                # Find HLR refs within ±120 chars of the tension keyword
                start, end = tp_m.start(), tp_m.end()
                for rs, re_, rid in ref_positions:
                    if rid == hid: continue
                    if rid not in hlrs: continue
                    # Skip parent-child relations (those are extensions, not tensions)
                    if rid.startswith(hid) or hid.startswith(rid): continue
                    distance = min(abs(rs - end), abs(re_ - start))
                    if distance <= 120:
                        key = tuple(sorted([hid, rid])) + (tp_kind,)
                        if key in seen: continue
                        seen.add(key)
                        # Capture the surrounding context
                        ctx_start = max(0, min(start, rs) - 30)
                        ctx_end = min(len(full), max(end, re_) + 30)
                        ctx = full[ctx_start:ctx_end].replace('\n', ' ').strip()
                        tensions.append({"a": hid, "b": rid, "kind": tp_kind, "context": ctx})
    return tensions


# ============================================================
# Helpers
# ============================================================
def find_parent_id(hlr_id):
    m = re.match(r"^(.+?_\d+)([a-z]+)$", hlr_id)
    return m.group(1) if m else None


def find_referenced_hlrs(text, exclude_self):
    refs = set()
    for m in HLR_REGEX.finditer(text):
        ref_id = f"{m.group(1)}_{m.group(2)}{m.group(3)}"
        if ref_id != exclude_self:
            refs.add(ref_id)
    return sorted(refs)


# ============================================================
# Annex 1 → glossary (definitions)
# ============================================================
# Match a markdown table row of the form:
#   | **Term** | Definition body. |
# OR (rare):
#   | Term | Definition body. |
# Reject the heading row "| **Term** | **Definition** |" by checking that
# the body itself isn't just "**Definition...**".
DEF_ROW_RE = re.compile(r"^\|\s*(\*\*)?(?P<term>[^|*][^|]*?)(\*\*)?\s*\|\s*(?P<body>.+?)\s*\|\s*$")
NOTE_TOPIC_RE = re.compile(r"\[Topic\s+(\d+)\]")

# Generic English words that show up in Annex 1 but are far too common to
# match safely in HLR free text. Kept as definitions but excluded from the
# tooltip term list to avoid false-positive popovers everywhere.
GENERIC_TERMS = {
    "User", "Authentication", "(Electronic) signature", "(Electronic) seal",
    "Public Sector Body", "Attribute", "Authentic Source", "Notification",
    "Namespace", "Selective Disclosure", "Trust Anchor", "Trusted List",
    "Public Key Infrastructure (PKI)", "Certificate Authority (CA)",
    "Certificate Policy (CP)", "Pseudonym",  # 'Pseudonym' is a topic node already
}

# Supplemental definitions for terms used pervasively in HLR text but not
# defined in Annex 1 (or that have evolved post-Annex 1 — e.g. WIA/KA from the
# Topic C refinement). Hand-curated, factual, kept short.
SUPPLEMENTAL_DEFS = {
    "WIA": {
        "term": "Wallet Instance Attestation (WIA)",
        "body": "An attestation, signed by the Wallet Provider, that asserts the integrity and authenticity of a Wallet Instance. Used by PID/Attestation Providers during issuance. Short-lived (≤24h per TS3 v1.5). Introduced as part of the Topic C refinement, splitting the previous WUA into WIA + KA.",
        "source": "ARF",
        "topic_ref": "9",
    },
    "KA": {
        "term": "Key Attestation (KA)",
        "body": "An attestation, signed by the Wallet Provider, attesting the security properties of a WSCA/WSCD or keystore that holds private keys. Used during PID and device-bound attestation issuance. Carries a revocation reference for the underlying WSCD/keystore. Introduced in the Topic C refinement (was part of WUA).",
        "source": "ARF",
        "topic_ref": "9",
    },
    "Wallet Unit Attestation (WUA)": {
        "term": "Wallet Unit Attestation (WUA)",
        "body": "Umbrella term covering both Wallet Instance Attestation (WIA) and Key Attestation (KA), as proposed in the Topic C 2026 refinement round. The current Annex 1 definition refers to the pre-refinement single-WUA concept.",
        "source": "ARF",
        "topic_ref": "9",
        "aliases": ["WUA"],
    },
    "mdoc": {
        "term": "mdoc",
        "body": "An attestation in CBOR format defined by ISO/IEC 18013-5 (originally the mDL standard). The proximity-presentation envelope used by EUDI Wallets. Encodes attributes in tagged CBOR + COSE.",
        "source": "ARF",
        "topic_ref": "4",
    },
    "mDL": {
        "term": "mDL (mobile Driving Licence)",
        "body": "ISO/IEC 18013-5 mobile Driving Licence. In the EUDI ecosystem, mDLs MUST use the mdoc format (not SD-JWT VC).",
        "source": "ARF",
        "topic_ref": "4",
    },
    "SD-JWT VC": {
        "term": "SD-JWT VC",
        "body": "Selective-Disclosure JWT Verifiable Credentials (IETF draft). One of two mandatory formats for EUDI attestations alongside mdoc. Allows selective disclosure of individual claims via salted-hash mechanism.",
        "source": "ARF",
        "topic_ref": "1",
    },
    "OpenID4VP": {
        "term": "OpenID4VP",
        "body": "OpenID for Verifiable Presentations. The remote-presentation protocol used by EUDI, profiled per HAIP. Carries presentation requests + responses between Relying Parties and Wallet Units.",
        "source": "ARF",
        "topic_ref": "1",
    },
    "OpenID4VCI": {
        "term": "OpenID4VCI",
        "body": "OpenID for Verifiable Credential Issuance. The issuance protocol used by EUDI, profiled per HAIP. Used by PID Providers and Attestation Providers to issue PIDs/attestations to Wallet Units.",
        "source": "ARF",
        "topic_ref": "10",
    },
    "HAIP": {
        "term": "HAIP (High Assurance Interoperability Profile)",
        "body": "OpenID Foundation profile of OpenID4VP and OpenID4VCI specifying the strict subset that EUDI Wallets and Relying Parties MUST implement. Mandates SD-JWT VC + mdoc, encrypted responses, x509-based RP authentication.",
        "source": "ARF",
        "topic_ref": "1",
    },
    "PAdES": {
        "term": "PAdES",
        "body": "PDF Advanced Electronic Signatures (ETSI EN 319 142-1). The mandatory output format for QES via the Wallet (QES_08). Other formats (XAdES, JAdES, CAdES, ASiC) are SHOULD.",
        "source": "ARF",
        "topic_ref": "16",
    },
    "QES": {
        "term": "Qualified Electronic Signature (QES)",
        "body": "An advanced electronic signature created by a qualified electronic signature creation device (QSCD) and based on a qualified certificate, defined in the eIDAS Regulation. EUDI Wallets must offer QES free of charge for non-professional users.",
        "source": "Reg",
        "topic_ref": "16",
    },
    "QSCD": {
        "term": "Qualified Electronic Signature Creation Device (QSCD)",
        "body": "Configured software or hardware used to create an electronic signature meeting the requirements of Annex II of the eIDAS Regulation. Modes: local (on-device), external (USB/NFC), remote (managed by QTSP).",
        "source": "Reg",
        "topic_ref": "16",
    },
    "QTSP": {
        "term": "Qualified Trust Service Provider (QTSP)",
        "body": "A trust service provider granted qualified status by the supervisory body, providing one or more qualified trust services. PID Providers and QEAA Providers are typically QTSPs (or PuB-EAA Providers in the public-sector case).",
        "source": "Reg",
    },
    "QEAA": {
        "term": "Qualified Electronic Attestation of Attributes (QEAA)",
        "body": "An electronic attestation of attributes issued by a qualified trust service provider, meeting the requirements of Annex V of the eIDAS Regulation.",
        "source": "Reg",
    },
    "PuB-EAA": {
        "term": "Public-sector Electronic Attestation of Attributes (PuB-EAA)",
        "body": "An electronic attestation of attributes issued by or on behalf of a public sector body responsible for an authentic source.",
        "source": "Reg",
    },
    "EAA": {
        "term": "Electronic Attestation of Attributes (EAA)",
        "body": "An attestation in electronic form that allows attributes to be authenticated. Three categories in EUDI: QEAA (qualified), PuB-EAA (public-sector), and (non-qualified) EAA.",
        "source": "Reg",
    },
    "PID": {
        "term": "Person Identification Data (PID)",
        "body": "A set of data, issued in accordance with Union or national law, that establishes the identity of a natural or legal person. The foundational EUDI attestation. Issued by Member State PID Providers in two formats: mdoc (eu.europa.ec.eudi.pid.1) and SD-JWT VC (urn:eudi:pid:1).",
        "source": "Reg",
        "topic_ref": "3",
    },
    "WSCA": {
        "term": "Wallet Secure Cryptographic Application (WSCA)",
        "body": "An application that manages critical assets by being linked to and using the cryptographic and non-cryptographic functions provided by the Wallet Secure Cryptographic Device (WSCD).",
        "source": "CIR",
    },
    "WSCD": {
        "term": "Wallet Secure Cryptographic Device (WSCD)",
        "body": "A tamper-resistant device providing an environment linked to and used by the WSCA to protect critical assets and provide cryptographic functions for secure execution. Five architecture types: Remote, Local External, Local Internal, Local Native, Hybrid.",
        "source": "CIR",
    },
    "LoTE": {
        "term": "List of Trusted Entities (LoTE)",
        "body": "A signed list published by a Member State containing trust anchors for non-QTSP roles in the EUDI ecosystem (Wallet Providers, PID Providers, Access CAs, Providers of Registration Certificates). Distinct from a Trusted List, which is for QTSPs only.",
        "source": "ARF",
    },
    "LoA": {
        "term": "Level of Assurance (LoA)",
        "body": "An eIDAS authentication assurance level — Low, Substantial, or High. PID Providers operate at LoA High (defined in CIR 2015/1502 §2.2.1). User authentication on PID assets must also be LoA High.",
        "source": "Reg",
    },
    "RP": {
        "term": "Relying Party (RP)",
        "body": "A natural or legal person that relies upon electronic identification, EUDI Wallets, or other electronic identification means. RPs request PIDs or attestations from Wallet Units.",
        "source": "Reg",
    },
    "RPI": {
        "term": "Relying Party Instance (RPI)",
        "body": "A software/hardware module that interacts with a Wallet Unit and performs Relying Party authentication, controlled by a Relying Party. A single RP can operate multiple RPIs (e.g., per service, per branch).",
        "source": "ARF",
        "topic_ref": "52",
    },
    "ASPSP": {
        "term": "ASPSP (Account Servicing Payment Service Provider)",
        "body": "Per PSD2 Directive 2015/2366. The payment account holder (typically a bank). In SUA flows, the ASPSP can be both the issuer and the consumer of the SUA attestation (2-party flow).",
        "source": "Reg",
        "topic_ref": "20",
    },
    "SCA": {
        "term": "Strong Customer Authentication (SCA)",
        "body": "Per PSD2 Directive 2015/2366 + RTS CDR 2018/389. Authentication based on at least two factors from different categories (knowledge, possession, inherence). EUDI Wallet acts as PSD2-compliant SCA authenticator via the SUA attestation.",
        "source": "Reg",
        "topic_ref": "20",
    },
}


def parse_definitions():
    """Parse Annex 1 → returns (defs_dict, term_list_for_regex).

    defs_dict is alias-keyed (lowercased) so the JS regex match can resolve a
    matched span directly to its definition. Each entry includes a `display`
    field (the canonical/longer form to render in the popover) and `aliases`.

    term_list_for_regex is sorted longest-first for safe regex alternation.
    """
    if not ANNEX1_PATH.exists():
        return {}, []
    text = ANNEX1_PATH.read_text(encoding="utf-8")
    section = None  # "Reg" | "CIR" | "ARF"
    defs = {}
    for line in text.splitlines():
        line_strip = line.strip()
        if line_strip.startswith("## A.2"): section = "Reg"; continue
        if line_strip.startswith("## A.3"): section = "CIR"; continue
        if line_strip.startswith("## A.4"): section = "ARF"; continue
        if line_strip.startswith("## "): section = None; continue
        if not section: continue
        if not line_strip.startswith("|"): continue
        # Skip table separator rows like "|----|----|"
        if re.match(r"^\|[\s\-:|]+\|$", line_strip): continue
        m = DEF_ROW_RE.match(line_strip)
        if not m: continue
        raw_term = m.group("term").strip().rstrip("*").strip()
        body = m.group("body").strip()
        # Skip the table header row (term column label is literally "Term")
        if raw_term.lower() == "term": continue
        # Skip rows where body is just bold — header pattern
        if re.match(r"^\*\*Definition[^*]*\*\*$", body): continue
        # Strip surrounding ** if any leaked
        body = re.sub(r"^\*\*(.+?)\*\*$", r"\1", body)
        # Capture topic ref from "*Note: See [Topic N]...*"
        topic_ref = None
        tm = NOTE_TOPIC_RE.search(body)
        if tm: topic_ref = tm.group(1)

        # Build term + alias variants. Patterns we handle:
        #   "WSCA" → ["WSCA"]
        #   "Wallet Secure Cryptographic Application (WSCA)" → ["Wallet Secure Cryptographic Application", "WSCA"]
        #   "Holder (when used in the context of Wallet-to-Wallet interactions)" → ["Holder"]
        #   "Holder Wallet Unit" → ["Holder Wallet Unit"]
        aliases = set()
        primary = raw_term
        # Strip parenthesised qualifier
        paren_match = re.search(r"\(([^)]+)\)", raw_term)
        if paren_match:
            inner = paren_match.group(1).strip()
            outer = re.sub(r"\s*\([^)]+\)\s*", " ", raw_term).strip()
            # If inner is short uppercase (acronym), keep both. Else discard the qualifier.
            if re.fullmatch(r"[A-Z][A-Z0-9/]*[A-Z0-9]?", inner):
                aliases.add(outer)
                aliases.add(inner)
                primary = outer
            else:
                primary = outer
                aliases.add(outer)
        else:
            aliases.add(primary)
        # Split slash forms (WSCA/WSCD)
        for a in list(aliases):
            if "/" in a and re.fullmatch(r"[A-Z0-9/]+", a):
                for piece in a.split("/"):
                    aliases.add(piece.strip())
        # Drop noisy aliases (1- or 2-char tokens)
        aliases = {a for a in aliases if len(a) >= 3}
        if not aliases: continue

        # Store one entry per alias, keyed by lowercase alias.
        for a in aliases:
            key = a.lower()
            entry = {
                "term": a,
                "display": primary,
                "body": body,
                "source": section,
                "topic_ref": topic_ref,
                "aliases": sorted(aliases),
            }
            existing = defs.get(key)
            if existing:
                # Prefer ARF section over CIR over Reg (more specific) — but only
                # keep the longer body if both come from same priority.
                order = {"Reg": 0, "CIR": 1, "ARF": 2}
                if order.get(section, 0) < order.get(existing["source"], 0):
                    continue
            defs[key] = entry

    # Merge in supplemental hand-curated definitions.
    for primary_key, sup in SUPPLEMENTAL_DEFS.items():
        # primary_key may be acronym ("WIA") or longer phrase
        all_aliases = set(sup.get("aliases", []))
        all_aliases.add(primary_key)
        # If there's a parens acronym in the term, also alias it
        am = re.search(r"\(([A-Z][A-Z0-9/]*)\)", sup["term"])
        if am: all_aliases.add(am.group(1))
        all_aliases = sorted({a for a in all_aliases if len(a) >= 2})
        for a in all_aliases:
            key = a.lower()
            # Don't overwrite an existing Annex-1 entry unless we're explicitly
            # supplying an updated version (e.g. WUA umbrella).
            if key in defs and not sup.get("override"): continue
            defs[key] = {
                "term": a,
                "display": sup["term"],
                "body": sup["body"],
                "source": sup["source"],
                "topic_ref": sup.get("topic_ref"),
                "aliases": all_aliases,
            }

    # Build the regex term list (skipping generic English words).
    safe_terms = set()
    for entry in defs.values():
        for a in entry["aliases"]:
            if a in GENERIC_TERMS: continue
            if len(a) < 2: continue
            if a.lower() in {"user", "attribute", "notification", "pseudonym", "key"}: continue
            safe_terms.add(a)
    safe_terms = sorted(safe_terms, key=lambda s: (-len(s), s))
    return defs, safe_terms


# ============================================================
# Flashcards parser → quiz cards
# ============================================================
PREFIX_TO_TOPIC = {  # mirror flashcards.md Deck 6
    "OIA": "1", "PID": "3", "mDL": "4", "RPA": "6", "VCR": "7", "WUA": "9",
    "ISSU": "10", "PA": "11", "ARB": "12", "QES": "16", "ACP": "18",
    "DASH": "19", "SUA": "20", "Reg": "27", "RP": "29", "W2W": "30",
    "Mig": "34", "WURevocation": "38", "WIAM": "40", "EDP": "43",
    "RPRC": "44", "RPI": "52", "ZKP": "53", "WPSM": "56",
    "ProxId": "24", "QTSPAS": "42", "ACC": "54", "CT": "55",
    "DATA_DLT": "48", "RPT_DPA": "50", "PAD": "51",
}

def parse_flashcards():
    """Parse flashcards.tsv + .md → quiz card list."""
    if not FLASH_TSV_PATH.exists():
        return []
    cards = []
    # Build deck assignment map by reading .md (cards in order)
    deck_for_index = {}
    if FLASH_MD_PATH.exists():
        md = FLASH_MD_PATH.read_text(encoding="utf-8")
        current_deck = None
        idx = 0  # index into the TSV-equivalent flat list
        for line in md.splitlines():
            ds = re.match(r"^##\s+Deck\s+\d+\s*[—-]\s*(.+?)\s*$", line)
            if ds:
                current_deck = ds.group(1).strip()
                continue
            # Match content rows in the .md tables: starts with '| ', not header, not separator
            if line.startswith("| ") and not line.startswith("| Q ") and not re.match(r"^\|\s*-+\s*\|", line) and " | " in line[2:]:
                # Skip the inline header repeated in each deck
                if "Q | A" in line: continue
                if current_deck:
                    deck_for_index[idx] = current_deck
                idx += 1

    # Now read the TSV (one card per line)
    with open(FLASH_TSV_PATH, encoding="utf-8") as f:
        for i, line in enumerate(f):
            line = line.rstrip("\n")
            if not line.strip(): continue
            if "\t" not in line: continue
            q, a = line.split("\t", 1)
            q, a = q.strip(), a.strip()
            if not q or not a: continue
            tags = {"deck": deck_for_index.get(i)}
            # Detect HLR prefix references in the question
            hlr_refs = []
            for m in HLR_REGEX.finditer(q + " " + a):
                hlr_refs.append(f"{m.group(1)}_{m.group(2)}{m.group(3)}")
            # Detect bare prefix (e.g., "HLR prefix WUA_?")
            prefix_match = re.search(r"\bprefix\s+([A-Za-z_]+)_", q)
            if prefix_match and prefix_match.group(1) in PREFIX_TO_TOPIC:
                tags["topic"] = PREFIX_TO_TOPIC[prefix_match.group(1)]
                tags["prefix"] = prefix_match.group(1)
            elif hlr_refs:
                # Use first HLR ref's prefix for topic
                first = hlr_refs[0]
                pmatch = re.match(r"^([A-Za-z][A-Za-z0-9_]*?)_\d+", first)
                if pmatch and pmatch.group(1) in PREFIX_TO_TOPIC:
                    tags["topic"] = PREFIX_TO_TOPIC[pmatch.group(1)]
                    tags["prefix"] = pmatch.group(1)
            # Detect CIR refs
            cir_match = re.search(r"\b(CIR|Reg|Dir|CDR)\s+\d{4}/\d{1,4}\b", q)
            if cir_match:
                tags["legal"] = cir_match.group(0)
            cards.append({
                "id": f"deck_{i:03d}",
                "q": q, "a": a,
                "source": "deck",
                "hlr_refs": sorted(set(hlr_refs)),
                "tags": {k: v for k, v in tags.items() if v is not None},
            })
    return cards


def build_pitfall_cards(narratives, hlrs_lookup):
    """One card per pitfall, framed as a recall prompt for the topic.
    Q: 'Topic N (Title) — common implementation pitfall to avoid?'
    A: '<pitfall text>'  +  TLDR of the topic for context.
    """
    cards = []
    TOPIC_TITLE_LOOKUP = {tn: n["title"] for tn, n in narratives.items()}
    for tn, n in narratives.items():
        topic_title = TOPIC_TITLE_LOOKUP.get(tn, n.get("title", ""))
        for pi, pitfall in enumerate(n.get("pitfalls", [])):
            cards.append({
                "id": f"pit_{tn}_{pi:02d}",
                "q": f"Topic {tn} · {topic_title} — name a common implementation pitfall.",
                "a": f"**{pitfall}**\n\nWhy: {n['tldr']}",
                "source": "pitfall",
                "hlr_refs": list(n.get("key_hlrs", [])),
                "tags": {"topic": tn, "hardness": "tricky"},
            })
    return cards


def build_tension_cards(tensions, hlrs_lookup):
    """One card per detected tension. Show both HLR texts side by side so the
    user can read the actual conflict instead of an OCR-y context snippet."""
    cards = []
    seen = set()
    KIND_LABEL = {
        "exception":     "exception",
        "qualification": "qualification",
        "alternative":   "alternative",
        "exemption":     "exemption",
        "override":      "override",
        "precedence":    "takes precedence",
        "contrast":      "contrast",
        "softening":     "softening",
        "divergence":    "divergence",
    }
    for t in tensions:
        a, b = t["a"], t["b"]
        key = tuple(sorted([a, b]))
        if key in seen: continue
        seen.add(key)
        ha = hlrs_lookup.get(a, {})
        hb = hlrs_lookup.get(b, {})
        a_topic = ha.get("topic_number")
        b_topic = hb.get("topic_number")
        a_text = (ha.get("text") or "").strip()
        b_text = (hb.get("text") or "").strip()
        # Truncate for card readability
        def _trim(s, n=320):
            return s[:n] + ("…" if len(s) > n else "")
        kind_lbl = KIND_LABEL.get(t["kind"], t["kind"])
        cards.append({
            "id": f"ten_{a}_{b}",
            "q": f"ARF tension: read both **{a}** and **{b}** — what is the relationship between them?",
            "a": (
                f"The ARF text uses **{kind_lbl}** language between these two requirements.\n\n"
                f"**{a}** (Topic {a_topic}): {_trim(a_text)}\n\n"
                f"**{b}** (Topic {b_topic}): {_trim(b_text)}\n\n"
                f"_Read both to decide which applies in your scenario — the workbench's tension panel surfaces these heuristically._"
            ),
            "source": "tension",
            "hlr_refs": [a, b],
            "tags": {
                "topic": a_topic or b_topic,
                "hardness": "exception",
            },
        })
    return cards


# ============================================================
# Discussion topics parser
# ============================================================
DISC_VERSION_RE = re.compile(r"Version\s+([\d.]+)\s*,?\s*updated\s+([0-9A-Za-z\s]+)", re.IGNORECASE)
DISC_GH_RE = re.compile(r"\(\s*(https?://(?:www\.)?github\.com/[^\s)]+/discussions/\d+)\s*\)")
DISC_TITLE_RE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)
DISC_TLDR_RE = re.compile(r"###?\s+1\.1[^\n]*\n+(.+?)(?=\n###?\s|\n##\s|\Z)", re.DOTALL)

def _disc_letter_from_filename(name: str):
    """Extract letter prefix from filename, e.g. 'c-rr-...' → ('c', True), 'g-zero...' → ('g', False)."""
    m = re.match(r"^([a-z]+(?:\+[a-z])?)-(rr-)?", name)
    if not m: return None, False
    return m.group(1), bool(m.group(2))


def parse_discussion_topics():
    """Walk discussion-topics/, return list of disc dicts."""
    if not DISC_DIR.is_dir(): return []
    docs = []
    for path in sorted(DISC_DIR.iterdir()):
        if path.suffix != ".md": continue
        if path.name.lower() == "readme.md": continue
        letter, is_rr = _disc_letter_from_filename(path.name)
        if not letter: continue
        text = path.read_text(encoding="utf-8")
        # Title
        tm = DISC_TITLE_RE.search(text)
        title = tm.group(1).strip() if tm else f"Topic {letter.upper()}"
        # Strip leading "Topic X - " redundancy when it duplicates filename
        title = re.sub(r"^Topic\s+[A-Z]+\s*[-–]\s*", "", title)
        # Version + date
        vm = DISC_VERSION_RE.search(text)
        version = vm.group(1) if vm else None
        date = vm.group(2).strip() if vm else None
        # GitHub discussion URL
        gm = DISC_GH_RE.search(text)
        github = gm.group(1) if gm else None
        # TLDR — take §1.1 paragraph
        tldr = ""
        tlm = DISC_TLDR_RE.search(text)
        if tlm:
            tldr_raw = tlm.group(1).strip()
            # First non-empty paragraph
            for para in re.split(r"\n\n+", tldr_raw):
                cleaned = para.strip()
                if not cleaned: continue
                if cleaned.startswith("###"): continue
                # Strip italic markers/quote markers
                cleaned = re.sub(r"^[\*_]+|[\*_]+$", "", cleaned).strip()
                tldr = cleaned[:600]
                break
        # Body cap — keep full markdown but trimmed for the JSON bundle
        body = text
        # Drop the first ~30 boilerplate lines (Version, GitHub, RFC2119 keywords, structure)
        body_lines = body.splitlines()
        # Find the first "## 2 " heading and start there
        body_start_idx = 0
        for idx, ln in enumerate(body_lines):
            if re.match(r"^##\s+2[\s.]", ln):
                body_start_idx = idx
                break
        body_trimmed = "\n".join(body_lines[body_start_idx:])
        if len(body_trimmed) > 6000:
            body_trimmed = body_trimmed[:6000] + "\n\n…(truncated — view full paper in eudi_knowledge_bundle/discussion-topics/)"
        # HLR refs in the body
        hlr_refs = sorted({f"{m.group(1)}_{m.group(2)}{m.group(3)}" for m in HLR_REGEX.finditer(body_trimmed)})
        # Topic numbers
        topics = DISC_TO_TOPIC.get(letter, [])
        # Title fallback
        clean_title = DISC_TITLES.get(letter, title)
        # ID
        slug = letter
        if is_rr: slug += "_rr"
        # Status / iteration (rough — read disc README mappings)
        if is_rr:
            iteration = {"c": 1, "x": 1, "j": 2, "u": 2, "e": 3, "f": 4, "aa": 4, "g": 6, "l": 5, "m": 5, "i": 5}.get(letter)
            arf_version = "open"
        else:
            iteration = None
            arf_version = "integrated"
        rec = {
            "id": f"disc_{slug}",
            "letter": letter.upper(),
            "is_rr": is_rr,
            "title": clean_title,
            "filename": path.name,
            "version": version,
            "date": date,
            "github": github,
            "tldr": tldr,
            "body": body_trimmed,
            "topics": topics,
            "hlr_refs": hlr_refs,
            "iteration": iteration,
            "arf_version": arf_version,
            "rr_pair": f"disc_{letter}_rr" if not is_rr else f"disc_{letter}",
            "delta": CURATED_DELTAS.get(letter) if is_rr else None,
        }
        docs.append(rec)
    # Now resolve rr_pair: only set if the partner actually exists.
    ids = {d["id"] for d in docs}
    for d in docs:
        if d["rr_pair"] not in ids:
            d["rr_pair"] = None
    return docs


# ============================================================
# Legal text parser
# ============================================================
# CIRs and Regulations follow a recognisable pattern in the OCR-extracted txt:
#   * Recitals appear as "(N)\t...body..." in the preamble
#   * "Article N" headings start a new article
#   * Each article body has paragraphs numbered "(1)", "(2)" with sub-points
#     "(a)", "(b)"
#   * "ANNEX I", "ANNEX II" mark annexes
# We strip page-breaks ("ELI: http..." footers + page numbers) and OCR noise.

_PAGE_FOOTER_RE = re.compile(r"^ELI:\s*https?://\S+\s*\d+/\d+\s*$|^\d+/\d+\s*ELI:\s*https?://\S+\s*$|^OJ\s+L,?\s+[\d./,]+\s+EN\s*$|^EN\s+OJ\s+L,?\s+[\d./,]+\s*$", re.M)
_FOOTNOTE_RE = re.compile(r"^\(\d+\)\s+(?:OJ\s+L|Regulation\s+\(EU\)|Directive|Commission|Decision)[\s\S]+?(?=\n\n|\Z)", re.M)
_PARA_NUM_RE = re.compile(r"\b(\d+)\.\s+(.+)")
_SUBPOINT_RE = re.compile(r"^\s*\(([a-z])\)\s+(.+)")


def _clean_legal_text(text):
    """Strip page footers / page numbers / column noise from OCR text."""
    text = _PAGE_FOOTER_RE.sub("", text)
    # Strip lines that are only digits or only whitespace+digits (page numbers)
    text = re.sub(r"^\s*\d{1,3}\s*$", "", text, flags=re.M)
    # Collapse 3+ blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text


def _slugify_anchor(s):
    """Turn 'Article 5(4)(b)' / '5(4)(b)' / 'Recital 12' into a stable HTML id."""
    s = s.replace("(", "-").replace(")", "").replace(" ", "-").replace(".", "-")
    s = re.sub(r"-+", "-", s).strip("-").lower()
    return s


def parse_legal_text(legal_id):
    """Returns parsed structure for a legal doc, or None if no text file exists."""
    fname = LEGAL_FILE.get(legal_id)
    if not fname: return None
    path = LEGAL_TEXT_DIR / fname
    if not path.exists(): return None
    text = _clean_legal_text(path.read_text(encoding="utf-8", errors="replace"))

    # Locate "ANNEX" sections to separate annex content from articles.
    # The OCR-extracted text has heavy leading whitespace; ANNEX may have a
    # Roman-numeral suffix or stand alone. Match both shapes.
    annex_re = re.compile(r"\n[ \t]+ANNEX(?:\s+([IVX]+))?\s*\n")
    annex_match = annex_re.search(text)
    body_text = text[: annex_match.start()] if annex_match else text
    annex_text = text[annex_match.start():] if annex_match else ""

    # Recitals: numbered as "(N)" indented at start of line, ending at next "(N+1)" or "Article N".
    recitals = []
    rec_re = re.compile(r"^\s{0,12}\((\d{1,3})\)\s+([\s\S]+?)(?=\n\s{0,12}\(\d+\)\s|\nArticle\s+\d|\Z)", re.M)
    pre_text = body_text
    article_split = re.search(r"^\s*Article\s+\d", pre_text, re.M)
    if article_split:
        pre_text = pre_text[: article_split.start()]
    for m in rec_re.finditer(pre_text):
        n = m.group(1)
        body = re.sub(r"\s+", " ", m.group(2)).strip()
        if len(body) < 20: continue  # skip stray (1)/(2) inside articles
        recitals.append({"n": n, "body": body[:2500]})

    # Articles: "Article N" headers split the body. Each article body has a
    # title (first line/paragraph) and numbered paragraphs.
    articles = []
    art_re = re.compile(r"^\s*Article\s+(\d+[a-z]?)\s*$", re.M)
    matches = list(art_re.finditer(body_text))
    for i, m in enumerate(matches):
        n = m.group(1)
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else (annex_match.start() if annex_match else len(text))
        chunk = body_text[start:end].strip()
        # First line is the title; remaining is body
        lines = [ln.strip() for ln in chunk.split("\n") if ln.strip()]
        title = lines[0][:200] if lines else ""
        rest = "\n".join(lines[1:]) if len(lines) > 1 else ""
        # Identify numbered paragraphs (1. ... 2. ... or  1   ...)
        paragraphs = []
        # Split on lines that start with "N." or "N "  where N is 1-2 digits
        para_re = re.compile(r"(?m)^\s*(\d{1,2})\.\s+")
        para_split = para_re.split(rest)
        if len(para_split) > 1:
            # para_split = [pre, n1, body1, n2, body2, ...]
            pre = para_split[0].strip()
            if pre:
                paragraphs.append({"n": n, "body": pre[:1500]})
            for j in range(1, len(para_split), 2):
                pn = para_split[j]
                pb = para_split[j + 1].strip() if j + 1 < len(para_split) else ""
                if not pb: continue
                # Detect (a)/(b)/(c) sub-points
                sub = []
                lines2 = pb.split("\n")
                cur_lines = []
                cur_letter = None
                cur_letter_lines = []
                for ln in lines2:
                    sm = _SUBPOINT_RE.match(ln)
                    if sm:
                        if cur_letter:
                            sub.append({"n": f"{n}({pn})({cur_letter})", "body": " ".join(cur_letter_lines).strip()[:1200]})
                        cur_letter = sm.group(1)
                        cur_letter_lines = [sm.group(2)]
                    elif cur_letter:
                        cur_letter_lines.append(ln.strip())
                    else:
                        cur_lines.append(ln.strip())
                if cur_letter:
                    sub.append({"n": f"{n}({pn})({cur_letter})", "body": " ".join(cur_letter_lines).strip()[:1200]})
                pb_clean = re.sub(r"\s+", " ", " ".join(cur_lines)).strip()
                paragraphs.append({"n": f"{n}({pn})", "body": pb_clean[:1500], "subpoints": sub})
        else:
            # Single-block article (no numbered paragraphs)
            cleaned = re.sub(r"\s+", " ", rest).strip()
            if cleaned:
                paragraphs.append({"n": n, "body": cleaned[:3000]})
        articles.append({"n": n, "title": title, "paragraphs": paragraphs})

    # Annexes: "ANNEX I/II/III" splits (or just "ANNEX" for single-annex docs)
    annexes = []
    if annex_text:
        anx_re = re.compile(r"\n[ \t]+ANNEX(?:\s+([IVX]+))?\s*\n", re.M)
        anx_matches = list(anx_re.finditer(annex_text))
        for i, m in enumerate(anx_matches):
            n = m.group(1) or "I"  # default "I" for single-annex docs
            start = m.end()
            end = anx_matches[i + 1].start() if i + 1 < len(anx_matches) else len(annex_text)
            chunk = annex_text[start:end].strip()
            lines = [ln.strip() for ln in chunk.split("\n") if ln.strip()]
            title = lines[0][:200] if lines else f"Annex {n}"
            rest = "\n".join(lines[1:])[:6000]
            annexes.append({"n": n, "title": title, "body": rest})

    return {
        "recitals": recitals,
        "articles": articles,
        "annexes": annexes,
        "raw_excerpt": text[:1200],  # for diagnostic purposes
    }


# ============================================================
# Reference-implementation feature-map parser
# ============================================================
def parse_feature_map():
    """Parse feature-map.md → {feature_name: {status, roadmap_url}}."""
    if not FEATURE_MAP_PATH.exists(): return {}
    md = FEATURE_MAP_PATH.read_text(encoding="utf-8")
    out = {}
    # Strategy: walk every line that is a markdown table row whose first cell is
    # `[**Name**](anchor)` and whose third cell is one of Completed/In Progress/
    # Planned. This covers both the top-level table and the per-feature subtables.
    row_re = re.compile(
        r"^\s*\|\s*\[\*\*(?P<name>[^*]+)\*\*\]\((?P<anchor>[^)]*)\)\s*\|"
        r"\s*(?P<desc>[^|]+?)\s*\|"
        r"\s*(?P<status>Completed|In\s*Progress|Planned)\s*\|\s*$",
        re.IGNORECASE,
    )
    for line in md.splitlines():
        m = row_re.match(line)
        if not m: continue
        name = m.group("name").strip()
        desc = m.group("desc").strip()
        status = m.group("status").strip().lower()
        st_norm = "completed" if "complet" in status else (
                  "in_progress" if "progress" in status else
                  "planned" if "planned" in status else status)
        anchor = m.group("anchor").strip()
        # Only keep TOP-LEVEL features (anchor starts with '#') — sub-feature
        # rows have full GitHub URLs as anchors. We DO want to use sub-feature
        # roadmap URLs if available, but indexed under the top-level name.
        if anchor.startswith("#"):
            out[name] = {
                "name": name,
                "status": st_norm,
                "description": desc,
                "roadmap_url": "https://github.com/orgs/eu-digital-identity-wallet/projects/24",
                "anchor": anchor,
            }

    # Scan sub-feature tables (inside <details>) for roadmap links
    cur_name = None
    for line in md.splitlines():
        h = re.match(r"^###\s*_(.+?)_\s*$", line)
        if h:
            cur_name = h.group(1).strip()
            continue
        if not cur_name: continue
        # Find the first GH link in the sub-table that points to roadmap issues
        m = re.search(r"\(https://github\.com/eu-digital-identity-wallet/eudi-wallet-reference-implementation-roadmap[^)]+\)", line)
        if m:
            # Match section name to top-level entries
            for k in out:
                if k.lower().split(" ")[0] in cur_name.lower() or cur_name.lower() in k.lower():
                    if "roadmap_specific" not in out[k]:
                        out[k]["roadmap_specific"] = m.group(0).strip("()")
                    break
    return out


# ============================================================
# Main
# ============================================================
def main():
    hlrs = {}
    children_of = defaultdict(set)
    references_from = defaultdict(set)
    referenced_by = defaultdict(set)

    with open(CSV_PATH, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f, delimiter=";"):
            hid = row["Index"].strip()
            if not hid: continue
            text = row["Requirement_specification"].strip()
            notes = row.get("Notes", "").strip()
            hlrs[hid] = {
                "id": hid,
                "harmonized": row["Harmonized_ID"].strip(),
                "part": row["Part"].strip(),
                "category": row["Category"].strip(),
                "topic_number": row["Topic_Number"].strip(),
                "topic_title": row["Topic_Title"].strip(),
                "subsection": row.get("Subsection", "").strip(),
                "text": text, "notes": notes,
                "is_empty": text.lower() in ("empty", "empty.", ""),
            }

    for hid in list(hlrs.keys()):
        parent = find_parent_id(hid)
        if parent and parent in hlrs:
            children_of[parent].add(hid)

    for hid, h in hlrs.items():
        for ref in find_referenced_hlrs(h["text"] + " " + h["notes"], hid):
            if ref in hlrs:
                if ref == find_parent_id(hid) or hid == find_parent_id(ref): continue
                references_from[hid].add(ref)
                referenced_by[ref].add(hid)

    # Detect tensions
    tensions = detect_tensions(hlrs)

    # Index tensions per HLR
    tensions_by_hlr = defaultdict(list)
    for t in tensions:
        tensions_by_hlr[t["a"]].append(t)
        tensions_by_hlr[t["b"]].append({"a": t["b"], "b": t["a"], "kind": t["kind"], "context": t["context"]})

    # ============================================================
    # Build node list
    # ============================================================
    nodes = []
    for hid, h in hlrs.items():
        m = re.match(r"^([A-Za-z][A-Za-z0-9_]*?)_(\d+)([a-z]*)$", hid)
        prefix = m.group(1) if m else hid
        nodes.append({
            "id": hid, "type": "hlr", "label": hid, "prefix": prefix,
            "topic": h["topic_number"], "topic_title": h["topic_title"],
            "category": h["category"], "part": h["part"], "subsection": h["subsection"],
            "harmonized": h["harmonized"], "text": h["text"], "notes": h["notes"],
            "is_empty": h["is_empty"],
            "parent": find_parent_id(hid) if find_parent_id(hid) in hlrs else None,
            "children": sorted(children_of.get(hid, [])),
            "references": sorted(references_from.get(hid, [])),
            "referenced_by": sorted(referenced_by.get(hid, [])),
            "ts": TOPIC_TO_TS.get(h["topic_number"], []),
            "legal": TOPIC_TO_LEGAL.get(h["topic_number"], []),
            "tensions": tensions_by_hlr.get(hid, []),
        })

    # Topic nodes
    topic_meta = {}
    for h in hlrs.values():
        tn = h["topic_number"]
        if tn not in topic_meta:
            topic_meta[tn] = {"number": tn, "title": h["topic_title"], "count": 0}
        topic_meta[tn]["count"] += 1
    for tn, tm in topic_meta.items():
        narrative = NARRATIVES.get(tn)
        nodes.append({
            "id": f"topic_{tn}", "type": "topic", "label": f"T{tn}",
            "topic": tn, "topic_title": tm["title"], "hlr_count": tm["count"],
            "ts": TOPIC_TO_TS.get(tn, []),
            "legal": TOPIC_TO_LEGAL.get(tn, []),
            "narrative": narrative,
        })

    # TS nodes
    ts_in_use = set()
    for tslist in TOPIC_TO_TS.values(): ts_in_use.update(tslist)
    for ts in sorted(ts_in_use, key=lambda s: int(s[2:])):
        nodes.append({
            "id": f"ts_{ts}", "type": "ts", "label": ts,
            "title": TS_META.get(ts, ts),
            "topics": [tn for tn, tslist in TOPIC_TO_TS.items() if ts in tslist],
        })

    # Legal nodes
    legal_in_use = set()
    for ll in TOPIC_TO_LEGAL.values(): legal_in_use.update(ll)
    for lid in sorted(legal_in_use):
        title, year, kind = LEGAL_META.get(lid, (lid, "", "cir"))
        nodes.append({
            "id": f"legal_{lid.replace(' ', '_').replace('/', '-')}",
            "key": lid, "type": "legal", "label": lid,
            "title": title, "year": year, "kind": kind,
            "topics": [tn for tn, ll in TOPIC_TO_LEGAL.items() if lid in ll],
        })

    # Discussion-topic nodes
    discussions = parse_discussion_topics()
    for d in discussions:
        # label: short letter prefix + rr suffix
        label = d["letter"] + ("·rr" if d["is_rr"] else "")
        nodes.append({
            "id": d["id"],
            "type": "disc",
            "label": label,
            "letter": d["letter"],
            "is_rr": d["is_rr"],
            "title": d["title"],
            "version": d["version"],
            "date": d["date"],
            "github": d["github"],
            "tldr": d["tldr"],
            "body": d["body"],
            "topics": d["topics"],
            "hlr_refs": d["hlr_refs"],
            "iteration": d["iteration"],
            "arf_version": d["arf_version"],
            "rr_pair": d["rr_pair"],
            "delta": d["delta"],
            "filename": d["filename"],
        })

    # ============================================================
    # Build edges
    # ============================================================
    edges = []
    seen = set()
    def add_edge(s, t, k):
        key = (s, t, k)
        if key in seen: return
        seen.add(key)
        edges.append({"source": s, "target": t, "type": k})

    for hid in hlrs:
        for ch in children_of.get(hid, []): add_edge(hid, ch, "parent-child")
        for ref in references_from.get(hid, []): add_edge(hid, ref, "reference")
    for h in hlrs.values():
        add_edge(f"topic_{h['topic_number']}", h["id"], "contains")
    for tn, tslist in TOPIC_TO_TS.items():
        for ts in tslist:
            add_edge(f"ts_{ts}", f"topic_{tn}", "implements")
    for tn, ll in TOPIC_TO_LEGAL.items():
        for lid in ll:
            add_edge(f"legal_{lid.replace(' ', '_').replace('/', '-')}", f"topic_{tn}", "governs")
    # Tension edges
    for t in tensions:
        add_edge(t["a"], t["b"], "tension")

    # Discussion edges: disc → topic (discusses), disc ↔ disc-rr (refines)
    for d in discussions:
        for tn in d["topics"]:
            if f"topic_{tn}" in {n["id"] for n in nodes if n["type"] == "topic"}:
                add_edge(d["id"], f"topic_{tn}", "discusses")
        if d["is_rr"] and d.get("rr_pair"):
            add_edge(d["id"], d["rr_pair"], "refines")

    # ============================================================
    # Glossary + quiz cards (computed after we have hlrs+tensions)
    # ============================================================
    definitions, definition_terms = parse_definitions()
    quiz_cards = parse_flashcards() + build_pitfall_cards(NARRATIVES, hlrs) + build_tension_cards(tensions, hlrs)

    # ============================================================
    # Reference implementation augmentation
    # ============================================================
    feat_map = parse_feature_map()
    # Build feat_id → ref_impl
    feat_id_to_refimpl = {}
    for feat_name, feats in FEATMAP_TO_FEAT.items():
        meta = feat_map.get(feat_name)
        if not meta or not feats: continue
        for fid in feats:
            feat_id_to_refimpl[fid] = meta
    # Annotate FEATURES list in-place
    for feat in FEATURES:
        if feat["id"] in feat_id_to_refimpl:
            feat["reference_impl"] = feat_id_to_refimpl[feat["id"]]

    # Per-topic aggregation: which features+statuses cover this topic, plus extras.
    topic_to_refimpl = defaultdict(list)
    for feat in FEATURES:
        ri = feat.get("reference_impl")
        if not ri: continue
        for tn in feat.get("primary_topics", []):
            topic_to_refimpl[tn].append({
                "label": ri["name"],
                "status": ri["status"],
                "roadmap_url": ri.get("roadmap_specific") or ri.get("roadmap_url"),
                "source": "feat",
                "feat_id": feat["id"],
            })
    # Topic-only extras (no feature counterpart)
    for tn, (label, _topic_label) in TOPIC_REFIMPL_EXTRA.items():
        meta = feat_map.get(label)
        if not meta: continue
        topic_to_refimpl[tn].append({
            "label": meta["name"],
            "status": meta["status"],
            "roadmap_url": meta.get("roadmap_specific") or meta.get("roadmap_url"),
            "source": "topic_extra",
        })

    # Per-HLR inferred status: pick the *best* feature (most-relevant) and surface its status.
    # Best = HLR is in feat.key_hlrs, then HLR.prefix in feat.primary_prefixes, then HLR.topic in feat.primary_topics.
    def _hlr_to_feat(hid, h):
        prefix_match = re.match(r"^([A-Za-z][A-Za-z0-9_]*?)_\d+", hid)
        prefix = prefix_match.group(1) if prefix_match else None
        # Pass 1: explicit key
        for feat in FEATURES:
            if feat.get("reference_impl") and hid in (feat.get("key_hlrs") or []):
                return feat
        # Pass 2: prefix
        for feat in FEATURES:
            if feat.get("reference_impl") and prefix and prefix in (feat.get("primary_prefixes") or []):
                return feat
        # Pass 3: topic
        for feat in FEATURES:
            if feat.get("reference_impl") and h["topic_number"] in (feat.get("primary_topics") or []):
                return feat
        return None
    hlr_to_refimpl = {}
    for hid, h in hlrs.items():
        feat = _hlr_to_feat(hid, h)
        if feat:
            hlr_to_refimpl[hid] = {
                "feat_id": feat["id"],
                "feat_name": feat["name"],
                "status": feat["reference_impl"]["status"],
                "roadmap_url": feat["reference_impl"].get("roadmap_specific") or feat["reference_impl"].get("roadmap_url"),
            }

    # Augment in-memory hlr nodes (we'll inject when building hlr node entries —
    # too late here, so we update the already-built nodes list).
    for n in nodes:
        if n["type"] == "hlr" and n["id"] in hlr_to_refimpl:
            n["reference_impl_inferred"] = hlr_to_refimpl[n["id"]]
        elif n["type"] == "topic" and n["topic"] in topic_to_refimpl:
            n["reference_impl"] = topic_to_refimpl[n["topic"]]

    # ============================================================
    # Legal text parsing
    # ============================================================
    for n in nodes:
        if n["type"] != "legal": continue
        parsed = parse_legal_text(n["key"])
        if parsed:
            n["text"] = parsed
            # Also expose a relative PDF path for click-through
            txt_fn = LEGAL_FILE.get(n["key"])
            if txt_fn:
                n["pdf_rel"] = f"{LEGAL_PDF_DIR_REL}/{txt_fn[:-4]}.pdf"

    # ============================================================
    # Service blueprints
    # ============================================================
    blueprints = list(SERVICE_BLUEPRINTS)
    # Pull text excerpts for fallbacks (first 50 non-empty lines, capped at 1500 chars)
    for bp_id, title, topic, summary in SERVICE_BLUEPRINT_FALLBACKS:
        # Find the corresponding .txt
        candidates = list(BLUEPRINT_TEXT_DIR.glob(f"annex-{bp_id}-*.txt"))
        text_excerpt = ""
        if candidates:
            raw = candidates[0].read_text(encoding="utf-8", errors="replace")
            lines = [ln for ln in raw.splitlines() if ln.strip()]
            text_excerpt = "\n".join(lines[:50])[:1500]
        # Match the PDF
        pdf_candidates = list(Path(BUNDLE / "annexes/annex-4-service-blueprints").glob(f"annex-{bp_id}-*.pdf"))
        pdf_rel = (BLUEPRINT_DIR_REL + "/" + pdf_candidates[0].name) if pdf_candidates else None
        blueprints.append({
            "id": bp_id, "title": title, "topic": topic, "topics_extra": [],
            "summary": summary,
            "pdf_rel": pdf_rel,
            "mermaid": None,
            "text_excerpt": text_excerpt,
        })

    # ============================================================
    # Stats + output
    # ============================================================
    stats = {
        "total_nodes": len(nodes),
        "hlr_nodes":   sum(1 for n in nodes if n["type"] == "hlr"),
        "topic_nodes": sum(1 for n in nodes if n["type"] == "topic"),
        "ts_nodes":    sum(1 for n in nodes if n["type"] == "ts"),
        "legal_nodes": sum(1 for n in nodes if n["type"] == "legal"),
        "disc_nodes":  sum(1 for n in nodes if n["type"] == "disc"),
        "non_empty_hlrs": sum(1 for n in nodes if n["type"] == "hlr" and not n["is_empty"]),
        "empty_hlrs":     sum(1 for n in nodes if n["type"] == "hlr" and n["is_empty"]),
        "edges": len(edges),
        "parent_child_edges": sum(1 for e in edges if e["type"] == "parent-child"),
        "reference_edges":    sum(1 for e in edges if e["type"] == "reference"),
        "contains_edges":     sum(1 for e in edges if e["type"] == "contains"),
        "implements_edges":   sum(1 for e in edges if e["type"] == "implements"),
        "governs_edges":      sum(1 for e in edges if e["type"] == "governs"),
        "tension_edges":      sum(1 for e in edges if e["type"] == "tension"),
        "discusses_edges":    sum(1 for e in edges if e["type"] == "discusses"),
        "refines_edges":      sum(1 for e in edges if e["type"] == "refines"),
        "feature_count":      len(FEATURES),
        "narratives":         len(NARRATIVES),
        "path_count":         len(LEARNING_PATHS),
        "definition_count":   len(definitions),
        "definition_terms":   len(definition_terms),
        "quiz_card_count":    len(quiz_cards),
        "quiz_decks":         sorted({c["tags"]["deck"] for c in quiz_cards if c["tags"].get("deck")}),
        "legal_parsed":       sum(1 for n in nodes if n["type"] == "legal" and n.get("text")),
        "legal_articles":     sum(len(n.get("text", {}).get("articles", [])) for n in nodes if n["type"] == "legal"),
        "legal_recitals":     sum(len(n.get("text", {}).get("recitals", [])) for n in nodes if n["type"] == "legal"),
        "legal_annexes":      sum(len(n.get("text", {}).get("annexes", [])) for n in nodes if n["type"] == "legal"),
        "feat_with_refimpl":  sum(1 for f in FEATURES if f.get("reference_impl")),
        "hlr_with_refimpl":   sum(1 for n in nodes if n["type"] == "hlr" and n.get("reference_impl_inferred")),
        "blueprints_total":   len(blueprints),
        "blueprints_mermaid": sum(1 for b in blueprints if b.get("mermaid")),
        "categories": sorted(set(n["category"] for n in nodes if n["type"] == "hlr")),
    }

    out = {
        "stats": stats,
        "nodes": nodes,
        "edges": edges,
        "features": FEATURES,
        "tensions": tensions,
        "paths": LEARNING_PATHS,
        "definitions": definitions,
        "definition_terms": definition_terms,
        "quiz": quiz_cards,
        "blueprints": blueprints,
        "legal_celex": LEGAL_CELEX,
        "legal_eli": LEGAL_ELI,
    }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("=== Stats ===")
    for k, v in stats.items():
        if isinstance(v, list): print(f"  {k}: {len(v)} {v if len(v) < 9 else '...'}")
        else: print(f"  {k}: {v}")
    print(f"\nDetected {len(tensions)} tensions across {len(set(t['a'] for t in tensions) | set(t['b'] for t in tensions))} HLRs.")
    print(f"Glossary: {len(definitions)} definitions ({len(definition_terms)} regex terms after pruning).")
    print(f"Discussion topics: {len(discussions)} papers ({sum(1 for d in discussions if d['is_rr'])} rr).")
    print(f"Quiz: {len(quiz_cards)} cards ({sum(1 for c in quiz_cards if c['source']=='deck')} deck, "
          f"{sum(1 for c in quiz_cards if c['source']=='pitfall')} pitfall, "
          f"{sum(1 for c in quiz_cards if c['source']=='tension')} tension).")
    print(f"Legal text parsed: {stats['legal_parsed']}/{stats['legal_nodes']} docs · "
          f"{stats['legal_recitals']} recitals + {stats['legal_articles']} articles + {stats['legal_annexes']} annexes.")
    print(f"Reference impl: {stats['feat_with_refimpl']}/{len(FEATURES)} features mapped · {stats['hlr_with_refimpl']} HLRs inherit a status.")
    print(f"Blueprints: {stats['blueprints_total']} total ({stats['blueprints_mermaid']} hand-curated Mermaid, {stats['blueprints_total'] - stats['blueprints_mermaid']} text-fallback).")
    print(f"Wrote {OUT_PATH} ({OUT_PATH.stat().st_size} bytes)")

    # Bake the rendered HTML from modular sources, if they exist.
    if SHELL_PATH.exists() and STYLE_PATH.exists() and JS_DIR.is_dir():
        bake_html(out)


def bake_html(data):
    """Concatenate hlr_explorer_src/{shell.html, style.css, js/*.js} +
    inject the JSON-encoded data. Writes to RENDERED_HTML_PATH."""
    shell = SHELL_PATH.read_text(encoding="utf-8")
    css = STYLE_PATH.read_text(encoding="utf-8")
    js_files = sorted(JS_DIR.glob("*.js"))
    js_parts = []
    for jf in js_files:
        body = jf.read_text(encoding="utf-8")
        # Insert a marker comment so source mapping by filename is feasible if
        # we ever need to track down a runtime error.
        js_parts.append(f"\n/* ----- src/js/{jf.name} ----- */\n{body}")
    js_concat = "".join(js_parts)
    json_blob = json.dumps(data, ensure_ascii=False, separators=(",", ":"))

    # Substitute placeholders.
    out = shell.replace("__CSS__", css, 1)
    out = out.replace("__SCRIPT__", js_concat, 1)
    out = out.replace("__HLR_DATA__", json_blob, 1)

    RENDERED_HTML_PATH.write_text(out, encoding="utf-8")
    print(f"Baked HTML: {len(out):,} bytes from {len(js_files)} JS modules → {RENDERED_HTML_PATH}")


if __name__ == "__main__":
    main()
