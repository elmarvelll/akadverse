// services/e-learning/student/signup-academics.ts
//
// The academic side of student sign-up, read from the E-Learning database:
//   - getSignupOptions()        what the College / Department / Programme / Level dropdowns offer
//   - resolveAcademicSelection() re-validates a submitted selection against the database
//   - createStudentProfile()    writes the StudentProfile (Student.userId = the Main DB User.id)
//
// TESTING PHASE: sign-up is deliberately limited to one dataset (below). It is a list of stable CODES, not database
// IDs — IDs are always looked up from the database, never hard-coded, and never trusted from the browser. To open
// sign-up to more colleges/departments/programmes/levels later, add their codes (or set the list to null = all).

import { elearningDb } from "@/lib/db/elearning";
import { badRequest, conflict } from "@/lib/service-error";

export const SIGNUP_SCOPE = {
  collegeCodes: ["CoE"] as string[] | null, // College of Engineering
  departmentCodes: ["EIENG"] as string[] | null, // Electrical and Information Engineering
  programmeCodes: ["EEE"] as string[] | null, // Electrical and Electronics Engineering
  levels: [300] as number[],
};

const inScope = (list: string[] | null, code: string) => !list || list.includes(code);

export async function getSignupOptions() {
  const colleges = await elearningDb.college.findMany({ orderBy: { name: "asc" } });
  const departments = await elearningDb.department.findMany({ orderBy: { name: "asc" } });
  const programmes = await elearningDb.programme.findMany({ orderBy: { name: "asc" } });

  const okColleges = colleges.filter((c) => inScope(SIGNUP_SCOPE.collegeCodes, c.code));
  const collegeIds = new Set(okColleges.map((c) => c.id));
  const okDepartments = departments.filter((d) => collegeIds.has(d.collegeId) && inScope(SIGNUP_SCOPE.departmentCodes, d.code));
  const departmentIds = new Set(okDepartments.map((d) => d.id));
  const okProgrammes = programmes.filter((p) => departmentIds.has(p.departmentId) && inScope(SIGNUP_SCOPE.programmeCodes, p.code));

  return {
    colleges: okColleges.map((c) => ({ id: c.id, code: c.code, name: c.name })),
    departments: okDepartments.map((d) => ({ id: d.id, collegeId: d.collegeId, name: d.name })),
    programmes: okProgrammes.map((p) => ({ id: p.id, departmentId: p.departmentId, code: p.code, name: p.name })),
    levels: SIGNUP_SCOPE.levels.map((level) => ({ value: level, label: `${level} Level` })),
  };
}

export interface AcademicSelection {
  collegeId: string;
  departmentId: string;
  programmeId: string;
  level: number;
}

// Every id comes from the browser, so each link of College -> Department -> Programme is re-checked against the
// database, and the whole selection must be inside the sign-up scope.
export async function resolveAcademicSelection(sel: AcademicSelection) {
  const [college, department, programme] = await Promise.all([
    elearningDb.college.findUnique({ where: { id: String(sel.collegeId) } }),
    elearningDb.department.findUnique({ where: { id: String(sel.departmentId) } }),
    elearningDb.programme.findUnique({ where: { id: String(sel.programmeId) } }),
  ]);
  if (!college || !department || !programme) throw badRequest("Choose a valid college, department and programme.");
  if (department.collegeId !== college.id) throw badRequest("That department doesn't belong to the selected college.");
  if (programme.departmentId !== department.id) throw badRequest("That programme doesn't belong to the selected department.");
  if (!inScope(SIGNUP_SCOPE.collegeCodes, college.code) || !inScope(SIGNUP_SCOPE.departmentCodes, department.code) || !inScope(SIGNUP_SCOPE.programmeCodes, programme.code)) {
    throw badRequest("Sign-up isn't open for that college, department or programme yet.");
  }
  if (!Number.isInteger(sel.level) || !SIGNUP_SCOPE.levels.includes(sel.level)) throw badRequest("Sign-up isn't open for that level yet.");
  return { college, department, programme, level: sel.level };
}

// Faculty and HOD sign-up choose only a College and a Department (no programme/level). Same rules: ids are re-checked
// against the database, the department must belong to the college, and both must be inside the sign-up scope.
export async function resolveDepartmentSelection(sel: { collegeId: string; departmentId: string }) {
  const [college, department] = await Promise.all([
    elearningDb.college.findUnique({ where: { id: String(sel.collegeId) } }),
    elearningDb.department.findUnique({ where: { id: String(sel.departmentId) } }),
  ]);
  if (!college || !department) throw badRequest("Choose a valid college and department.");
  if (department.collegeId !== college.id) throw badRequest("That department doesn't belong to the selected college.");
  if (!inScope(SIGNUP_SCOPE.collegeCodes, college.code) || !inScope(SIGNUP_SCOPE.departmentCodes, department.code)) {
    throw badRequest("Sign-up isn't open for that college or department yet.");
  }
  return { college, department };
}

// The student's matric number is optional in the schema (existing rows have none) and has no format the schema
// enforces, so no format is invented here — only that it is non-empty, a sensible length and made of safe characters.
export function normalizeMatricNumber(raw: string): string {
  const matric = String(raw ?? "").trim().toUpperCase();
  if (!matric) throw badRequest("Enter your matric number.");
  if (matric.length > 30 || !/^[A-Z0-9][A-Z0-9/._-]*$/.test(matric)) throw badRequest("That matric number contains characters that aren't allowed.");
  return matric;
}

export async function assertMatricAvailable(matricNumber: string, exceptUserId?: string) {
  const owner = await elearningDb.studentProfile.findUnique({ where: { matricNumber } });
  if (owner && owner.userId !== exceptUserId) throw conflict("A student with that matric number is already registered.");
}

// Creates the E-Learning student profile for a Main DB user. `userId` IS the bridge: StudentProfile.userId = User.id
// (no second user is ever created). admissionSessionId is required by the schema; the only session that exists is
// the current one (the manually created student uses it too), so that is what is recorded.
export async function createStudentProfile(userId: string, sel: AcademicSelection, matricNumber: string) {
  const { department, programme, level } = await resolveAcademicSelection(sel);
  const session = await elearningDb.academicSession.findFirst({ where: { isCurrent: true } });
  if (!session) throw badRequest("The academic session isn't set up yet. Please try again later.");
  try {
    return await elearningDb.studentProfile.create({
      data: { userId, departmentId: department.id, programmeId: programme.id, level, matricNumber, admissionSessionId: session.id },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw conflict("A student profile already exists for this account or matric number.");
    throw e;
  }
}
