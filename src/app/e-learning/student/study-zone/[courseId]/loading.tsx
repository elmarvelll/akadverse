import { Bone, LoadingRegion } from "../../../_components/Skeletons";

// Same frame as the workspace (compact course header, tabs on the document panel, Stewart beside it once the content
// area is wide enough), so nothing jumps when the real page arrives.
export default function Loading() {
  return (
    <LoadingRegion label="Opening your study workspace">
      <div className="@container space-y-3">
        <div className="flex h-9 items-center gap-3"><Bone className="h-9 w-40" /><Bone className="h-5 w-1/3" /></div>
        <div className="grid grid-cols-1 gap-3 @4xl:grid-cols-[minmax(0,1fr)_18rem] @6xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex h-[calc(100dvh-9rem)] min-h-[24rem] min-w-0 flex-col sm:h-[calc(100dvh-10rem)]">
            <div className="flex gap-1 overflow-hidden px-1">
              {Array.from({ length: 6 }, (_, i) => <Bone key={i} className="h-11 w-36 shrink-0 rounded-b-none rounded-t-xl" />)}
            </div>
            <div className="flex-1 space-y-3 rounded-b-2xl rounded-tr-2xl border border-gray-200 bg-white p-6">
              <Bone className="h-5 w-1/2" /><Bone className="h-3 w-1/3" /><Bone className="mt-6 h-3/5 w-full" />
            </div>
          </div>
          <div className="h-[34rem] space-y-3 rounded-2xl border border-gray-200 bg-white p-4 @4xl:h-[calc(100dvh-10rem)]">
            <div className="flex items-center gap-3"><Bone className="h-9 w-9 rounded-full" /><Bone className="h-4 w-24" /></div>
            <Bone className="h-10 w-full" /><Bone className="h-16 w-4/5" /><Bone className="ml-auto h-10 w-3/5" />
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}
