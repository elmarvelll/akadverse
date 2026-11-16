# Revision question signature diagnostics

Checked 16 November 2026. Receiver: `POST /api/webhooks/tutor/questions`.

## Findings before changing verification

- Vercel Production has a **Sensitive** `AI_WEBHOOK_SECRET`. Its variable list has no `FSE_WEBHOOK_SECRET`.
- Railway calls its signing key `FSE_WEBHOOK_SECRET`; the engineer reports **64 raw UTF-8 bytes and 64 after trimming**. Different variable names are fine if the effective values match.
- Vercel does not return the sensitive value through `vercel env run`. No production byte length has been verified. Missing CLI output does not mean the deployed receiver lacks its configured secret.
- The receiver reads `request.body.getReader()`, accumulates `Uint8Array` chunks, and hashes `Buffer.concat(chunks)`. JSON parsing happens only after authentication. It does not reserialize JSON, add spaces, reorder keys, prefix the signature, prepend the timestamp, or decode the secret as hex/base64.
- The effective receiver key is the UTF-8 text of `AI_WEBHOOK_SECRET.trim()`. Therefore a raw trailing newline alone would not change its HMAC if the trimmed value matches the sender's key. Compare both raw and effective lengths.
- The header must be bare 64-character hex. Timestamp must be ISO UTC (`Z` or `+00:00`), within the existing five-minute past / 30-second future window. Unix timestamp strings are rejected before body reading.
- An undefined eventId on a rejected authentication request is expected: unverified JSON is never parsed to obtain its event_id. Use the response's `error.correlation_id` to identify these failures.

## Added local diagnostics

Immediately before an authentication 401, `[revision-questions] sig_debug` records:

- The same correlationId returned in the error response.
- signatureReceived and signatureComputed (bare hex).
- bodySha256 and exact byte bodyLength.
- timestampReceived and idempotencyKeyReceived.
- The receiver's secret variable name, configured/effective UTF-8 byte lengths, and boolean outer-whitespace/control-character indicators.
- reason: `hmac_mismatch`, `invalid_auth_headers` or `timestamp_outside_window`.

For header/timestamp failures, computed signature/body hash/body length are null: the receiver intentionally rejects these requests before consuming the body. Missing secret still fails closed with WEBHOOK_NOT_CONFIGURED (503). Successful authentication does not emit these temporary failure diagnostics. Secret values and raw request content are never logged.

Authentication rules are unchanged. These logs contain request signatures; limit them to the diagnostic period and remove the temporary logging after resolving the integration.

## Comparing the next request

| Observation | Interpretation |
|---|---|
| Received and computed signature match | This receiver's HMAC comparison should pass. A reported 401 needs its exact correlation ID and rejection reason; this does not establish a secret mismatch. |
| Body hashes match, signatures differ | Check the effective signing key, key encoding, signed input convention and HMAC algorithm. Same key length does not prove equal key contents. |
| Body hashes differ | First resolve the exact request-byte/path/transformation mismatch; do not infer a secret mismatch yet. |
| invalid_auth_headers | Check bare hex format and ISO UTC timestamp before investigating JSON formatting. |
| timestamp_outside_window | Check clock and timestamp freshness. |

## Validation and deployment status

The targeted protocol tests cover raw bytes, UTF-8 byte lengths, mismatch logging, no secret/payload leakage, early rejection without body consumption, no success log and shared correlation ID. Run `npm run test:revision:webhook`.

Production log retrieval on 16 November 2026 confirms diagnostics are deployed: deployment `dpl_DrpwfLPATAGDnKXssGAEKxptFZRq` emitted both `sig_debug` and `rejected` for correlation ID `a8f372d0-b02a-4052-a288-74f0965ba641`. The previous local-only status above was superseded by this runtime evidence. This investigation did not deploy changes, modify secrets, or send a webhook.

The complete matching Vercel record, including its nested runtime log entries, is saved in [`revision-signature-a8f372d0.jsonl`](revision-signature-a8f372d0.jsonl). Retrieval used only project/environment/time/correlation filters, with no event, severity, or source filter:

```sh
vercel logs --project akadverse --environment production --since 3d --query a8f372d0-b02a-4052-a288-74f0965ba641 --json --limit 100
```

For this request, `signatureReceived`, `timestampReceived`, and `idempotencyKeyReceived` were all null; reason was `invalid_auth_headers`. Body fields and computed signature are null because rejection preceded body consumption. Configured and effective receiver key lengths were both 64 UTF-8 bytes, with no outer whitespace or control characters. This does not prove equal key contents with the sender. It also does not identify the sender of this headerless request.

HMAC verification is in the **Node.js route handler**: `src/app/api/webhooks/tutor/questions/route.ts` → `handleRevisionWebhook` → `authenticateRevisionRequest`. `src/proxy.ts` explicitly passes `/api/webhooks` through before session authentication. The same handler-generated correlation ID is passed to signature diagnostics and returned in the error response. No middleware relocation is needed.

A proposed temporary public diagnostic deployment for secret lengths was rejected by automatic approval review because it would expose secret-derived metadata through a public endpoint. It did not run. The requested receiver logs are the safer diagnostic path; no alternate public metadata endpoint was created.
