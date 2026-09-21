// services/e-learning/faculty/materials/upload-material.ts
//
// Lecturer upload, in two server steps so large files never pass through a serverless function:
//   1. requestUpload  - authorize the lecturer for THAT offering, validate type / week range / file metadata, issue a
//                       one-time signed upload URL (browser -> Supabase).
//   2. confirmUpload  - re-authorize, ask Storage for the object's REAL size (8 MB re-check; oversize is deleted), then
//                       create the database record. If that write fails the uploaded object is removed.
// One CourseMaterial row covers a whole week range (startWeek..endWeek).

import { randomUUID } from "node:crypto";
import { elearningDb } from "@/lib/db/elearning";
import { badRequest, conflict, forbidden } from "@/lib/service-error";
import { CANONICAL_MIME, MATERIAL_TYPES, MAX_MATERIAL_BYTES, MAX_MATERIAL_MB, checkFileMeta, extensionOf, safeFileName, weeksInSemester, type MaterialType } from "@/lib/course-materials/config";
import { createSignedUploadUrl, getObjectSize, removeObject } from "@/lib/storage/supabase-storage";
import { BUCKET, slug, loadOffering, requireLecturer } from "@/services/e-learning/shared/course-materials/offering-access";

export interface UploadMeta {
  courseOfferingId: string;
  type: string;
  title: string;
  description?: string | null;
  startWeek: number;
  endWeek: number;
  fileName: string;
  size: number;
  // The type the browser reports for the file; checked against the extension (and again by the bucket's allow-list).
  mimeType?: string;
}

function validate(meta: UploadMeta, totalWeeks: number) {
  if (!(MATERIAL_TYPES as readonly string[]).includes(meta.type)) throw badRequest("Choose a material type: Notes, Assignment or Quiz.");
  const title = meta.title.trim();
  if (!title) throw badRequest("Give the material a title.");
  if (title.length > 200) throw badRequest("The title is too long (200 characters at most).");
  if ((meta.description ?? "").length > 2000) throw badRequest("The description is too long (2000 characters at most).");
  if (!Number.isInteger(meta.startWeek) || !Number.isInteger(meta.endWeek)) throw badRequest("Choose valid weeks.");
  if (meta.startWeek < 1 || meta.endWeek > totalWeeks) throw badRequest(`Weeks must be between 1 and ${totalWeeks} for this semester.`);
  if (meta.endWeek < meta.startWeek) throw badRequest("The last week can't be before the first week.");
  const fileError = checkFileMeta(meta.fileName, meta.size, meta.mimeType);
  if (fileError) throw badRequest(fileError);
  return title;
}

export async function requestUpload(facultyUserId: string, meta: UploadMeta) {
  await requireLecturer(facultyUserId, meta.courseOfferingId);
  const o = await loadOffering(meta.courseOfferingId);
  const { curriculum } = o.curriculumCourse;
  validate(meta, weeksInSemester(curriculum.semester.startDate, curriculum.semester.endDate));
  const folder = `${slug(curriculum.academicSession.name)}/${slug(curriculum.semester.name)}/${o.id}`;
  const path = `${folder}/${randomUUID()}-${safeFileName(meta.fileName)}`;
  const { uploadUrl } = await createSignedUploadUrl(BUCKET(), path);
  return { uploadUrl, path, maxBytes: MAX_MATERIAL_BYTES };
}

export async function confirmUpload(facultyUserId: string, meta: UploadMeta & { path: string }) {
  await requireLecturer(facultyUserId, meta.courseOfferingId);
  const o = await loadOffering(meta.courseOfferingId);
  const { curriculum } = o.curriculumCourse;
  const title = validate(meta, weeksInSemester(curriculum.semester.startDate, curriculum.semester.endDate));

  // The object must be inside THIS offering's own folder — a path can't be pointed at someone else's file.
  const folder = `${slug(curriculum.academicSession.name)}/${slug(curriculum.semester.name)}/${o.id}/`;
  if (!meta.path.startsWith(folder) || meta.path.includes("..")) throw forbidden("That file doesn't belong to this course.");

  const actual = await getObjectSize(BUCKET(), meta.path);
  if (actual === null) throw badRequest("The upload didn't arrive. Please try again.");
  if (actual > MAX_MATERIAL_BYTES || actual <= 0) {
    await removeObject(BUCKET(), meta.path).catch(() => {}); // never keep an oversize/empty object
    throw badRequest(`That file is too large. The maximum is ${MAX_MATERIAL_MB} MB per file.`);
  }

  try {
    return await elearningDb.courseMaterial.create({
      data: {
        courseOfferingId: o.id,
        uploadedByFacultyUserId: facultyUserId,
        title,
        description: meta.description?.trim() || null,
        type: meta.type as MaterialType,
        startWeek: meta.startWeek,
        endWeek: meta.endWeek,
        fileName: safeFileName(meta.fileName),
        mimeType: CANONICAL_MIME[extensionOf(meta.fileName)],
        fileSize: actual,
        storageBucket: BUCKET(),
        storagePath: meta.path,
      },
    });
  } catch (e) {
    // The record couldn't be saved: remove the uploaded object so nothing is left unmanaged.
    await removeObject(BUCKET(), meta.path).catch(() => {});
    if ((e as { code?: string }).code === "P2002") throw conflict("That upload was already saved.");
    throw e;
  }
}

