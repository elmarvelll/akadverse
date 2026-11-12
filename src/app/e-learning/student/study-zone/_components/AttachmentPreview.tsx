"use client";

import { useEffect, useRef } from "react";
import { FileText } from "lucide-react";

export default function FilePreview({ file }: { file: File }) {
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (!/\.(png|jpe?g|webp)$/i.test(file.name)) return;
    const objectUrl = URL.createObjectURL(file);
    if (imageRef.current) imageRef.current.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  // eslint-disable-next-line @next/next/no-img-element -- local, temporary attachment preview
  return /\.(png|jpe?g|webp)$/i.test(file.name) ? <img ref={imageRef} alt={`Preview of ${file.name}`} className="h-10 w-12 rounded object-contain" /> : <FileText size={16} className="shrink-0" aria-hidden />;
}
