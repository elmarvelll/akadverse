import { CardGridBones, HeaderBones, LoadingRegion } from "../../_components/Skeletons";
export default function Loading() { return <LoadingRegion label="Loading your subjects"><HeaderBones /><CardGridBones count={4} /></LoadingRegion>; }
