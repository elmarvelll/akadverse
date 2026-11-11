Create the Email Integration page/module that opens when a student clicks Email Integration inside Student Essentials.

The goal is to allow students to connect their school email account and view important academic emails in one place.

This stage focuses mainly on UI layout and interaction design, not deep backend logic.

Page Header

At the top display:

Email Integration

Subtitle:

Connect your academic email to receive course updates and announcements.

Layout Structure

Divide the page into two main sections.

Left side → Email connection options
Right side → Recent academic emails preview

Desktop layout:

Connection Panel | Email Feed

Mobile layout:

Connection panel on top
Email feed below

Section 1 — Email Connection Panel

Display a card titled:

Connect Your Email

Description:

Link your school email so AkadVerse can detect important academic messages.

Provide connection buttons for common services.

Buttons:

Connect Gmail
Connect Outlook
Connect School Email

Each button should include:

service icon

service name

hover animation

Example button design:

[Gmail icon] Connect Gmail

When clicked:

A connection process begins (for now this can simulate connection).

Connected State

Once an email account is connected, the panel should change to:

Email Connected

Display:

Connected account email address.

Example:

Connected Account
john.doe@university.edu

Also show:

Disconnect button

Section 2 — Academic Email Feed

Display a panel titled:

Recent Academic Emails

Show a list of recent academic-related emails.

Each email card should display:

Sender
Subject
Date

Example:

Subject
Assignment Deadline — CSC 301

Sender
Prof. Johnson

Date
Today • 2:30 PM

Email Card Design

Each email should appear as a clickable card.

Card contains:

Subject (bold)
Sender
Date

Optional small tag:

Assignment
Exam
Announcement

Clicking an Email

When an email is clicked:

Open a side panel or modal showing the email content preview.

Fields displayed:

Subject
Sender
Date
Message preview

Empty State

If the student has not connected any email, show a friendly empty state.

Message:

No email account connected yet.

Button:

Connect Email

Animations

Include smooth animations to match the rest of the dashboard.

Page Load

Fade-in animation

Duration:

300ms

Email Card Hover

Card slightly lifts and shadow increases.

Duration:

200ms

Connection Button Hover

Buttons highlight and slightly scale up.

Scale:

1 → 1.03

Email Click Animation

When opening an email:

Side panel slides in from the right.

Duration:

250–300ms

Design Goal

The Email Integration page should feel:

clean

simple

modern

easy to understand

Students should quickly understand that this section helps them see important academic emails without opening their inbox