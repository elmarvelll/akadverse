import { HeaderBones, ListBones, LoadingRegion, Bone } from "../../_components/Skeletons";
export default function Loading() {
  return (
    <LoadingRegion label="Loading course registration">
      <HeaderBones />
      <Bone className="h-20 w-full rounded-2xl" />
      <ListBones rows={6} />
    </LoadingRegion>
  );
}
