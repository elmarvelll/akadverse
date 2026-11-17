# Buddy System manual acceptance checklist

Use three student accounts in separate browser profiles: **A** (creator), **B**, and **C** (applicants). Use a fourth non-student account for role checks if available. Apply the migration and sign in first. `Workspace` below means `/studashboard/productivity-layer`; `Buddy` means its Buddy System section. Use test groups/invitations rather than sharing real private information. For API checks, inspect responses in browser DevTools Network; send modified requests only in a local/staging environment.

Each row includes its starting location, exact action, expected outcome and failure indicator. These are manual checks, not claims of executed automated coverage.

| ID | Start | Exact steps | Expected outcome; failure indicator |
| --- | --- | --- | --- |
| NAV-01 | A, Workspace, desktop | Click Buddy System in the existing sidebar. | Buddy landing page appears and sidebar item is selected; fail if missing, wrong route or duplicated sidebar. |
| NAV-02 | Buddy | Click Discover, Buddy Requests, Buddy Groups, My Groups, My Requests & Applications in turn. | Appropriate section appears with clear active state; fail if blank, mislabeled or mixed personal/discovery data. |
| NAV-03 | Any Buddy group card | Open details; copy the URL; refresh; open copied URL in a new signed-in tab. | Same group loads at `#buddy?listing=…`; fail if lost detail or an unrelated page. |
| NAV-04 | Workspace, 390px viewport | Open the mobile sidebar; choose Buddy System; reopen sidebar. | Selection works, menu dismisses and can reopen; fail if content is inaccessible or menu traps navigation. |
| NAV-05 | Workspace, desktop | Collapse sidebar; choose community icon; expand sidebar. | Icon has Buddy System accessible name and active state; fail if label/icon disappears or selection fails. |
| NAV-06 | E-Learning student portal | Check expanded sidebar and collapsed rail; activate return link. | Back to Home label/title returns to `/studashboard`; fail if it still says Marketplace or targets the wrong destination. |
| NAV-07 | Stewart with idle voice controls | Read the small note, then start/stop voice input if configured. | No AssemblyAI provider note; recording/status/error controls remain usable; fail if provider note remains or controls break. |
| DIS-01 | A, Buddy Groups | Create a group titled “MTH 201 Circle”; return to Buddy Groups; search `mth 201`. | Group appears despite case difference; fail if title matching is case-sensitive or absent. |
| DIS-02 | Buddy Groups | Give that group description “Preparing for differential equations”; search ` differential `. | Group appears after debounce and trimming; fail if description search fails. |
| DIS-03 | Buddy Groups | Clear the search field; type a term with no matches. | Open results restore when cleared, then an understandable empty state appears; fail if stale matches persist indefinitely. |
| DIS-04 | Buddy Groups | Inspect a group with limit 3 and an unlimited group. | Creator, description, date, status and `1 / 3` or `1 members · Unlimited` display; fail if creator is omitted from counts or unlimited displays zero. |
| DIS-05 | Discovery | Fill one group and close another; refresh discovery. | Full/Closed groups are excluded; fail if either advertises an available join action. |
| DIS-06 | Group card | Open details. | Full description, creator, status, capacity and correct relationship action appear; fail if private invitation is shown to an unrelated student. |
| DIS-07 | Discovery, DevTools Offline | Press Refresh; return Online; press Retry loading. | Actionable error then recovered results; fail if endless loading, silent failure or full-page reload required. |
| DIS-08 | Discovery with more than 24 records | Click Next, then Previous. | Correct pages, no duplicate entry within a page and disabled boundaries; fail if pagination does not change records. |
| CRT-01 | A, Buddy, Create | Select Buddy Group; enter title, description, supported invitation and maximum 3; submit once. | Group detail opens, status Open, member count 1; fail if group or creator membership is absent. |
| CRT-02 | A, Create Group | Enter valid fields and leave maximum blank; submit. | Unlimited group created and capacity is null, not zero; fail if form requires a limit or group becomes Full. |
| CRT-03 | A, Create Group | Submit with missing title, then missing description, then missing link. | Each required field prevents submission; fail if incomplete record is created. |
| CRT-04 | A, Create Group | Try `https://example.com`, `javascript:alert(1)`, a fake WhatsApp subdomain and a public Telegram username URL. | Unsupported invitations rejected; fail if any becomes an active chat link. |
| CRT-05 | A, Create Group | Try a legitimate WhatsApp invitation, WhatsApp `?mode=gi_t`, Telegram `+token` and `joinchat/token` invitation. | Supported invitation formats accepted; fail if legitimate invitation format cannot be saved. Use actual valid tokens for manual checks. |
| CRT-06 | A, Create Group | Try capacity 0, -1 and 1.5; then leave empty. | Invalid values rejected, empty allowed; fail if decimals/nonpositive values save. |
| CRT-07 | A, Create Group | Set maximum 1 and submit valid fields. | Creator counts as one and group starts Full; fail if another student can apply. |
| CRT-08 | A, Create Group, slow network | Double-click submit while request is pending. | Only one in-flight creation from the form and button disabled; fail if duplicate groups are created by repeated clicks. |
| CRT-09 | A, newly created group | Open Approved Members and My Groups → Groups I Manage. | Creator marked Accepted/Creator and group listed under management; fail if count is zero or owner group is duplicated in Joined. |
| JOIN-01 | B, A's open group | Click Request to Join and submit. | Success feedback and Pending application state; fail if immediately Accepted or external invitation appears. |
| JOIN-02 | B, Pending group | Repeat original apply request using DevTools; refresh details. | Server rejects duplicate and exactly one membership record remains; fail if count grows or duplicate pending requests appear. |
| JOIN-03 | A, own group detail | Inspect actions and replay an apply request using A's session. | No self-join action and server rejects self-application; fail if a second creator membership is made. |
| JOIN-04 | B, Pending group, Network panel | Inspect detail JSON and list/search responses. | No privateDetails/contact/invitation field for B; fail if secret is returned even when visually hidden. |
| JOIN-05 | B, My Requests & Applications | Choose Group Requests I Submitted; open application. | Group and Pending application visible with separate listing status; fail if pending is displayed as the group's lifecycle status. |
| MGT-01 | A, My Groups → Groups I Manage | Open group with B pending. | Pending count and B's display name/date with Accept/Decline; fail if request missing or unrelated personal data is exposed. |
| MGT-02 | A, management detail | Accept B; then B focuses their browser and opens group. | Count increments once, application Accepted and invitation becomes available; fail if stale after refresh or link remains unavailable. |
| MGT-03 | C, same group | Apply; A selects Decline; C opens submitted applications. | C sees Declined, member count unchanged, invitation absent; fail if C gains access or application vanishes without outcome. |
| MGT-04 | C, declined group | Replay apply request. | Reapplication rejected under current single-record policy; fail if a new Pending membership silently appears. |
| MGT-05 | B, approved group | Inspect Approved membership and Join Group Chat action; open chat. | Validated external invitation opens with noopener/noreferrer; note explains external joining is separate; fail if arbitrary URL opens or AkadVerse claims external membership is verified. |
| MGT-06 | A, group with members and pending requests | Click Close Group, cancel confirmation; then confirm. | Cancel preserves state; confirm makes Closed; fail if cancellation closes or confirmation leaves new joins enabled. |
| MGT-07 | Closed group, B and another pending applicant | B opens existing membership; A attempts pending acceptance; outsider attempts apply. | B retains chat access, new apply/accept rejected; fail if closure is overwritten or new membership accepted. |
| MGT-08 | A, closed group | Open My Groups → Groups I Manage. | Closed group remains visible/manageable; fail if lost from creator's groups. |
| MGT-09 | A, management detail, Offline | Try accepting/declining, then restore network and refresh. | Visible error, controls recover and status reflects actual server state; fail if falsely reports success or stays permanently disabled. |
| MY-01 | A with two created groups | Open My Groups → Groups I Manage; inspect both. | Both owned groups show correct counts/status/actions; fail if only the latest group appears. |
| MY-02 | B accepted into two groups | Open Groups I've Joined; open each detail. | Both accessible memberships listed with correct creator/count/status and chat access in detail; fail if search is needed to find them again. |
| MY-03 | A, accepted into C's group and owning others | Compare Managed and Joined. | Owned groups only in Managed; C's group in Joined; fail if ownership/membership are confused or duplicated. |
| MY-04 | B with pending, accepted and declined applications | Choose Group Requests I Submitted. | All three statuses persist and are distinguishable; fail if declined/pending records are treated as joined groups. |
| MY-05 | Fresh student, My Groups | Open Managed, then Joined; use empty-state actions. | Exact useful empty states with Create Group / Discover Groups actions; fail if dead end or mock listings appear. |
| CAP-01 | A, new group max 2 | B and C both apply before approval; inspect count. | Count remains 1 while both pending; fail if pending applicants consume approved member count. |
| CAP-02 | A, max-2 group | Accept B; then try accepting C. | First acceptance gives 2/2 and Full; second rejected; fail if count reaches 3 or stays Open. |
| CAP-03 | A, max-2 group with two pending applications | In two browser tabs, submit different Accept actions at nearly the same time. | Exactly one succeeds and accepted count stays 2 including creator; fail if both succeed or any private link leaks to rejected applicant. |
| CAP-04 | A, unlimited group | Approve B and C. | Count becomes 3 and group stays Open with Unlimited capacity; fail if null capacity blocks approval or marks Full. |
| CAP-05 | A, group with no approved applicants | Inspect details immediately after creation. | One Accepted member, the creator; fail if zero or two members. |
| PRI-01 | Unrelated authenticated C, detail URL | Open A's group and inspect Network JSON. | Public group info only; no link and no roster; fail if creator management/private data is returned. |
| PRI-02 | B/C, management API replay | Replay A's accept/decline/close request using noncreator session, then alter applicant/listing IDs. | 403 or appropriate rejection, no state changes; fail if another user can manage the listing. |
| PRI-03 | Signed-out browser | Request Buddy GET, POST and PATCH endpoints. Repeat with a nonstudent account. | Missing auth rejected; nonstudent forbidden; fail if any private data or successful mutation occurs. |
| PRI-04 | Staging/local DB only, approved group | Set test invitation to an invalid legacy URL; open as A and approved B. | Invitation unavailable message and no unsafe link; fail if corrupt URL becomes clickable. |
| PRI-05 | Local API client | Submit cross-origin JSON, malformed JSON and body over 16 KB. | Rejected without changing data; fail if invalid body reaches business operation. |
| BUD-01 | A, Buddy Requests → Create | Enter request title, description and private contact; create. | Open request appears and creator contact absent from discovery JSON; fail if request missing or contact public. |
| BUD-02 | B, A's request | Click I'm Interested; enter B's contact and submit. | Pending interest; A sees identity/date without B's contact; fail if either contact shared before acceptance. |
| BUD-03 | A, request with B and C pending | Accept B; open details as A, B and C. | Matched; A sees B's contact, B sees A's, C is Declined and sees neither; fail if multiple matches or unauthorized contacts. |
| BUD-04 | A, fresh request with B/C pending | Accept different applicants concurrently from two tabs. | One accepted buddy, other declined, request Matched; fail if both accepted. |
| BUD-05 | C, matched request | Replay interest and acceptance requests. | New interest rejected, unauthorized acceptance rejected; fail if matched request admits another buddy. |
| BUD-06 | A/B, My Requests & Applications | Choose Buddy Requests I Created as A, then Buddy Requests I Applied To as B. | Correct ownership/application records and outcomes; fail if one view contains the other user's unrelated requests. |
| UI-01 | Buddy, 1440px desktop | Browse, create, view detail and manage requests. | Balanced layout, visible controls, no page overflow; fail if clipping or overlapping actions. |
| UI-02 | Buddy, 768px tablet | Repeat discovery/details/create and scroll tabs. | Readable grid and accessible navigation/form; fail if form or actions exceed viewport. |
| UI-03 | Buddy, 390px mobile | Repeat joined-group access, creation and approval; scroll long descriptions. | Single-column cards, usable controls, no page-wide horizontal scrolling; fail if actions inaccessible. |
| UI-04 | Buddy, keyboard only | Tab through navigation, search, Create, form, details, approval and external link. | Visible focus and correct labels; native validation/status/error feedback; fail if keyboard trap or unnamed action. |
| UI-05 | Buddy after switching account | Sign out and sign in as another student, then reopen Buddy. | Previous account's data subtree cleared and new permissions enforced; fail if old private details remain visible. |
| UI-06 | Buddy then Tasks/Schedule/Habits | Switch between workspace sections; perform an ordinary task/habit/event action. | Existing features remain usable and Buddy stops hidden fetches; fail if navigation or unrelated save behavior regresses. |
