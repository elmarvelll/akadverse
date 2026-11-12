import { TimeFrameEditor } from "../../_components/TimeFrameEditor";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const q = await searchParams;
  return <TimeFrameEditor type="MAKEUP_APPLICATION" title="Make-up Application Timeframe" error={q.error} />;
}
