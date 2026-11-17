# Focused manual acceptance

Run in staging with a synthetic student and registered course; never enable production flags merely to run this checklist. Automated fixture checks cover the listed invariants, but real-service/user acceptance remains separate.

1. With all new flags off, compare Study Zone, chat, ingestion and Revisions with the previous deployment.
2. Enable the master and ingestion flags. Upload a supported material; confirm ingestion queues analysis without running it in the callback.
3. Start the material lesson. Confirm preparation has a bounded pending/error state and resumes the same owned run.
4. Confirm canonical IDs and prerequisite order persist on reload. Another student cannot access the run.
5. Before receiving an explanation, confirm practice is unavailable.
6. Generate an explanation but withhold the delivery acknowledgement; confirm coverage remains absent.
7. Receive the explanation and acknowledge it twice; confirm one coverage row and unlocked practice.
8. Confirm generated examples and personal attachments alone never count as lecturer-material coverage.
9. Generate practice. Inspect the browser response: expected answers and private evaluation criteria must be absent.
10. Request a hint without a draft; confirm rejection. Submit a draft, request hints and confirm gradual levels.
11. Confirm full-solution help requires an explicit request; inspect responses for absence of private rationale.
12. Evaluate an assisted success and an independent success. Confirm only backend-independent evidence counts toward independent mastery.
13. Force a degraded evaluation. Confirm no real evidence/mastery promotion and progression pauses for review.
14. In shadow mode, press Continue lesson. Confirm a decision log and no downstream recommended action/content/progression.
15. In active mode, test disallowed actions, foreign targets, whitespace rationale, empty params and low valid confidence. Confirm guards/fallbacks match the documented rules.
16. Advance to the next concept. Confirm a separate explanation is pending and no new coverage exists before delivery.
17. Repeat the readiness signal. Confirm one eligible generation job; an untaught/unregistered student cannot receive a card.
18. Complete Course and Random reviews of one question. Confirm they update the same FSRS card. Mark an incorrect evaluated answer Easy: mastery must still need reinforcement.
19. Simulate a timeout/crash. Confirm the request becomes uncertain without automatic duplicate generation; use admin-only reconciliation after verifying the provider has stopped.
20. Disable flags with new jobs pending. Confirm they remain parked and legacy workers do not execute them. Confirm ordinary legacy flows still work.
21. Update/upload material under a new immutable identity. Confirm new concepts do not inherit old coverage without an authoritative mapping.
22. Verify stale/missing snapshot behavior, bounded bytes and one indexed snapshot lookup during chat. Confirm no raw histories or answers are sent as snapshot context.
23. On an invalid signed webhook, capture correlation ID and invalidField from the full INFO stream. Compare the sender's error.message and exact signed-byte metadata without logging secrets.
24. Check desktop/mobile layouts, keyboard controls, input preservation after hints, fresh inputs for new attempts, and pending/error/complete states with real service latency.
