import { CardGridBones, HeaderBones, LoadingRegion } from "./_components/Skeletons";

// Fallback for any E-Learning page that has no more specific loading.tsx below it.
export default function Loading() {
  return (
    <LoadingRegion label="Loading page">
      <HeaderBones />
      <CardGridBones count={6} />
    </LoadingRegion>
  );
}
