import { Bone, CardGridBones, HeaderBones, LoadingRegion } from "../../_components/Skeletons";
export default function Loading() {
  return (
    <LoadingRegion label="Loading dashboard">
      <HeaderBones />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><Bone className="h-24 rounded-2xl" /><Bone className="h-24 rounded-2xl" /><Bone className="h-24 rounded-2xl" /></div>
      <CardGridBones count={3} />
    </LoadingRegion>
  );
}
