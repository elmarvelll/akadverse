// Creates (or updates) the PRIVATE Supabase Storage bucket for course materials, with the 8 MB
// per-file limit enforced by Storage itself. Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
//   npm run storage:setup
import { CANONICAL_MIME } from "../src/lib/course-materials/config";
import { ensureBucket } from "../src/lib/storage/supabase-storage";
import { MAX_MATERIAL_BYTES } from "../src/lib/course-materials/config";

const bucket = process.env.SUPABASE_COURSE_MATERIALS_BUCKET ?? "Akadverdse documents";
ensureBucket(bucket, MAX_MATERIAL_BYTES, Object.values(CANONICAL_MIME))
  .then((r) => console.log(`Bucket "${bucket}" ${r} (private, ${MAX_MATERIAL_BYTES} bytes per file).`))
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
