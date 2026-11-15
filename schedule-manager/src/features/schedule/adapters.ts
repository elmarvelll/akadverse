import type { AcademicProvider, IdentityProvider } from "./domain.ts";
import type { OfficialClass } from "./domain.ts";

export interface PortalClient {
  getRegisteredCourses(studentId: string): Promise<{ registrationId: string; courseId: string; state: "registered" | "dropped" }[]>;
  getTimetableSessions(courseIds: string[], date: string): Promise<(OfficialClass & { courseId: string })[]>;
}
export class PortalAcademicProvider implements AcademicProvider {
  constructor(private client: PortalClient) {}
  async getClassSessions(studentId: string, date: string): Promise<OfficialClass[]> {
    const registrations = (await this.client.getRegisteredCourses(studentId)).filter(r => r.state === "registered");
    if (!registrations.length) return [];
    const sessions = await this.client.getTimetableSessions([...new Set(registrations.map(r => r.courseId))], date);
    const seen = new Set<string>();
    return sessions.flatMap(session => {
      const registration = registrations.find(r => r.courseId === session.courseId && r.registrationId === session.registrationId);
      if (!registration || session.slot.date !== date || session.state === "cancelled" || seen.has(session.sourceId)) return [];
      seen.add(session.sourceId);
      return [{ ...session, registrationState: "registered" as const }];
    });
  }
}

export const developmentIdentity: IdentityProvider = {
  async getCurrentStudent() {
    return {
      id: "development-student",
      name: "Development student",
      timezone: "Africa/Lagos",
      development: true,
    };
  },
};
// Sample registration and timetable records are intentionally separate concepts.
// Replace this provider with the portal registration/timetable API, retaining source IDs.
export const sampleAcademics: AcademicProvider = {
  async getClassSessions(studentId, date) {
    if (studentId !== "development-student") return [];
    const weekday = new Date(date + "T12:00:00Z").getUTCDay();
    if (weekday === 0 || weekday === 6) return [];
    return [
      {
        id: "official:sample-csc201:" + date,
        sourceId: "sample-timetable:csc201:" + date,
        registrationId: "sample-registration:csc201",
        courseCode: "CSC 201",
        courseName: "Data Structures",
        lecturer: "Dr. A. Bello",
        venue: "Science Block · Room 204",
        semester: "Sample semester",
        classGroup: "Group A",
        slot: { date, start: "09:00", end: "10:30", timezone: "Africa/Lagos" },
        state: "scheduled",
        registrationState: "registered",
      },
    ];
  },
};
