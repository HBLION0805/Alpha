// Exact observed originals reviewed for a bounded read-only projection. Not a recurring source catalog.
export const REVIEWED_SOURCE_MAP=Object.freeze([
  {
    "id": "cboe_reviewed_pdf",
    "path": "data/runtime/options-weekly-sources/supplements/8b89ea74-b46e-4284-9cbf-15fd3ad40c26/receipt.json",
    "receiptSha256": "f18e2936dcc499a8cc80001b8e9e8bf1842ab22fd9edfeb04ee46ffc4e7e5d5b",
    "kind": "CBOE_PDF",
    "reviewedAt": "2026-10-11T06:57:46.446Z",
    "reviewPath": "data/runtime/options-weekly-sources/supplements/8b89ea74-b46e-4284-9cbf-15fd3ad40c26/visual-review.json",
    "reviewSha256": "54ad132f813380b458e0ade7ee793d101fbf6dc96e94f64c976a2751859b1109",
    "pdfPath": "data/runtime/options-weekly-sources/supplements/8b89ea74-b46e-4284-9cbf-15fd3ad40c26/calendar.pdf",
    "imagePath": "data/runtime/options-weekly-sources/supplements/8b89ea74-b46e-4284-9cbf-15fd3ad40c26/page-1.png"
  },
  {
    "id": "panw_featured_history",
    "path": "data/runtime/options-weekly-sources/company-stage3/panw_ir.json",
    "receiptSha256": "ff00de049a52a5fa89be76eab75ab2239b426eb9cec917e2970b717e2e13a66b",
    "kind": "PANW_HISTORY",
    "reviewedAt": "2026-10-11T06:57:46.446Z",
    "symbol": "PANW"
  },
  {
    "id": "hpe_full",
    "path": "data/runtime/options-weekly-sources/source-projection-stage5/hpe_full.json",
    "receiptSha256": "93bc16352837d3006b9c5810e9b7099c429d2ad1c2884f08893736a09c90d4ad",
    "kind": "HPE_HISTORY",
    "reviewedAt": "2026-10-11T06:57:46.446Z",
    "symbol": "HPE"
  },
  {
    "id": "hpe_events",
    "path": "data/runtime/options-weekly-sources/source-projection-stage5/hpe_events.json",
    "receiptSha256": "3904bcb8805c80b2e82f0ab010632f3a722473ef0eb5e1db9a2b364c175bed9b",
    "kind": "BOUNDED_FAILURE",
    "reviewedAt": "2026-10-11T06:57:46.446Z",
    "symbol": "HPE"
  },
  {
    "id": "now_target",
    "path": "data/runtime/options-weekly-sources/source-projection-stage5/now_target.json",
    "receiptSha256": "5b40e19d3c25998e67d8666debe8c8a61ab14277d6baddd2eccca1dda2287a3f",
    "kind": "BOUNDED_FAILURE",
    "reviewedAt": "2026-10-11T06:57:46.446Z",
    "symbol": "NOW"
  },
  {
    "id": "etn_events",
    "path": "data/runtime/options-weekly-sources/source-projection-stage5/etn_events.json",
    "receiptSha256": "91455e6665bdea9eb7c7fbd8313d5fa0f537e0d1e5f0ddb32bec3cd2f1e76d67",
    "kind": "ETN_HISTORY",
    "reviewedAt": "2026-10-11T06:57:46.446Z",
    "symbol": "ETN"
  },
  {
    "id": "asml_results",
    "path": "data/runtime/options-weekly-sources/source-projection-stage5/asml_results.json",
    "receiptSha256": "cc4d1d3f9abc46b9aad41e49a759159e945865766febcc92d2f496d3cff4246d",
    "kind": "ASML_RELEASE",
    "reviewedAt": "2026-10-11T06:57:46.446Z",
    "symbol": "ASML"
  },
  {
    "id": "pltr_events",
    "path": "data/runtime/options-weekly-sources/source-projection-stage5/pltr_events.json",
    "receiptSha256": "0ae0d4b16595f73a1184c5ff2efacf4434b398121a8b354511c8c8e17a1b7a7e",
    "kind": "DYNAMIC_SHELL",
    "reviewedAt": "2026-10-11T06:57:46.446Z",
    "symbol": "PLTR"
  }
]);
