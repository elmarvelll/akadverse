import { FormBones, HeaderBones, ListBones, LoadingRegion } from "../_components/Skeletons";
export default function Loading() { return <LoadingRegion label="Loading"><HeaderBones /><FormBones fields={2} /><ListBones rows={4} /></LoadingRegion>; }
