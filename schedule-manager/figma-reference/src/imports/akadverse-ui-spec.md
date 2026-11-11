the AkadVerse web platform UI with interactive header navigation, main menu/dashboard, sidebar, Productivity Layer, YouTube hub, and Learning Essentials. The design should be modern, minimal, interactive, and student-focused.

1. Header Navigation (Center Icons)

Icons (centered in header):

Icon	Section	Destination
⚡ Lightning	Productivity	Opens Productivity Layer / Student Essentials
📖 Book	E-Learning	Opens Learning Essentials dashboard
🤖 AI	AI Tools	Opens AI Studio (coming soon)
🏠 Home	Dashboard	Opens Main Dashboard

Behavior:

Default state: grey (#9CA3AF), calm and minimal

Hover: icon brightens, soft circular background, scale 1 → 1.05, micro-animation:

⚡ Lightning: small spark/energy pulse

📖 Book: slight open animation

🤖 AI: glow/pulse

🏠 Home: tiny bounce

Click: compress 1 → 0.92 → 1, stronger animation, page transition slides new page in from right (250–300ms)

Active state: subtle glow / small dot below icon / slightly brighter color

Size: 22–24px; Spacing: 28–32px; Hover circle: 36–40px

2. Main Menu (Dashboard Panel)

Trigger: Clicking Main Menu in header

Dashboard Panel Content:

Quick glance info for students:

Schedule / Timetable

Recent emails / notifications

Reminders / updates

Style: Cards or sections, rounded corners, soft shadow, minimal padding

Animation: Fade + slight upward slide (300ms)

3. Smart Sidebar (Left, Dashboard View)

Sections:

Dashboard – active by default

Marketplace – coming soon

Student Essentials

Behavior:

Fixed vertical sidebar

Active section highlighted, subtle hover effect

Click interactions:

Dashboard: stays in Dashboard panel

Marketplace: shows “Coming Soon” page with animated pet

Student Essentials: opens Productivity Layer

4. Productivity Layer / Student Essentials

Tools Grid:

Docs

Drives

Forms

Sheets

Gemini Chat (replacing AI Studio inside this layer)

YouTube Integration (Netflix-style hub)

YouTube Hub Features:

Full-width, dark/charcoal modern theme

Videos split into categories:

Relating to your course

Depending on your ideal career choices

Other suggestions / trending / recommended

Video cards: thumbnail, title, description, hover zoom (1 → 1.05), play icon overlay

Click opens embedded modal player with video controls, title, description

Optional: Continue Watching row, search/filter, AI recommendations

Responsive layout: horizontal scroll per category, adapts to desktop/tablet/mobile

Tool Card Animations:

Hover: lift + shadow (5–8px, 200ms)

Click: compress (1 → 0.96 → 1, 120ms)

5. E-Learning Hub / Learning Essentials

Rename “My Learning” → “Learning Essentials”

Dashboard layout:

Course overview cards

Recent modules / progress

Recommended content

Hover on course cards: slight scale + shadow

Click opens course content

Smooth, modern, minimal style consistent with platform

6. Coming Soon Pages

Marketplace & AI Studio

Central content with animated pet

Fade-in animation for page load

Fun, engaging placeholder until feature is ready

7. Animations Summary
Action	Animation
Header icon hover	scale 1 → 1.05, micro-animation (150–200ms)
Header icon click	compress 1 → 0.92 → 1, slide page in (120–300ms)
Main Menu open	fade + slight upward slide (300ms)
Dashboard / tool card hover	lift 5–8px + shadow (200ms)
Dashboard / tool card click	compress 1 → 0.96 → 1 (120ms)
YouTube modal open	fade + slight upward slide (250–300ms)
“Coming Soon” page	fade-in + animated pet entrance
8. Design Goals

Minimal, modern, student-friendly, fast

Interactive header icons that respond to hover and click

Main Dashboard provides quick glance info

Sidebar navigation is intuitive, limited to essential sections

Productivity Layer has all core student tools including Gemini Chat + YouTube hub

Learning Essentials is organized, course-focused

“Coming Soon” placeholders are engaging and fun