import Link from "next/link";
import { SearchX } from "lucide-react";

// Shown for notFound() inside E-Learning (e.g. a course the student isn't registered for, or an offering that isn't theirs).
// It deliberately doesn't say which of those it was.
export default function ElearningNotFound() {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-6 text-center">
      <SearchX className="mx-auto text-gray-700" size={28} aria-hidden />
      <h1 className="mt-3 text-lg font-bold text-gray-900">We couldn&apos;t find that page</h1>
      <p className="mt-1 text-sm text-gray-800">It may not exist, or it may not be available to your account.</p>
      <Link href="/" className="mt-4 inline-block rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Go to my dashboard</Link>
    </div>
  );
}
