import { FiltersBones, HeaderBones, ListBones, LoadingRegion } from "../_components/Skeletons";
export default function Loading() { return <LoadingRegion label="Loading"><HeaderBones /><FiltersBones /><ListBones rows={5} /></LoadingRegion>; }
