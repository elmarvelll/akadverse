import { TimeFrameEditor } from "../../_components/TimeFrameEditor";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const q = await searchParams;
  return <TimeFrameEditor type="RESULT_UPLOAD" title="Result Upload Timeframe" error={q.error} />;
}
