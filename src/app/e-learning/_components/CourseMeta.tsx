// Shared Level / Units / Type chips for course rows, cards and tables. One
// place so the important academic fields are always dark and high-contrast
// (WCAG AA on their tinted backgrounds) instead of faint grey text.

const TYPE_STYLE: Record<string, string> = {
  CORE: "bg-blue-100 text-blue-900 border-blue-300",
  ELECTIVE: "bg-purple-100 text-purple-900 border-purple-300",
  OPTIONAL: "bg-amber-100 text-amber-900 border-amber-300",
};
const chip = "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap";

export default function CourseMeta({ level, units, type }: { level?: number | null; units?: number | null; type?: string | null }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
      {level != null && <span className={`${chip} bg-gray-100 text-gray-900 border-gray-400`}>{level} Level</span>}
      {units != null && <span className={`${chip} bg-gray-100 text-gray-900 border-gray-400`}>{units} {units === 1 ? "Unit" : "Units"}</span>}
      {type && <span className={`${chip} ${TYPE_STYLE[type] ?? "bg-gray-100 text-gray-900 border-gray-400"}`}>{type[0] + type.slice(1).toLowerCase()}</span>}
    </span>
  );
}
