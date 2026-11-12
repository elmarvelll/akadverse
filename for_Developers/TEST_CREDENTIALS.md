# Development test credentials

> **These accounts exist ONLY in your local development database**, created by `npm run db:local:seed`.
> They are fake, development-only accounts on the reserved `example.local` domain. They do **not** exist in staging
> or production, and none of them is a real person.
>
> **`admin.demo` is NOT the production administrator account.** It is a local-only account with the admin flag.

On <http://localhost:3000/login>, type the **whole email address** and the password.

Forgot one or changed a password? Re-run `npm run db:local:seed`. It resets every account below to the password
shown here.

## Quick reference

| Account | Password | Role | Lands on | Use it to test |
|---------|----------|------|----------|----------------|
| `student.demo@example.local` | `Student123!` | student | `/studashboard` | Student dashboard, My Learning (7 registered courses) |
| `student2.demo@example.local` | `Student123!` | student | `/studashboard` | A registration **waiting for the Level Adviser** |
| `student3.demo@example.local` | `Student123!` | student | `/studashboard` | A registration **waiting for the HOD** |
| `faculty.demo@example.local` | `Faculty123!` | faculty | `/facultydashboard` | Lecturer / course coordinator |
| `adviser.demo@example.local` | `Adviser123!` | faculty | `/facultydashboard` | Level Adviser (EEE, 300 Level) |
| `hod.demo@example.local` | `HodDemo123!` | hod | `/e-learning/hod/dashboard` | HOD of Electrical and Information Engineering |
| `dapu.demo@example.local` | `DapuDemo123!` | dapu | `/e-learning/dapu/dashboard` | DAPU (academic planning) |
| `admin.demo@example.local` | `Admin123!` | student + **admin flag** | `/studashboard` | Marketplace admin dashboard |
| `buyer.demo@example.local` | `Buyer123!` | student | `/studashboard` | Shopping: cart, orders, notifications |
| `plug.demo@example.local` | `Plug123!` | student | `/studashboard` | Owner of **Plug (Dev)** (business) |
| `vendor.demo@example.local` | `Vendor123!` | student | `/studashboard` | Owner of **Campus Bites (Dev)** (school vendor) |
| `deliverer.demo@example.local` | `Deliverer123!` | student | `/studashboard` | Approved deliverer |

> **Why are business owners and the admin "students"?** In this app the Marketplace is students-only
> (`src/proxy.ts`). Business ownership comes from owning a `Business` row, and admin access is the separate
> `isAdmin` flag, not a role.

---

## E-Learning

All seeded academic data is for **Electrical and Information Engineering → EEE programme → 300 Level**, in the
current session and its current semester (Alpha).

### Student: `student.demo@example.local` / `Student123!`

- **Role:** `student` (EEE, 300 Level, matric `DEV/EEE/0001`)
- **Use it to test:** student dashboard, **E-Learning → My Learning** (7 approved courses, 17 units, with
  lecturers), registration status.
- Course *registration* itself needs an open registration period. See [DAPU](#dapu-dapudemoexamplelocal--dapudemo123).

### Student waiting for the Level Adviser: `student2.demo@example.local` / `Student123!`

- **Role:** `student`. Registration status `PENDING_LEVEL_ADVISOR`.
- **Use it to test:** the student's view of a pending registration. Approve it as `adviser.demo`.

### Student waiting for the HOD: `student3.demo@example.local` / `Student123!`

- **Role:** `student`. Registration status `PENDING_HOD`.
- **Use it to test:** the student's view of a registration awaiting HOD approval. Approve it as `hod.demo`.

### Faculty (lecturer): `faculty.demo@example.local` / `Faculty123!`

- **Role:** `faculty`. Course **coordinator** for all 9 seeded EEE 300-level courses.
- **Use it to test:** faculty dashboard, **My Subjects**, course offering pages, results entry.
- Uploading course materials needs Supabase Storage (see [ENVIRONMENT.md](ENVIRONMENT.md#supabase-storage-e-learning-course-materials)).

### Level Adviser: `adviser.demo@example.local` / `Adviser123!`

- **Role:** `faculty`, with the **Level Adviser** responsibility for EEE 300 Level (a responsibility, not a separate role).
  Also a lecturer on 3 courses.
- **Use it to test:** **Level Adviser → Approvals** (student2's registration is waiting), Registrations.

### HOD: `hod.demo@example.local` / `HodDemo123!`

- **Role:** `hod`, head of **Electrical and Information Engineering**.
- **Use it to test:** HOD dashboard, **Approvals → Course registration** (student3 is waiting), assigning
  lecturers and Level Advisers, reviewing course structures, results approvals.

### DAPU: `dapu.demo@example.local` / `DapuDemo123!`

- **Role:** `dapu` (university-wide academic planning).
- **Use it to test:** course structures (a **published** EEE 300 structure exists), adding courses, timetable,
  **Timeframes**. Open a *course registration* period here, then log in as a student to register courses.

### Roles with no seeded account

`dean`, `vc`, `admin` and `super_admin` exist in the `Role` enum, but they have no functionality yet (placeholder
pages), so no accounts are seeded for them. Marketplace admin access uses the `isAdmin` flag instead (see below).

---

## Marketplace

### Admin: `admin.demo@example.local` / `Admin123!`

- **Role:** `student` with **`isAdmin = true`**.
- **Local development only. This is not the production administrator.**
- **Use it to test:** the **Admin** card on `/studashboard` → `/studashboard/admin`, and in its Marketplace
  section: Businesses (approve, verify, block), Products, Users, Verifications, Reports, Disputes, Fines, School
  Vendor and Vendor Delivery.

### Buyer: `buyer.demo@example.local` / `Buyer123!`

- **Role:** `student`
- **Seeded:** 1 item in the cart (LED Desk Lamp), 2 orders from Plug (Dev): one **accepted and being processed**,
  one **awaiting the seller**. Plus an "Order accepted" notification.
- **Use it to test:** Explore/search, product pages, cart, checkout (needs Paystack test keys), My Orders,
  notifications, the School Vendor storefront and vendor checkout.

### Deliverer: `deliverer.demo@example.local` / `Deliverer123!`

- **Role:** `student`, with an **approved** deliverer profile (student email already verified).
- **Use it to test:** the deliverer dashboard (`/studashboard/marketplace/deliverer`).

## Business test accounts

### Plug (Dev): ordinary business

| | |
|---|---|
| **Account** | `plug.demo@example.local` |
| **Password** | `Plug123!` |
| **Role** | `student` (business owner) |
| **Business** | Plug (Dev): type `BUSINESS`, **approved** and **verified** |
| **Products** | Floral Phone Case, LED Desk Lamp, Campus Hoodie (sizes M / L / XL) |
| **Delivery days** | Monday, Wednesday, Friday |
| **Orders** | 1 accepted (processing), 1 awaiting your accept/reject, both from buyer.demo |

**Use it to test:** business dashboard, product management (incl. variants), accepting/rejecting orders, marking
orders ready, the "New order" notification.

### Campus Bites (Dev): school vendor

| | |
|---|---|
| **Account** | `vendor.demo@example.local` |
| **Password** | `Vendor123!` |
| **Role** | `student` (vendor owner) |
| **Business** | Campus Bites (Dev): type `SCHOOL_VENDOR`, **approved**, category Food, open 17:00–20:00 |
| **Products** | Jollof Rice & Chicken, Fried Rice & Turkey, Snack Pack |
| **Sides** | Fried Plantain, Coleslaw |
| **Capacity** | 10 orders per delivery timeframe (5–6 PM, 6–7 PM, 7–8 PM) |

**Use it to test:** vendor dashboard, products and sides, per-timeframe capacity, pausing/unpausing, vendor orders.

> Business and payout details are fake: no bank accounts or account numbers are seeded, and payment references
> look like `DEV-SEED-ORDER-0001`.

---

## Creating more accounts

The easiest way is to add an entry to [`seed/accounts.ts`](seed/accounts.ts), re-run `npm run db:local:seed`, and
document it here. For staff roles, also add the matching profile in [`seed/e-learning.ts`](seed/e-learning.ts).

Signing up through the UI works too, but on purpose it never grants a staff role:

- **Student:** `/signup` needs an `@stu.cu.edu.ng` address and an emailed OTP. Locally, with no `RESEND_API_KEY`,
  the OTP is printed in the `npm run dev` terminal.
- **Faculty / HOD / DAPU:** `/signup` needs that role's institutional domain, and the account is still created as a
  `student`. Turning it into a real staff account means changing `User.role` (Core database) **and** creating its
  E-Learning profile row, which is exactly what the seed does for you.
