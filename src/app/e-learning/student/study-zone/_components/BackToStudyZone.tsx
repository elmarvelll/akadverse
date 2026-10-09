// "Back to Study Zone" as a button-style control (icon-only below `sm`, where the label would crowd the course title).

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function BackToStudyZone() {
  return (
    <Link
      href="/e-learning/student/study-zone"
      aria-label="Back to Study Zone"
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-sm font-semibold text-gray-800 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 active:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:px-3"
    >
      <ArrowLeft size={16} aria-hidden />
      <span className="hidden sm:inline">Back to Study Zone</span>
    </Link>
  );
}
