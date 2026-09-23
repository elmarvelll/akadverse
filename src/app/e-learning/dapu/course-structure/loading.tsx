import { FiltersBones, HeaderBones, LoadingRegion, TableBones } from "../../_components/Skeletons";
export default function Loading() { return <LoadingRegion label="Loading course structure"><HeaderBones /><FiltersBones /><TableBones rows={8} cols={6} /></LoadingRegion>; }
