<!--
This is the verbatim E-Learning specification the user provided at the
start of the AGENTS.md §N — Foundation → DAPU implementation (2026-09-14).

IMPORTANT — a citation note: while implementing this spec, every code
comment and doc in this codebase that says "AGENTS.md §N" is citing a
section of THIS document, not the repo's actual AGENTS.md file (which only
contains Next.js's own auto-generated agent-rules block — see its header).
That label was a naming mistake made early on and, by the time it was
noticed, had already propagated into ~95 source comments; rather than risk
a large mechanical rewrite across all of them, the fix was to make the
label resolve to something real instead: this file. So wherever you see
"AGENTS.md §9" in a comment, read it as "this file, §9" — the section
numbers below match exactly.
-->

# AkadVerse E-Learning — Specification

## 1. Objective

Build the **E-Learning module of AkadVerse** as a separate academic system from the existing Marketplace functionality.

The E-Learning system must support different types of AkadVerse users:

* Student
* Faculty
* HOD
* DAPU
* Dean
* VC

However, **VC and Dean functionality are intentionally not being designed or implemented yet**. Their routes/placeholders may exist if needed for architecture, but their actual functionality must remain undefined until explicitly specified later.

The system should be designed so that academic functionality can grow without making the existing Marketplace codebase/database increasingly difficult to maintain.

---

# 2. Major Architecture Decision

## Separate E-Learning database from Marketplace database

The existing/main database currently contains authentication credentials and Marketplace data.

**Do not move the existing authentication system at this stage.**

Keep authentication/user identity in the existing/main database.

The architecture should become:

```text
AkadVerse
│
├── Core Identity / Authentication
│       │
│       └── Existing/Main Database
│
├── Marketplace
│       │
│       └── Existing/Main Database
│
└── E-Learning
        │
        └── Separate E-Learning Database
```

The existing/main database should therefore be considered the **AkadVerse Core + Marketplace database**, rather than thinking of it as purely the Marketplace database.

The E-Learning system gets its own database.

---

# 3. Prisma Architecture

Because the two domains use separate databases, use:

* One Prisma schema/client for the existing Core/Marketplace database.
* One Prisma schema/client for the E-Learning database.

Conceptually:

```text
prisma/
├── marketplace/
│   └── schema.prisma
│
└── elearning/
    └── schema.prisma
```

Or an equivalent project structure that keeps the schemas clearly separated.

There should be two database connections:

```env
MARKETPLACE_DATABASE_URL=...
ELEARNING_DATABASE_URL=...
```

Use separate Prisma clients, for example:

```text
src/lib/db/
├── marketplace.ts
└── elearning.ts
```

Do not combine all Marketplace and E-Learning models into one enormous Prisma schema.

---

# 4. Authentication Architecture

Authentication remains in the existing/main database.

Existing authentication-related models such as:

```text
User
Account
Session
VerificationToken
```

should remain where they currently live.

The E-Learning database should NOT duplicate authentication credentials.

The E-Learning database should reference users through their existing `userId`.

For example:

```prisma
model StudentProfile {
  id     String @id @default(cuid())
  userId String @unique

  departmentId String
  level        Int
}
```

`userId` is an application-level reference to the user in the Core/Marketplace database.

Do not create a database-level foreign key across the two databases.

---

# 5. User Roles

The main user role should represent the user's primary identity within AkadVerse.

Use roles conceptually similar to:

```text
STUDENT
FACULTY
HOD
DAPU
DEAN
VC
```

However:

### Level Adviser is NOT a separate role.

A Level Adviser is a faculty member who has an additional responsibility.

Therefore:

```text
User.role = FACULTY
```

and the user can additionally have:

```text
isLevelAdviser = true
```

with information identifying the level they supervise.

For a simple first implementation, fields could look like:

```prisma
isLevelAdviser Boolean @default(false)
levelAdviserOf Int?
```

However, because academic responsibilities need historical/session-aware information eventually, design the system so this can evolve into a proper assignment model.

A scalable version would look conceptually like:

```text
LevelAdviserAssignment
├── facultyId
├── departmentId
├── level
├── academicSession
└── semester
```

Do not make Level Adviser a top-level role.

---

# 6. DAPU

DAPU is a primary role in the current system.

Therefore, do NOT unnecessarily create:

```text
isDAPU
```

if the user already has:

```text
role = DAPU
```

The same principle applies to HOD.

Use the role for primary authority and additional fields/assignments for responsibilities.

---

# 7. Development/Test Role Override

During development/testing, the account:

```text
marvelousifezue31
```

must be able to test different roles.

This is specifically a **development/testing convenience**.

It must NOT become a production authorization mechanism.

Do NOT allow a production user to simply select:

```text
Student
Faculty
HOD
DAPU
VC
Dean
```

from a dropdown and gain that role.

The selected account type/domain may influence the test login flow during development, but actual production authorization must come from the user's stored role and server-side authorization.

---

# 8. Login / Email Domain Selection

The current login experience asks the user for the local part of their email and allows them to select the account type/domain.

Maintain this behavior.

Domains currently specified:

```text
Student → @stu.cu.edu.ng
Faculty → @faculty.cu.edu.ng
HOD → @HODEIE.cu.stu.ng
DAPU → @DAPU.cu.edu.ng
VC → @VC.cu.edu.ng
Dean → @DEAN.cu.edu.ng
```

Do not silently change the HOD domain even though it appears inconsistent. Preserve the currently specified value unless it is explicitly corrected later.

Example:

```text
marvelousifezue31
+
Student
=
marvelousifezue31@stu.cu.edu.ng
```

The account-type/domain selector should appear alongside the email input.

Again, this login-domain selection must not itself be trusted as authorization in production.

---

# 9. Marketplace Access

Marketplace is **students-only**.

If the authenticated user's role is not:

```text
STUDENT
```

the Marketplace must not be available to them.

This must be enforced at multiple levels.

## UI

Do not display Marketplace in navigation for:

* Faculty
* HOD
* DAPU
* Dean
* VC

Do not merely hide it with CSS.

## Routing

If a non-student manually visits a Marketplace route, reject/redirect them.

## Backend/API

Marketplace API endpoints must also verify that the authenticated user is a student.

Never trust the frontend navigation.

The rule is:

```text
role !== STUDENT
        ↓
Marketplace access denied
```

---

# 10. General E-Learning Layout

All E-Learning roles should use a common overall application structure:

```text
┌───────────────────────────────────────────┐
│                 Header                    │
├───────────────┬───────────────────────────┤
│               │                           │
│   Sidebar     │       Main Content        │
│               │                           │
│               │                           │
└───────────────┴───────────────────────────┘
```

The sidebar changes based on the authenticated user's role and responsibilities.

Do not create completely separate authentication systems for each role.

---

# 11. Student Sidebar

Student navigation should cover:

```text
Dashboard

Study Zone
├── My Courses
├── Learning Resources
└── Syllabus

Academic Records
├── Results
├── GPA / CGPA
└── Academic History

Course Control
├── Course Registration
├── Add / Drop Course
└── Registration Status
```

The original conceptual requirement was that Study Zone and Course Control contain expandable sections.

Keep the UI clean and intuitive.

---

# 12. Student Dashboard

The Student Dashboard should eventually provide a useful academic overview.

It should be capable of displaying information such as:

* Current academic session
* Current semester
* Current level
* Registered courses
* Course registration status
* Academic deadlines
* Recent results
* GPA/CGPA summary
* Important academic announcements

Do not hard-code academic session/semester data.

---

# 13. Student Study Zone

## My Courses

Display the student's courses for the current academic session/semester.

A course should contain information such as:

```text
Course Code
Course Title
Credit Unit
Lecturer
Department
Level
Semester
```

## Learning Resources

Provide access to academic materials associated with the student's registered courses.

Resources can include:

* Lecture notes
* Documents
* Assignments
* Other approved learning materials

## Syllabus

Syllabus should be associated with the relevant course.

---

# 14. Academic Records

Students should be able to access:

### Results

Display results by academic session and semester.

### GPA / CGPA

Calculate and display:

```text
Semester GPA
Cumulative GPA / CGPA
```

The calculation must use actual academic records rather than hard-coded values.

### Academic History

Provide historical academic information across sessions and semesters.

---

# 15. Course Control

Course Control should contain:

### Course Registration

Allow students to register courses within the active registration period.

### Add/Drop Course

Allow course modifications only when the relevant academic timeframe permits it.

### Registration Status

Students should be able to see the state of their registration, such as:

```text
Draft
Submitted
Pending Level Adviser Approval
Pending HOD Approval
Approved
Rejected
```

The exact final state machine can be refined during implementation.

---

# 16. Faculty Dashboard

Faculty users should have:

```text
Dashboard
My Courses
Results Record
```

If the faculty member is also a Level Adviser, show an additional section:

```text
Level Adviser
├── Course Registrations
└── Approvals
```

The Level Adviser section should only appear when the faculty member actually has that responsibility.

---

# 17. Faculty Dashboard / Timetable

The Faculty Dashboard should display the faculty member's timetable.

It should show relevant:

* Course
* Class
* Time
* Venue
* Level
* Department

Timetable data must eventually come from the academic timetable system rather than being hard-coded.

---

# 18. Faculty — My Courses

Faculty should be able to see all courses/classes assigned to them for the current academic session/semester.

For each course, they should be able to:

* View students
* Upload/assign lecture notes
* Upload/assign assignments
* Manage relevant course materials

The exact file/resource system can be implemented separately.

---

# 19. Faculty — Results Record

Faculty should be able to record student results for courses they are assigned to teach.

The result record should support:

```text
Test 1
Test 2
Exam
Full CA
```

The exact grading/calculation rules should be modeled properly rather than scattered throughout frontend code.

Faculty should only be able to modify results for courses they are authorized to teach.

---

# 20. Level Adviser

A Level Adviser is a Faculty member with an additional responsibility.

Example:

```text
User
role = FACULTY

isLevelAdviser = true
levelAdviserOf = 300
```

Preferably, the eventual assignment should also identify:

```text
Department
Level
Academic Session
Semester
```

The Level Adviser can:

* View student course registrations
* Review registrations
* Approve registrations
* Reject/request changes where applicable

The Level Adviser must only see students belonging to the relevant academic scope.

---

# 21. HOD

HOD should have:

```text
Dashboard

Assignments
├── Assign Lecturers
├── Assign Level Advisers
└── Assignment History

Approvals
├── Course Registration
└── Result Upload

Results
├── By Level
├── By Course
└── By Student
```

---

# 22. HOD — Assignments

The HOD should be able to assign lecturers to courses.

Example:

```text
EEE301
↓
Assigned Lecturer
```

The HOD should also be able to assign Level Advisers.

Example:

```text
300 Level EEE
↓
Level Adviser
↓
Faculty Member
```

Previous assignments should remain viewable through assignment history.

Do not simply overwrite historical assignments.

Academic assignments should be associated with the relevant academic session/semester.

---

# 23. HOD — Approvals

HOD should receive course-registration approvals after the Level Adviser process.

The workflow should conceptually be:

```text
Student
   ↓
Course Registration
   ↓
Level Adviser
   ↓
HOD
   ↓
Approved
```

HOD should also be able to approve result uploads submitted by faculty.

---

# 24. HOD — Results

HOD should be able to view academic results at different levels.

Examples:

```text
By Level
By Course
By Student
```

A result matrix could look conceptually like:

```text
300 LEVEL — EEE

Student        EEE301   EEE303   EEE305   ...   GPA
-----------------------------------------------------
Student A       78       65       82             4.21
Student B       61       72       70             3.88
Student C       85       81       76             4.52
```

Provide appropriate filtering by:

* Academic session
* Semester
* Level
* Course
* Student

---

# 25. DAPU

DAPU is responsible for higher-level academic administration.

Navigation:

```text
Dashboard

Course Structure
├── Receive Structure
├── Review Structure
└── Send to HOD

Academic Time Frames
├── Course Registration
├── Result Upload
├── Result Revalidation
├── Change of Course
└── Make-up Application

Timetable
├── Review
├── Approve
└── Send to HODs
```

---

# 26. DAPU — Course Structure

DAPU receives course structures.

DAPU should be able to:

1. Receive course structure.
2. Review it.
3. Send the approved/relevant structure to HODs.

The structure should support academic organization such as:

```text
Faculty
↓
Department
↓
Program
↓
Level
↓
Semester
↓
Courses
```

---

# 27. DAPU — Academic Time Frames

DAPU controls academic deadlines.

These include:

```text
Course Registration
Result Upload
Result Revalidation
Change of Course
Make-up Application
```

These deadlines must be stored in the database.

**Do not hard-code dates in frontend code.**

For example:

```text
Course Registration
Start: ...
End: ...
```

The system should check these timeframes when students/faculty/HODs attempt the relevant actions.

---

# 28. DAPU — Timetable

DAPU should:

```text
Review timetable
↓
Approve timetable
↓
Send timetable to HODs
```

The timetable should then become available to relevant faculty/students according to their academic scope.

---

# 29. VC and Dean

Do not invent functionality for:

```text
VC
Dean
```

These roles are intentionally reserved for later design.

Create architecture that can support them, but do not make assumptions about what they can do.

If their routes need to exist, they can initially contain a placeholder.

Wait for explicit requirements before implementing their dashboards, permissions, workflows, or approval systems.

---

# 30. Academic Data Hierarchy

The E-Learning system should be based around a proper academic hierarchy:

```text
University
└── Faculty
    └── Department
        ├── Program
        ├── Course
        ├── Lecturer
        └── Level
```

Students should belong to the appropriate:

* Faculty
* Department
* Program
* Level

Courses should belong to the appropriate academic structure.

---

# 31. Academic Session and Semester

Every academic operation should be scoped by:

```text
Academic Session
+
Semester
```

For example:

```text
2026/2027
First Semester
```

Do not design academic records as if they only exist for the current year.

Historical data must remain accessible.

The system should therefore have proper concepts/models for:

```text
AcademicSession
Semester
```

and relevant records should reference them.

---

# 32. Suggested Result Workflow

Results should follow a controlled workflow:

```text
DRAFT
   ↓
SUBMITTED
   ↓
VALIDATED
   ↓
APPROVED
   ↓
PUBLISHED
```

Conceptually:

### DRAFT

Faculty is entering/editing results.

### SUBMITTED

Faculty submits results for review.

### VALIDATED

The result has passed the relevant validation process.

### APPROVED

Authorized administrator approves it.

### PUBLISHED

The result becomes visible to students.

The exact transition permissions must be enforced server-side.

---

# 33. Suggested E-Learning Routes

Use a structure similar to:

```text
/e-learning
│
├── /student
│   ├── /dashboard
│   ├── /study-zone
│   ├── /academic-records
│   └── /course-control
│
├── /faculty
│   ├── /dashboard
│   ├── /courses
│   └── /results
│
├── /hod
│   ├── /dashboard
│   ├── /assignments
│   ├── /approvals
│   └── /results
│
├── /dapu
│   ├── /dashboard
│   ├── /course-structure
│   ├── /timeframes
│   └── /timetable
│
├── /dean
│
└── /vc
```

Do not rely on the URL itself for security.

---

# 34. Server-Side Authorization

Every protected E-Learning route/API must verify:

1. User is authenticated.
2. User's role.
3. User's academic scope.
4. Additional responsibility where required.

Examples:

```text
Faculty
→ Can only edit results for courses assigned to them.

Level Adviser
→ Can only approve registrations within their assigned level/department.

HOD
→ Can only manage their department.

DAPU
→ Can manage authorized academic-wide administrative operations.
```

Never trust:

* Client-side role values
* URL parameters
* Hidden navigation items
* Frontend dropdown selections

for authorization.

---

# 35. Database Separation Rules

Marketplace and E-Learning must not become tightly coupled at the database level.

Avoid:

```text
E-learning table
   ↓ Prisma relation
Marketplace User table
```

across databases.

Instead:

```text
E-learning.StudentProfile.userId
```

stores the corresponding Core User ID.

Application code can resolve the identity when necessary.

This keeps the two domains independently scalable.

---

# 36. Two Prisma Clients

The application should have clearly separated database clients.

Conceptually:

```text
marketplaceDb
elearningDb
```

Do not accidentally import the Marketplace Prisma Client inside E-Learning repositories/services unless there is a genuine identity lookup requirement.

Likewise, E-Learning database access should remain isolated from Marketplace data access.

Prefer domain-based architecture such as:

```text
src/
├── modules/
│   ├── marketplace/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── ...
│   │
│   └── elearning/
│       ├── services/
│       ├── repositories/
│       └── ...
│
└── lib/
    └── db/
        ├── marketplace.ts
        └── elearning.ts
```

Adapt this structure to the existing project rather than blindly replacing the current architecture.

---

# 37. Important Implementation Principle

Do not over-engineer the first version.

The goal is:

```text
Clean separation
+
Correct authorization
+
Correct academic data relationships
+
Future scalability
```

Do not introduce microservices, event buses, distributed transactions, or unnecessary infrastructure merely because there are two databases.

Two databases and two Prisma clients are sufficient for this stage.

---

# 38. Avoid Cross-Database Transactions

Do not design operations that require an atomic transaction across:

```text
Marketplace DB
+
E-learning DB
```

These are separate domains.

If an operation needs information from both systems, resolve the data at the application/service layer.

---

# 39. E-Learning Database — Initial Conceptual Models

The exact schema should be refined before implementation, but expect models around:

```text
AcademicSession
Semester

Faculty
Department
Program
Level

StudentProfile
FacultyProfile

Course
CourseStructure

CourseAssignment
LevelAdviserAssignment

CourseRegistration
CourseRegistrationItem

LearningResource
Assignment

Result
ResultComponent

AcademicTimeFrame
Timetable
TimetableEntry
```

Do not blindly create every model before analyzing relationships.

Build the schema around actual workflows.

---

# 40. Important Relationship Principle

Academic relationships must be historical.

For example, don't simply store:

```text
Course
lecturerId
```

if a course can have different lecturers in different semesters.

Prefer an assignment concept:

```text
CourseAssignment
├── courseId
├── facultyId
├── academicSessionId
├── semesterId
└── ...
```

Similarly, Level Adviser assignments should be historical rather than simply overwriting a faculty member's current responsibility.

---

# 41. UI Expectations

The interface should be:

* Clean
* Responsive
* Desktop-friendly
* Mobile-friendly
* Consistent with AkadVerse branding
* Role-aware
* Easy to navigate

Use expandable sidebar sections where appropriate.

For example:

```text
Study Zone       ▼
   My Courses
   Learning Resources
   Syllabus
```

Only show functionality the current user actually has access to.

---

# 42. Do Not Break Marketplace

The E-Learning implementation must not unnecessarily modify or restructure existing Marketplace functionality.

The existing Marketplace should continue functioning independently.

Do not migrate Marketplace data simply to create the E-Learning database.

Do not rewrite existing Marketplace Prisma models unless there is an explicit reason.

The objective is to **add E-Learning as a separated academic domain**, not destabilize Marketplace.

---

# 43. Final Architecture Target

The resulting system should conceptually look like:

```text
                           AKADVERSE
                              │
                    ┌─────────┴─────────┐
                    │                   │
              CORE IDENTITY         E-LEARNING
                    │                   │
              Existing DB          Separate DB
                    │                   │
          ┌─────────┴───────┐           │
          │                 │           │
     Authentication     Marketplace    Academic
                                      System
                                          │
                       ┌──────────────────┼──────────────────┐
                       │                  │                  │
                    Student            Faculty             Admin
                                                               │
                                               ┌───────────────┼──────────────┐
                                               │               │              │
                                              HOD             DAPU        Future VC/Dean
```

The identity system remains centralized.

Marketplace remains in the existing database.

E-Learning gets its own database and Prisma client.

---

# 44. Implementation Priority

Implement in this order:

### Phase 1 — Foundation

* E-Learning database
* Separate Prisma schema
* Separate Prisma client
* Academic session/semester
* User role handling
* Student/faculty/HOD/DAPU profiles
* Server-side authorization
* E-Learning layout/sidebar

### Phase 2 — Student

* Dashboard
* My Courses
* Learning Resources
* Syllabus
* Academic Records
* Results
* GPA/CGPA
* Academic History
* Course Registration
* Add/Drop
* Registration Status

### Phase 3 — Faculty

* Dashboard
* Timetable
* My Courses
* Learning resources
* Assignments
* Result entry
* Result submission

### Phase 4 — Level Adviser

* Faculty responsibility assignment
* Student registration viewing
* Registration approval workflow

### Phase 5 — HOD

* Lecturer assignments
* Level Adviser assignments
* Assignment history
* Registration approvals
* Result approvals
* Result views by level/course/student

### Phase 6 — DAPU

* Course structure
* Academic timeframes
* Timetable review/approval
* Sending academic information to HODs

### Phase 7 — Future

* Dean
* VC

Do not implement the final phase until requirements are explicitly provided.

---

# 45. Core Principle

The E-Learning system should be treated as a **first-class academic platform inside AkadVerse**, not as a collection of pages added to Marketplace.

The most important architectural decisions are:

```text
ONE AkadVerse identity
        +
SEPARATE Marketplace domain
        +
SEPARATE E-Learning domain
        +
SEPARATE databases
        +
SEPARATE Prisma clients
        +
ROLE-BASED authorization
        +
RESPONSIBILITY-BASED permissions
        +
SESSION/SEMESTER-AWARE academic data
```

Do not compromise these boundaries merely to make the initial implementation faster.

At the same time, avoid unnecessary complexity. Build the architecture cleanly enough that E-Learning can grow independently while keeping the existing Marketplace stable.
