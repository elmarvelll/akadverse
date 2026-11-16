import { NextRequest } from "next/server";
import { getSummary } from "./route.controller";
export async function GET(request: NextRequest) { return getSummary(request); }
