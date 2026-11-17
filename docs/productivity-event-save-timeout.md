# Event-save connection timeout

Production reference `1739b3ac-ce1d-4744-bd95-f105b3175fa5` returned HTTP 503 with Prisma `P2024` (connection acquisition timeout). The recorded failed phase was `academic.registrations`: 10,497 ms of the 13,112 ms request. The official timetable check failed inside the event-save transaction.

The registered-course resolver also resolves lecturer names through the Core Prisma client. Event saving already holds a Core transaction connection and user lock, so requesting another Core connection here can starve a small pool. The phase log covers several queries; it does not identify which database issued P2024 and therefore does not conclusively prove this was the connection that timed out.

Mutation conflict checks now request registered courses with `includeLecturerNames: false`, an existing resolver option. Approved registration scope, curriculum placement, approved timetable entries, dates, and overlap validation are retained. Normal calendar display still requests lecturer names. Request-local caches distinguish conflict-only data from display data. No database credentials, environment variables, pool sizes, transaction deadlines, or conflict-override rules were changed.

Validation: the 62-test productivity suite passed after the implementation change. An additional event-save regression then passed with the focused 14-test operations/academics suite. TypeScript and targeted ESLint checks passed. The regression checks that saving still invokes timetable validation without requesting lecturer identity connections.

This change removes a nested connection-acquisition risk. A successful authenticated production event save is still needed to establish resolution for the reported user. Session-pool saturation remains a separate possible cause if failures persist.
