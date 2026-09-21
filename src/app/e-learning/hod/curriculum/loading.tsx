import { FiltersBones, HeaderBones, LoadingRegion, TableBones } from "../../_components/Skeletons";
export default function Loading() { return <LoadingRegion label="Loading course structures"><HeaderBones /><FiltersBones /><TableBones rows={5} cols={5} /></LoadingRegion>; }
