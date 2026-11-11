Update the My Attendance section for faculty on the academic platform used by Covenant University.

Modify the structure of the page to simplify it and make all attendance types calendar-based.

Remove Category Label

Remove the section name “Faculty Affairs.”

Instead of grouping attendance types under that label, show three cards directly at the top of the page.

Top Attendance Cards

Display three attendance cards.

[ Chapel Service ]   [ Fellowship ]   [ Work Attendance ]

Each card should include:

icon

title

short description

hover animation

click interaction

Hover behavior:

card lifts slightly (5–8px)

shadow becomes stronger

Click behavior:

card compresses slightly

selected attendance calendar opens

Chapel Service

Chapel services follow the existing logic.

Example schedule:

College of Engineering → Tuesday
CLDS → Tuesday

CMSS → Thursday
CST → Thursday

When Chapel Service is clicked, display a monthly attendance calendar.

Calendar color rules:

Green → attended
Red → missed
Grey → no service that day
White → upcoming chapel service

Fellowship

Fellowship attendance holds every Friday.

When Fellowship is clicked, show a monthly calendar tracking attendance.

Calendar rules:

Green → attended
Red → missed
White → upcoming Friday
Grey → non-Friday days

Work Attendance

Add Work Attendance as the third attendance category.

Work attendance tracks a lecturer’s daily work presence.

When Work Attendance is clicked, display a monthly attendance calendar.

Calendar rules:

Green → present at work
Red → absent
White → future working day
Grey → weekends or official holidays

Do not display percentage statistics for work attendance.

This section should rely entirely on the calendar visualization, consistent with the other attendance types.

Calendar Design

All attendance types should use the same interactive calendar design.

The calendar should:

show a monthly view

allow switching between months

display color-coded attendance

show details when a date is hovered or clicked

Example tooltip:

May 10
Work Attendance
Status: Present
Design Goal

The My Attendance page should feel simple, consistent, and visually clear.

All attendance types should follow the same pattern:

My Attendance
   │
   ├── Chapel Service
   ├── Fellowship
   └── Work Attendance

Each attendance type opens a calendar-based tracking system, making it easy for faculty to visually monitor their attendance across the month.