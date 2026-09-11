// services/marketplace/uploads/upload.service.ts
//
// Image upload (business logo / product image) via Cloudinary. Validation
// lives here so it's consistent regardless of which form triggers it. See
// src/lib/external/cloudinary.ts for the actual API call.

import { uploadImage, type CloudinaryUploadResult } from "@/lib/external/cloudinary";
import { badRequest, badGateway } from "@/lib/service-error";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

export async function uploadMarketplaceImage(file: File): Promise<CloudinaryUploadResult> {
  if (!file.type.startsWith("image/")) throw badRequest("Only image files are supported.");
  if (file.size > MAX_FILE_BYTES) throw badRequest("Image must be 5MB or smaller.");

  const buffer = Buffer.from(await file.arrayBuffer());
  const dataUri = `data:${file.type};base64,${buffer.toString("base64")}`;

  try {
    return await uploadImage(dataUri);
  } catch (err) {
    console.error("[upload.service] uploadMarketplaceImage failed", {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      error: err,
    });
    throw badGateway("Image upload failed. Please try again.");
  }
}
