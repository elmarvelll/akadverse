# Revisions AI integration gaps and coordination handoff

16 November 2026. Read the actual configured service's `/openapi.json` (HTTP 200) and the AkadVerse adapters. No message has been sent to an external engineer and no shared contract has been changed.

| Area | Current implementation | Required behavior / proposed agreement | Status |
|---|---|---|---|
| Generation | POST `/generate-revision-questions`, known teaching/student/concept/context inputs | Preserve existing request, background orchestration and synchronous receiver | Reuse unchanged |
| Callback | HMAC raw body, five-minute timestamp, exact teaching-key body replay, results/outcomes | Preserve existing signing and idempotency | Reuse unchanged |
| Concept IDs | `/analyse-material` external IDs unique within material | Confirm stability across repeated analysis and plan/material versions | Confirmation needed |
| Material/plan provenance | No version, plan-run or immutable source fields in revision generation request/result | Agree explicit version lineage before extending signed payloads | External dependency; backend source-metadata fingerprint is not an AI version |
| Question schema | MCQ/short_answer/true_false, answers, explanation, difficulty/Bloom/tags | Preserve all formats; agree optional source references and evaluation criteria | Existing payload unchanged |
| Evaluation | POST `/evaluate-practice`; required concept_id/description, question, expected_answer, student_answer; optional criteria/reasoning/response_type | Reuse exact endpoint for revision answers; confirm quality/calibration for all three types | No new endpoint or field needed for initial integration |
| Evaluation output | Correctness, feedback, reasoning quality, evidence strength, needs_review, next step; optional misconceptions | Persist output; student separately chooses FSRS recall rating | Reuse unchanged |
| Approval/quality | Backend validity judge and accepted/rejected outcomes; no explicit publication lifecycle | AkadVerse publication/suspension/retirement remains authoritative | Backend policy, not AI authorization |
| Embeddings | AkadVerse `gemini-embedding-2`,1536,revision-v1; separate from producer RAG | Keep locked and independent; no new vector database | Previously agreed |
| Actual usage | No token/usage/execution identity in published generation or evaluation response | Agree actual execution ID/model/token counts/reused-execution flags before usage billing integration | External dependency; do not estimate actual billing |
| Delivered teaching | Explain response does not establish versioned delivered concept actions | Agree stable concept/lesson IDs and delivery evidence; compatible initial coverage uses saved passed practice only | External/product follow-up |
| Retry/timeout | Producer previously reported 10-second callback attempts | At least 30 seconds recommended; retain original body across retries | External confirmation needed |

Additional confirmations requested for the eventual versioned contract: immutable source references, schema version negotiation, retryable/permanent error taxonomy and exact usage semantics. AkadVerse can implement local publication, eligibility, sessions, shared FSRS and evidence storage independently. It must not claim the AI engineer has agreed to fields absent from the current schema.
