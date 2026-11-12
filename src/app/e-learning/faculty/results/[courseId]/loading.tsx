import { HeaderBones, LoadingRegion, TableBones } from "../../../_components/Skeletons";
export default function Loading() { return <LoadingRegion label="Loading result sheet"><HeaderBones /><TableBones rows={8} cols={6} /></LoadingRegion>; }
