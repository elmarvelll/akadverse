Here is a **complete, structured prompt** you can use to design or update the **Sign Up flow** so that it opens when users click **“Don’t have an account? Sign up”** from the sign-in page. It includes the **three role flows (Student, Faculty, Admin)**, **no dropdowns**, and **smooth transitions** as you specified.

---

# Prompt: Implement Multi-Role Sign Up Flow for AkadVerse

Add a **Sign Up flow** to the AkadVerse authentication system. This flow should open when the user clicks **“Don’t have an account? Sign up”** on the sign-in page.

The signup process should support **three user roles**:

* Student
* Faculty
* Admin

The experience should be **modern, clean, and step-based**, with **smooth transitions between questions**. Avoid dropdown menus; instead use **input fields, selectable cards, or suggestion chips**.

---

# Entry Point

On the sign-in page, below the login button, display:

**Don’t have an account? Sign up**

When clicked:

* the **signup interface opens**
* use a **smooth slide or fade transition**
* the layout should match the existing **split-screen design of the sign-in page**

Left side → signup questions
Right side → animated mesh gradient visual (same as sign-in page)

---

# Step 1 — Role Selection

First screen asks:

**How will you use AkadVerse?**

Display **three large selection cards**.

Card layout:

Student
Faculty
Admin

Each card should include:

* icon
* title
* short description

Example descriptions:

**Student**
Access AI study tools, courses, and campus resources.

**Faculty**
Manage courses, teaching tools, and student progress.

**Admin**
Oversee institutional systems and campus activity.

When a card is selected, the system **transitions into that role’s signup flow**.

Transition animation:

fade + slide
300ms

---

# Student Signup Flow

When **Student** is selected, present a guided multi-step signup.

---

### Step 1 — Full Name

Question:

What’s your full name?

Input field:

Full Name

Example placeholder:

John Doe

---

### Step 2 — School Email

Question:

What’s your school email?

Input field:

School Email

Example placeholder:

[john.doe@university.edu](mailto:john.doe@university.edu)

---

### Step 3 — Create Password

Question:

Create a password

Fields:

Password
Confirm Password

Include a **show/hide password icon**.

---

### Step 4 — Matric Number

Question:

What is your matric number?

Input field:

Matric Number

Example placeholder:

CSC/2023/1045

---

### Step 5 — Registration Number

Question:

What is your registration number?

Input field:

Registration Number

Example placeholder:

REG20231245

---

### Step 6 — Program / Major

Question:

What program are you studying?

Input field with **suggestion chips**, not dropdowns.

Example suggestions:

Computer Science
Mechanical Engineering
Economics
Law
Architecture

Users can type or select.

---

### Step 7 — Year of Study

Question:

What year are you in?

Display **large selectable cards**:

1st Year
2nd Year
3rd Year
4th Year
Postgraduate

Cards highlight when selected.

---

### Step 8 — Confirmation

Display a summary:

Name
Email
Matric Number
Registration Number
Program
Year of Study

Primary button:

Create Account

---

# Faculty Signup Flow

When **Faculty** is selected, show a simplified multi-step form.

---

### Step 1 — Full Name

Question:

What’s your full name?

Input field:

Full Name

---

### Step 2 — Institutional Email

Question:

What’s your institutional email?

Input field:

Institution Email

Example placeholder:

[s.johnson@university.edu](mailto:s.johnson@university.edu)

---

### Step 3 — Create Password

Fields:

Password
Confirm Password

Include show/hide password toggle.

---

### Step 4 — Staff ID

Question:

What is your staff ID?

Input field:

Staff ID

Example placeholder:

STF-20481

---

### Step 5 — Department

Question:

Which department do you belong to?

Use **search input with suggestion chips**.

Examples:

Computer Science
Mechanical Engineering
Business Administration
Law
Medicine

---

### Step 6 — Position

Question:

What is your role?

Display **selection cards**:

Lecturer
Senior Lecturer
Professor
Teaching Assistant

---

### Step 7 — Confirmation

Display summary:

Name
Email
Staff ID
Department
Position

Primary button:

Create Faculty Account

---

# Admin Signup Flow

When **Admin** is selected, show a minimal signup process.

---

### Step 1 — Full Name

Question:

What’s your full name?

Input field:

Full Name

---

### Step 2 — Administrative Email

Question:

What’s your administrative email?

Input field:

Admin Email

Example placeholder:

[admin@university.edu](mailto:admin@university.edu)

---

### Step 3 — Create Password

Fields:

Password
Confirm Password

---

### Step 4 — Administrative Role

Question:

What administrative role do you hold?

Display **selection cards**:

System Administrator
Academic Administrator
IT Department
Registrar Office

---

### Step 5 — Admin ID

Question:

Enter your admin ID

Input field:

Admin ID

Example placeholder:

ADM-1023

---

### Step 6 — Confirmation

Display summary:

Name
Email
Role
Admin ID

Primary button:

Create Admin Account

---

# Shared UX Elements

All signup flows should include:

### Progress Indicator

Display progress at the top.

Example:

Step 3 of 6

or

● ● ● ○ ○ ○

---

### Navigation

Back button allows users to edit previous answers.

Next button only activates when required fields are filled.

---

### Transitions

Between steps use:

slide + fade
300ms
ease-in-out

---

# Design Goals

The signup experience should feel:

* modern
* smooth
* simple
* friendly for students
* professional for faculty and admin

Avoid long forms and avoid dropdown menus. The experience should feel like a **guided onboarding process** rather than a traditional registration form.

---

If you want, the **next thing we should design** (which will affect the whole platform) is the **account creation success screen and first-time onboarding**, because that determines **what users see immediately after signing up.**
