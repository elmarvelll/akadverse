# Recorded Stewart response

`conflict-response.json` contains the actual `answer`, source titles/previews and retrieval counters returned by the configured Concept Explainer `/explain` on 10 November 2026 for `pls explain intra group conflict`, EEE311 Week 1. The document ID was replaced with a stable fixture identifier. No credentials, student identity or session history are included.

It reproduces the important presentation case: a generated example inside `answer`, the same example's truncated preview in `sources`, and six source chunks referencing the same lecture document. Rendering must not append source previews as answer content. This recorded response exercises the actual API shape; other tests deliberately construct Markdown, malformed input and repeated examples.

The additional `definition`, `structured`, `followup`, `attachment-math` and `attachment-followup` response fixtures were retrieved from the same configured service during this implementation. The structured conflict question requested headings, a comparison table and three distinct examples; its follow-up reused an isolated verification session. The attachment case used a real PNG produced by the production capture component and a small circuit-notes TXT file, then asked a follow-up in the same session. Both attachments were deleted successfully (204) afterward.

Opaque document/attachment IDs are replaced with stable fixture values. Actual answer strings, source previews and retrieval counter shapes are retained. These capture current behavior, including a trailing empty example marker, italicized filename citations and standalone same-line `$$equation$$` math. Automated rendering tests use the recorded JSON; they do not call the live service.
