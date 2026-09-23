# System: Layout & Navigation

## Purpose

One common Header + Sidebar + Main content shell (§10) for every E-Learning role, with a role-appropriate expandable nav tree (§11/§16/§21/§25/§41).

## Components

- `src/app/e-learning/layout.tsx` (server) — resolves the session (`requireElearningSession`, redirects to `/login` on failure), resolves `isLevelAdviser` for a faculty user (one extra `facultyProfile.findUnique`), renders `Header` + `Sidebar`.
- `src/app/e-learning/_components/Header.tsx` (client) — branding, role badge, name, sign-out. Styled to match `src/app/components/dashboard/student/DashboardNavbar.tsx` (the Marketplace-side student navbar) for visual consistency.
- `src/app/e-learning/_components/Sidebar.tsx` (client) — expand/collapse state, active-route highlight (`usePathname`). **Builds its own nav tree** from the `role`/`isLevelAdviser` props (see below), rather than receiving a built tree.
- `src/app/e-learning/_components/nav-config.ts` — `getStudentNav()`, `getFacultyNav(isLevelAdviser)`, `getHodNav()`, `getDapuNav()`, `getDeanNav()`/`getVcNav()` (both return `[]` — §29, no functionality to navigate to). Each returns `NavSection[]`, either a direct link or an expandable group of `NavLeaf`s (icon + label + href).

- `src/app/e-learning/_components/Shell.tsx` (client) — the responsive frame (see below). Owns the mobile drawer's open state.
- `Sidebar.tsx` supports one nested level (a group inside a group, e.g. Course Control inside Academic Essentials) and renders a group with no pages (Student **Study Zone**) as a plain label.

## Responsive design

Every E-Learning page works from 320px up. The techniques, all in shared code so new pages inherit them:

| Concern | Technique |
|---|---|
| Navigation | `Shell.tsx`: below `lg` the sidebar is an **off-canvas drawer** (opened from the header's menu button, closed by the backdrop, `Escape`, or navigating; page scroll is locked while open; hidden from keyboard/screen readers when closed). From `lg` it is a fixed 18rem (`lg:w-72`) column, wide enough that the longest section names (e.g. "Academic Essentials") stay on one line; section headers and nested-group labels are also `whitespace-nowrap`, so a label never breaks onto a second line. |
| Header | Compact on phones: name/role badge/"Sign out" text appear from `sm`/`md` up; icons remain. |
| Content width | `<main>` is `min-w-0` with `p-4 sm:p-6`, so wide content can never stretch the page. |
| Tables | Each table sits in an `overflow-x-auto` wrapper with a `min-w-[…]` so it scrolls inside its card instead of squashing or widening the page. |
| Grids / card lists | Mobile-first: one column by default, `sm:`/`lg:` breakpoints add columns. |
| Row + action lists | `flex-wrap` with a `gap`, so buttons drop below the text on narrow screens. |
| Forms | `globals.css` (scoped to `.elearning-shell`): inputs/selects/textareas are capped to their container and may shrink, labels and direct form children can shrink (`min-width: 0`), and controls are 16px below `sm` so iOS Safari does not zoom on focus. |
| Long text | `overflow-wrap: break-word` on `<main>`: file names, emails and long course titles wrap. |
| Week slider | Horizontal scroll-snap strip with prev/next buttons (touch-friendly). |

**Verified** with `scripts/verify-responsive.ts`: headless Chrome loads all 44 E-Learning pages (student, faculty, HOD, DAPU, with temporary long-title/long-file-name fixtures) at 320, 375 and 768px as real test accounts, and fails on any page-level horizontal scroll or any element sticking out of the viewport outside its own scroll container; it also checks the mobile drawer opens and closes. Last run: 126 of 126 passed. Not covered: real touch devices, landscape phones, and the Dean/VC placeholder pages (which only show a short notice).

## Why Sidebar builds its own tree instead of receiving one

A real bug, caught by testing (not a preemptive design): `nav-config.ts`'s sections carry lucide-react icon **components** (functions). Next.js server components can only pass *plain, serializable* data as props to client components — passing a function throws `"Functions cannot be passed directly to Client Components"` at render time, which is exactly what happened when `layout.tsx` originally built the tree server-side and passed it to `Sidebar` as a prop. Fixed by having `layout.tsx` pass only plain values (`role: ElearningRole`, `isLevelAdviser: boolean`) and having `Sidebar` (already a client component, already importing `nav-config.ts`) call the right `get*Nav()` function itself.

## Authorization note

Nav visibility is **UI convenience only**. Every link it renders points at a route that independently re-checks role/scope server-side (`src/proxy.ts` + the page's own `requireElearningRole`) — a hidden nav item was never the security boundary, same principle as the Marketplace admin sidebar (`src/app/studashboard/admin/_components/AdminDomainSidebar.tsx`'s own header comment says the same thing).

## Placeholder pages

Every leaf route in every role's nav tree has a real `page.tsx` — none are dead links — but most of Student/Faculty/HOD/DAPU's deeper pages that aren't yet built out use a shared `ComingSoon` component (`src/app/e-learning/_components/ComingSoon.tsx`, distinct from the Marketplace-side one at `src/app/components/dashboard/shared/ComingSoon.tsx`, which needs a client-side `useAuth()` loading state this one doesn't). As of the last phase completed, the only remaining `ComingSoon` leaves are Dean's and VC's own placeholder pages — everything else has real content.
