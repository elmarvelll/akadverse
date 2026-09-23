import { HeaderBones, LoadingRegion, TableBones, Bone } from "../../_components/Skeletons";
export default function Loading() { return <LoadingRegion label="Loading results"><HeaderBones /><Bone className="h-10 w-full max-w-md" /><TableBones rows={7} cols={5} /></LoadingRegion>; }
