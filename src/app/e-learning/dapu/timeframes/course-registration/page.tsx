import { TimeFrameEditor } from "../../_components/TimeFrameEditor";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const q = await searchParams;
  return <TimeFrameEditor type="COURSE_REGISTRATION" title="Course Registration Timeframe" error={q.error} />;
}
