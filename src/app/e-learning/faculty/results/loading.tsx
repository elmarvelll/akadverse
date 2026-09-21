import { HeaderBones, ListBones, LoadingRegion } from "../../_components/Skeletons";
export default function Loading() { return <LoadingRegion label="Loading results"><HeaderBones /><ListBones rows={5} /></LoadingRegion>; }
