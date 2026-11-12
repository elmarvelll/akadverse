import { CardGridBones, HeaderBones, LoadingRegion } from "../../_components/Skeletons";
export default function Loading() { return <LoadingRegion label="Loading your courses"><HeaderBones /><CardGridBones count={6} /></LoadingRegion>; }
