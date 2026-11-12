import { TimeFrameEditor } from "../../_components/TimeFrameEditor";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const q = await searchParams;
  return <TimeFrameEditor type="CHANGE_OF_COURSE" title="Change of Course Timeframe" error={q.error} />;
}
