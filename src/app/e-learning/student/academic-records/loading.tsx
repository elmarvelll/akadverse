import { HeaderBones, LoadingRegion, TableBones } from "../../_components/Skeletons";
export default function Loading() { return <LoadingRegion label="Loading records"><HeaderBones /><TableBones rows={6} cols={5} /></LoadingRegion>; }
