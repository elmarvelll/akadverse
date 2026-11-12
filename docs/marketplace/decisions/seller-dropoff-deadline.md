# Decision: Seller drop-off deadline is 15 hours before the start of the new day of the estimated delivery date

- **Date**: 2026-08-28.
- **Context**: The seller needs a hard deadline to have an order ready and physically dropped at the central drop-off point, ahead of the estimated delivery date.
- **Problem**: "15 hours before delivery" is ambiguous — before the delivery *window start* (5:00 PM)? Before the delivery *date* begins?
- **Chosen option**: 15 hours before **12:00 AM** (the start of the calendar day) of the estimated delivery date — i.e. 9:00 PM the evening before. `services/marketplace/delivery/dropoff-deadline.service.ts#getSellerDropoffDeadline`.
- **Reason**: Directly and explicitly specified by the implementation spec, including a worked clarification of exactly this ambiguity.
- **Consequences**: A seller preparing for a Wednesday estimated delivery must drop off by Tuesday 9:00 PM, not "15 hours before 5:00 PM Wednesday" (which would be a different, later time — Tuesday 2:00 AM would be 15h before Wed 5PM, which is obviously wrong; the chosen interpretation gives sellers a full business evening's buffer instead).
- **Alternatives rejected**: 15 hours before the delivery window's start time — rejected as explicitly ruled out by the spec's own clarification.
