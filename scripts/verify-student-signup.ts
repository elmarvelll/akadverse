// Student sign-up, end to end at the service layer, against BOTH real databases (Main + E-Learning).
// The OTP e-mail sender is replaced with a capture function, so no real e-mail is sent and the code can be read.
// Every record it creates is removed afterwards.
//
// Run: npx tsx --env-file=.env scripts/verify-student-signup.ts

import { prisma as core } from "../src/lib/prisma";
import { elearningDb as db } from "../src/lib/db/elearning";
import { ServiceError } from "../src/lib/service-error";
import { authOptions } from "../src/lib/auth";
import { ACCOUNT_TYPES, isEmailForRole } from "../src/lib/account-domains";
import { getStudentSignupOptions } from "../services/auth/student-signup/get-signup-options";
import { startStudentSignup, type StartStudentSignupInput } from "../services/auth/student-signup/start-student-signup";
import { verifyStudentSignup } from "../services/auth/student-signup/verify-student-signup";
import { resendStudentSignupOtp } from "../services/auth/student-signup/resend-student-signup-otp";
import { createGoogleSignupToken } from "../services/auth/student-signup/google-signup-token";
import { hashOtp } from "../services/auth/student-signup/otp";
import { SIGNUP_OTP_MAX_ATTEMPTS } from "../services/auth/student-signup/config";
import { POST as registerPost } from "../src/app/api/register/route";
import { createStaffProfile } from "../services/auth/staff-signup/create-staff-profile";

let passed = 0, failed = 0;
const ok = (n: string, c: boolean, x = "") => { if (c) passed++; else failed++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${x ? " — " + x : ""}`); };
async function rejects(n: string, status: number, fn: () => Promise<unknown>, msg?: RegExp) {
  try { await fn(); ok(n, false, "was accepted"); } catch (e) { ok(n, e instanceof ServiceError && e.status === status && (!msg || msg.test(e.message)), e instanceof ServiceError ? `${e.status} ${e.message}` : String(e)); }
}

const sent: { to: string; code: string }[] = [];
const capture = async (to: string, code: string) => { sent.push({ to, code }); };
const lastCode = (to: string) => [...sent].reverse().find((s) => s.to === to)!.code;
const tag = `${Date.now() % 1000000}`;
const created = { emails: [] as string[], matrics: [] as string[] };
const tmpEmail = (n: string) => { const e = `zzsu${n}${tag}@stu.cu.edu.ng`; created.emails.push(e); return e; };
const local = (email: string) => email.split("@")[0];
// pretend the resend cooldown / expiry has elapsed (test-only DB edit)
const elapse = (email: string, data: object = {}) => core.pendingSignup.update({ where: { email }, data: { otpLastSentAt: new Date(Date.now() - 120_000), ...data } });

async function main() {
  const opts = await getStudentSignupOptions();
  const college = opts.colleges[0], dept = opts.departments[0], prog = opts.programmes[0];
  const base = (n: string): StartStudentSignupInput => ({
    firstName: "Test", lastName: "Student", localPart: local(tmpEmail(n)), password: "correct-horse-1", matricNumber: `ZZ/${tag}/${n.toUpperCase()}`,
    collegeId: college.id, departmentId: dept.id, programmeId: prog.id, level: 300,
  });
  const matricOf = (n: string) => `ZZ/${tag}/${n.toUpperCase()}`; // matric numbers are stored upper-case
  created.matrics.push(...["a", "b", "c", "d", "f", "g", "h"].map(matricOf));

  try {
    // ---- 1. dropdown data + role -> domain -----------------------------------------------------------------------------
    ok("College dropdown has exactly the testing college (CoE)", opts.colleges.length === 1 && opts.colleges[0].code === "CoE" && /engineering/i.test(opts.colleges[0].name));
    ok("Department dropdown is 'Electrical and Information Engineering' only", opts.departments.length === 1 && opts.departments[0].name === "Electrical and Information Engineering");
    ok("Programme dropdown is 'Electrical and Electronics Engineering' only (a PROGRAMME, not the department)", opts.programmes.length === 1 && opts.programmes[0].name === "Electrical and Electronics Engineering" && prog.departmentId === dept.id);
    ok("Level dropdown is 300 Level only", opts.levels.length === 1 && opts.levels[0].value === 300 && opts.levels[0].label === "300 Level");
    ok("Student domain is stu.cu.edu.ng", opts.studentDomain === "stu.cu.edu.ng");
    ok("Role list is Student/Faculty/HOD/DAPU — no VC, no Dean", ACCOUNT_TYPES.map((a) => a.role).join() === "student,faculty,hod,dapu");
    ok("faculty/hod/dapu domains are the existing ones (from account-domains, not invented)", ACCOUNT_TYPES.map((a) => a.domain).join() === "stu.cu.edu.ng,faculty.cu.edu.ng,HODEIE.cu.stu.ng,DAPU.cu.edu.ng");
    ok("domain check accepts @stu.cu.edu.ng for Student", isEmailForRole("a1@stu.cu.edu.ng", "student"));
    ok("domain check rejects gmail / yahoo / wrong domain / other role's domain for Student", !["a@gmail.com", "a@yahoo.com", "a@wrongdomain.com", "a@faculty.cu.edu.ng", "a@stu.cu.edu.ng.evil.com"].some((e) => isEmailForRole(e, "student")));

    // ---- 2. server-side validation (never trust the browser) ---------------------------------------------------------------
    await rejects("a typed '@gmail.com' can't sneak in through the local part", 400, () => startStudentSignup({ ...base("a"), localPart: "someone@gmail.com" }, capture));
    await rejects("empty local part rejected", 400, () => startStudentSignup({ ...base("a"), localPart: "" }, capture));
    await rejects("password shorter than 8 rejected", 400, () => startStudentSignup({ ...base("a"), password: "short" }, capture));
    await rejects("missing matric number rejected", 400, () => startStudentSignup({ ...base("a"), matricNumber: "  " }, capture));
    await rejects("unsafe matric characters rejected", 400, () => startStudentSignup({ ...base("a"), matricNumber: "<script>" }, capture));
    await rejects("unknown college id rejected", 400, () => startStudentSignup({ ...base("a"), collegeId: "nope" }, capture));
    const otherDept = await db.department.findFirstOrThrow({ where: { id: { not: dept.id } } });
    await rejects("department outside the College/scope rejected", 400, () => startStudentSignup({ ...base("a"), departmentId: otherDept.id }, capture));
    const otherCollege = await db.college.findFirstOrThrow({ where: { id: { not: college.id } } });
    await rejects("department that doesn't belong to the chosen college rejected", 400, () => startStudentSignup({ ...base("a"), collegeId: otherCollege.id }, capture), /doesn't belong|isn't open/);
    const otherProg = await db.programme.findFirstOrThrow({ where: { id: { not: prog.id } } });
    await rejects("programme outside the testing scope rejected", 400, () => startStudentSignup({ ...base("a"), programmeId: otherProg.id }, capture), /isn't open/);
    await rejects("level 400 rejected (only 300 is open)", 400, () => startStudentSignup({ ...base("a"), level: 400 }, capture));
    await rejects("a forged Google token is rejected", 400, () => startStudentSignup({ ...base("a"), googleToken: "not-a-real-token" }, capture));
    const gmailToken = await createGoogleSignupToken({ email: "someone@gmail.com", firstName: "G", lastName: "User" });
    await rejects("a validly-signed Google token for a non-student domain is still rejected", 400, () => startStudentSignup({ ...base("a"), googleToken: gmailToken }, capture), /student email/);
    ok("nothing was written by any rejected attempt", (await core.pendingSignup.count({ where: { email: { contains: tag } } })) === 0);

    // ---- 3. OTP: send, wrong code, attempts, expiry, cooldown, resend, reuse ---------------------------------------------------
    const a = base("a");
    const emailA = `${a.localPart}@stu.cu.edu.ng`;
    const r1 = await startStudentSignup(a, capture);
    ok("start returns the pending id + the server-built email, and NO code", r1.email === emailA && r1.mode === "create" && !JSON.stringify(r1).match(/\b\d{6}\b/) && sent.length === 1 && /^\d{6}$/.test(lastCode(emailA)));
    const pendingRow = await core.pendingSignup.findUniqueOrThrow({ where: { email: emailA } });
    ok("only a HASH of the OTP is stored (not the code), and the password is a bcrypt hash", pendingRow.otpHash !== lastCode(emailA) && pendingRow.otpHash.length === 64 && !!pendingRow.passwordHash && pendingRow.passwordHash.startsWith("$2") && !JSON.stringify(pendingRow).includes(a.password!));
    ok("no User and no StudentProfile exist before the OTP is verified", !(await core.user.findUnique({ where: { email: emailA } })));
    await rejects("a second request inside the cooldown is refused", 429, () => startStudentSignup(a, capture), /wait/);
    await rejects("resend inside the cooldown is refused", 429, () => resendStudentSignupOtp(r1.pendingId, capture), /wait/);
    const real1 = lastCode(emailA);
    const wrong = real1 === "000000" ? "111111" : "000000";
    await rejects("wrong code fails and reports tries left", 400, () => verifyStudentSignup(r1.pendingId, wrong), /tries left/);
    await rejects("a non-6-digit code is rejected", 400, () => verifyStudentSignup(r1.pendingId, "12ab"));
    for (let i = 0; i < SIGNUP_OTP_MAX_ATTEMPTS - 1; i++) await verifyStudentSignup(r1.pendingId, wrong).catch(() => {});
    await rejects("after the max wrong attempts even the CORRECT code is refused", 429, () => verifyStudentSignup(r1.pendingId, real1));
    await elapse(emailA);
    await resendStudentSignupOtp(r1.pendingId, capture);
    const real2 = lastCode(emailA);
    ok("resend issued a new code and reset the attempts", (await core.pendingSignup.findUniqueOrThrow({ where: { email: emailA } })).otpAttempts === 0 && sent.filter((s) => s.to === emailA).length === 2);
    if (real2 !== real1) await rejects("the previous OTP no longer works after a resend", 400, () => verifyStudentSignup(r1.pendingId, real1));
    await core.pendingSignup.update({ where: { email: emailA }, data: { otpExpiresAt: new Date(Date.now() - 1000) } });
    await rejects("an expired OTP fails", 400, () => verifyStudentSignup(r1.pendingId, real2), /expired/);
    await elapse(emailA);
    await resendStudentSignupOtp(r1.pendingId, capture);
    const real3 = lastCode(emailA);

    // ---- 4. success: Main User + E-Learning StudentProfile, correctly linked ---------------------------------------------------
    const done = await verifyStudentSignup(r1.pendingId, real3);
    const user = await core.user.findUniqueOrThrow({ where: { email: emailA } });
    const profile = await db.studentProfile.findUniqueOrThrow({ where: { userId: user.id } });
    ok("Main DB: exactly one User, role student, password is a hash", (await core.user.count({ where: { email: emailA } })) === 1 && user.role === "student" && user.password.startsWith("$2") && user.firstName === "Test");
    ok("E-Learning DB: exactly one StudentProfile with userId === Main User.id", (await db.studentProfile.count({ where: { userId: user.id } })) === 1 && profile.userId === user.id && done.userId === user.id);
    ok("profile has the right department, programme, level and matric number", profile.departmentId === dept.id && profile.programmeId === prog.id && profile.level === 300 && profile.matricNumber === matricOf("a"));
    const reference = await db.studentProfile.findUniqueOrThrow({ where: { userId: (await core.user.findUniqueOrThrow({ where: { email: "marvelousifezue31@stu.cu.edu.ng" } })).id } });
    ok("same structure as the manually-created student (dept, programme, level, admission session)", reference.departmentId === profile.departmentId && reference.programmeId === profile.programmeId && reference.level === profile.level && reference.admissionSessionId === profile.admissionSessionId);
    const deptRow = await db.department.findUniqueOrThrow({ where: { id: profile.departmentId } });
    ok("College -> Department -> Programme chain holds for the new student", deptRow.collegeId === college.id && (await db.programme.findUniqueOrThrow({ where: { id: profile.programmeId! } })).departmentId === deptRow.id);
    ok("the pending record was removed", !(await core.pendingSignup.findUnique({ where: { email: emailA } })));
    await rejects("the OTP can't be reused (sign-up already consumed)", 404, () => verifyStudentSignup(r1.pendingId, real3));
    ok("password login would work: bcrypt hash matches the chosen password", await (await import("bcryptjs")).compare(a.password!, user.password));

    // ---- 5. duplicates ------------------------------------------------------------------------------------------------
    await rejects("same email again -> 'already registered', no second User", 409, () => startStudentSignup(a, capture), /already registered/);
    const dupMatric = base("b"); dupMatric.matricNumber = matricOf("a");
    await rejects("same matric number under another email is refused", 409, () => startStudentSignup(dupMatric, capture), /matric/);
    ok("still exactly one User for that email", (await core.user.count({ where: { email: emailA } })) === 1);
    const fac = base("f");
    const emailF = `${fac.localPart}@stu.cu.edu.ng`;
    await core.user.create({ data: { firstName: "Fac", lastName: "Ulty", email: emailF, password: "$2a$10$x", role: "faculty" } });
    await rejects("an existing account with a NON-student role can't be taken over", 409, () => startStudentSignup(fac, capture));
    ok("…and its role/data are untouched, nothing pending was created", (await core.user.findUniqueOrThrow({ where: { email: emailF } })).role === "faculty" && !(await core.pendingSignup.findUnique({ where: { email: emailF } })));

    // ---- 6. existing older account with no profile: link, don't duplicate --------------------------------------------------
    const b = base("b");
    const emailB = `${b.localPart}@stu.cu.edu.ng`;
    const oldUser = await core.user.create({ data: { firstName: "Old", lastName: "Account", email: emailB, password: "$2a$10$existinghashexistinghashexistinghashexistinghashexistin" } });
    const rb = await startStudentSignup(b, capture);
    ok("an existing account with no student profile goes through 'link' mode", rb.mode === "link");
    await verifyStudentSignup(rb.pendingId, lastCode(emailB));
    const afterB = await core.user.findMany({ where: { email: emailB } });
    ok("no second User was created and the existing password was NOT changed", afterB.length === 1 && afterB[0].id === oldUser.id && afterB[0].password === oldUser.password);
    ok("the student profile was attached to the EXISTING user id", (await db.studentProfile.findUnique({ where: { userId: oldUser.id } }))?.matricNumber === matricOf("b"));

    // ---- 7. two-database failure handling ------------------------------------------------------------------------------------
    const c = base("c");
    const emailC = `${c.localPart}@stu.cu.edu.ng`;
    const rc = await startStudentSignup(c, capture);
    // Between "send code" and "verify", someone else takes this matric number in the E-Learning DB -> the profile write fails.
    const thief = await db.studentProfile.create({ data: { userId: `zz-thief-${tag}`, departmentId: dept.id, programmeId: prog.id, level: 300, matricNumber: matricOf("c"), admissionSessionId: reference.admissionSessionId } });
    await rejects("profile write fails -> the sign-up reports the conflict", 409, () => verifyStudentSignup(rc.pendingId, lastCode(emailC)), /matric/);
    ok("the User created for it was rolled back (no orphan in the Main DB)", !(await core.user.findUnique({ where: { email: emailC } })));
    ok("the pending sign-up and its OTP are still usable for a retry", (await core.pendingSignup.findUniqueOrThrow({ where: { email: emailC } })).otpHash.length === 64);
    await db.studentProfile.delete({ where: { id: thief.id } });
    await verifyStudentSignup(rc.pendingId, lastCode(emailC));
    ok("retry with the same code succeeds and creates exactly one User + one profile", (await core.user.count({ where: { email: emailC } })) === 1 && !!(await db.studentProfile.findUnique({ where: { matricNumber: matricOf("c") } })));

    // ---- 8. Google -----------------------------------------------------------------------------------------------------------
    const signIn = authOptions.callbacks!.signIn!;
    const g = (email: string, verified = true) => signIn({ user: { id: "x", email, name: "Goo Gle" }, account: { provider: "google", type: "oauth", providerAccountId: "1" }, profile: { email_verified: verified } as never } as never);
    const before = await core.user.count();
    ok("new Google user with a Gmail address is refused (no user created)", (await g(`zz${tag}@gmail.com`)) === "/signup?error=google_domain" && (await core.user.count()) === before);
    ok("new Google user on an unrelated domain is refused", (await g(`zz${tag}@wrongdomain.com`)) === "/signup?error=google_domain");
    ok("Google says the email isn't verified -> refused", (await g(`zz${tag}@stu.cu.edu.ng`, false)) === "/signup?error=google_unverified");
    const dEmail = tmpEmail("d");
    const redirect = (await g(dEmail)) as string;
    ok("new institutional Google student is sent to sign-up (with a signed token) — NOT auto-created", redirect.startsWith("/signup?google=") && !(await core.user.findUnique({ where: { email: dEmail } })));
    const gToken = decodeURIComponent(redirect.split("google=")[1]);
    const gr = await startStudentSignup({ ...base("d"), localPart: undefined, password: undefined, googleToken: gToken, firstName: "", lastName: "" }, capture);
    ok("Google sign-up still requires the OTP (sent to the institutional email)", gr.email === dEmail && sent.some((s) => s.to === dEmail));
    await verifyStudentSignup(gr.pendingId, lastCode(dEmail));
    const gUser = await core.user.findUniqueOrThrow({ where: { email: dEmail } });
    ok("after OTP: one User (no password) + one linked StudentProfile", gUser.password === "" && gUser.firstName === "Goo" && !!(await db.studentProfile.findUnique({ where: { userId: gUser.id } })));
    ok("the returning Google user signs in with NO further OTP (callback returns true)", (await g(dEmail)) === true);
    ok("an existing pre-flow account (the retained Gmail admin) can still sign in with Google", (await g("marvelousifezue31@gmail.com")) === true);

    // ---- 9. the old register endpoint can't be used to bypass the flow ----------------------------------------------------------
    const reg = (email: string) => registerPost(new Request("http://x/api/register", { method: "POST", body: JSON.stringify({ firstName: "A", lastName: "B", email, password: "longenough1" }) }) as never);
    ok("/api/register refuses a student-domain email (must use the verified sign-up)", (await reg(`zz${tag}@stu.cu.edu.ng`)).status === 400);
    ok("/api/register refuses Gmail / unrelated domains", (await reg(`zz${tag}@gmail.com`)).status === 400 && (await reg(`zz${tag}@x.com`)).status === 400);
    ok("…and created nothing", !(await core.user.findUnique({ where: { email: `zz${tag}@stu.cu.edu.ng` } })));

    // ---- 9b. Faculty / HOD sign-up: College + Department ----------------------------------------------------------------------
    const staffReg = (role: "faculty" | "hod" | "dapu", n: string, extra: object = {}) =>
      registerPost(new Request("http://x/api/register", { method: "POST", body: JSON.stringify({ firstName: "Staff", lastName: "Member", email: `zzstaff${n}${tag}@${role === "faculty" ? "faculty.cu.edu.ng" : role === "hod" ? "hodeie.cu.stu.ng" : "dapu.cu.edu.ng"}`, password: "longenough1", ...extra }) }) as never);
    const hodsBefore = await db.hodProfile.count(), facBefore = await db.facultyProfile.count();
    ok("Faculty sign-up without college/department is refused", (await staffReg("faculty", "1")).status === 400);
    ok("HOD sign-up without college/department is refused", (await staffReg("hod", "1")).status === 400);
    ok("a department that isn't in the chosen college is refused", (await staffReg("faculty", "2", { collegeId: otherCollege.id, departmentId: dept.id })).status === 400);
    ok("a department outside the testing scope is refused", (await staffReg("faculty", "3", { collegeId: (await db.college.findFirstOrThrow({ where: { id: otherDept.collegeId } })).id, departmentId: otherDept.id })).status === 400);
    const goodStaff = { collegeId: college.id, departmentId: dept.id };
    const rf = await staffReg("faculty", "4", goodStaff);
    const rh = await staffReg("hod", "5", goodStaff);
    ok("valid Faculty and HOD sign-ups (with college + department) are accepted", rf.status === 201 && rh.status === 201);
    const fu = await core.user.findUniqueOrThrow({ where: { email: `zzstaff4${tag}@faculty.cu.edu.ng` } });
    const hu = await core.user.findUniqueOrThrow({ where: { email: `zzstaff5${tag}@hodeie.cu.stu.ng` } });
    ok("choosing 'Faculty'/'HOD' grants NO role: both accounts are plain students", fu.role === "student" && hu.role === "student");
    ok("…and no staff profile was created, so nobody can claim a department's HOD slot by signing up", (await db.hodProfile.count()) === hodsBefore && (await db.facultyProfile.count()) === facBefore);
    ok("DAPU sign-up needs no college/department (university-wide)", (await staffReg("dapu", "6")).status === 201);
    ok("a Gmail address can no longer register through the old endpoint", (await staffReg("faculty", "7", { ...goodStaff, email: `zzstaff7${tag}@gmail.com` })).status === 400);
    // profile creation for an account whose role really is faculty / hod
    const staffUser = await core.user.create({ data: { firstName: "P", lastName: "Q", email: `zzstaff8${tag}@faculty.cu.edu.ng`, password: "x", role: "faculty" } });
    await createStaffProfile(staffUser.id, "faculty", dept.id);
    const fp = await db.facultyProfile.findUnique({ where: { userId: staffUser.id } });
    ok("a real faculty account gets a FacultyProfile in the chosen department, keyed by User.id", fp?.departmentId === dept.id);
    await rejects("a second HOD for a department that already has one is refused (no profile written)", 409, () => createStaffProfile(staffUser.id, "hod", dept.id), /already has a HOD/);
    ok("…and the existing HOD is untouched", (await db.hodProfile.count()) === hodsBefore);

    // ---- 9c. abuse circuit breaker on the public start endpoint -----------------------------------------------------------------
    const floodRows = Array.from({ length: 500 }, (_, i) => ({ email: `zzflood${i}${tag}@stu.cu.edu.ng`, authMethod: "credentials", firstName: "F", lastName: "L", payload: {}, otpHash: "x", otpExpiresAt: new Date(Date.now() + 60000), otpLastSentAt: new Date() }));
    await core.pendingSignup.createMany({ data: floodRows });
    await rejects("a brand-new sign-up is refused once the site-wide 15-minute cap is reached (no e-mail sent)", 429, () => startStudentSignup(base("h"), capture), /very busy/);
    await core.pendingSignup.deleteMany({ where: { email: { startsWith: "zzflood" } } });
    const okAfter = await startStudentSignup({ ...base("g") }, capture).then(() => true, () => false);
    ok("…and sign-up works again as soon as the flood is gone", okAfter);
    await core.pendingSignup.deleteMany({ where: { email: { contains: tag } } });

    // ---- 10. nothing leaked ---------------------------------------------------------------------------------------------------
    ok("hashOtp is bound to the email (same code, different email -> different hash)", hashOtp("123456", "a@stu.cu.edu.ng") !== hashOtp("123456", "b@stu.cu.edu.ng"));
  } finally {
    const users = await core.user.findMany({ where: { email: { in: created.emails } }, select: { id: true } });
    await db.studentProfile.deleteMany({ where: { OR: [{ userId: { in: users.map((u) => u.id) } }, { matricNumber: { in: created.matrics } }, { userId: { startsWith: "zz-thief-" } }] } });
    const staff = await core.user.findMany({ where: { email: { startsWith: "zzstaff" } }, select: { id: true } });
    await db.facultyProfile.deleteMany({ where: { userId: { in: staff.map((u) => u.id) } } });
    await core.user.deleteMany({ where: { OR: [{ email: { in: created.emails } }, { email: { startsWith: "zzstaff" } }] } });
    await core.pendingSignup.deleteMany({ where: { email: { contains: tag } } });
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  await db.$disconnect(); await core.$disconnect();
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
