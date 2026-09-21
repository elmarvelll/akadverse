import { HeaderBones, LoadingRegion, TableBones } from "../../_components/Skeletons";
export default function Loading() { return <LoadingRegion label="Loading registrations"><HeaderBones /><TableBones rows={6} cols={4} /></LoadingRegion>; }
