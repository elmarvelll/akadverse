When a faculty member clicks Attendance inside Faculty Essentials, the page should display two main cards.

[ My Attendance ]     [ Upload Attendance ]

Each card should include:

Icon

Title

Short description

Hover animation (card lifts slightly)

Click interaction that opens the selected section

1. Upload Attendance

When Upload Attendance is clicked, open the Attendance Upload Workspace.

This section is used for recording student class attendance.

Take the original attendance interface design that already exists and place it inside this section, but modify the method of capturing attendance.

Attendance Capture Methods

Attendance can only be recorded in two ways:

Photo Capture

Lecturer takes a photo of the physical attendance sheet.

The system then uploads and processes the image.

Example workflow:

Start Class
↓
Take Photo of Attendance Sheet
↓
Upload
↓
System records attendance

Upload Attendance Sheet

Lecturer uploads a digital attendance file.

Supported formats may include:

CSV

Excel

PDF

The system reads the file and records attendance.

Important Rule

Remove all other attendance marking methods.

Faculty cannot manually mark attendance in the system.

Only these two methods should exist:

Capture image of attendance sheet

Upload attendance file

2. My Attendance

When My Attendance is clicked, open the Faculty Personal Attendance Dashboard.

This page tracks faculty attendance obligations.

Tell Figma AI to take visual and structural reference from the Student Attendance interface.

However, rename and adjust the categories.

Top Cards

Display two cards at the top.

[ Work Attendance ]     [ Faculty Affairs ]
Work Attendance

This replaces Student Class Attendance.

It tracks the lecturer’s work attendance and presence at the university.

Display information such as:

Days present

Days absent

Attendance percentage

Example:

Work Attendance Rate: 92%

Faculty Affairs

This replaces Student Affairs.

Inside Faculty Affairs, include two attendance categories.

[ Chapel Service Attendance ]   [ Fellowship ]
Chapel Service Attendance

This works the same way as the student chapel service system.

Chapel services occur on specific days depending on the faculty’s college.

Example:

College of Engineering → Tuesday
CLDS → Tuesday

CMSS → Thursday
CST → Thursday

Below this section include a monthly calendar.

Calendar color logic:

Green → attended
Red → missed
Grey → no service that day
White → upcoming service

Fellowship Attendance

Faculty fellowship holds every Friday.

The calendar should track these sessions.

Calendar color logic:

Green → attended
Red → missed
White → upcoming Friday
Grey → non-Friday days

Calendar Design

Below the attendance cards include a large monthly interactive calendar.

The calendar should allow:

switching months

hovering on a date to view attendance details

clicking a date to view attendance information

Example tooltip:

May 10
Fellowship
Status: Attended
Design Goal

The Faculty Attendance system should be divided into two clear purposes:

Upload Attendance

Used by lecturers to submit student class attendance.

My Attendance

Used by lecturers to track their own institutional attendance obligations, including:

work attendance

chapel services

faculty fellowship

The interface should remain consistent with the student attendance design while reflecting the faculty responsibilities.