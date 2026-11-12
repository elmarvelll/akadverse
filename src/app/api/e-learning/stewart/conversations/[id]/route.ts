import { NextResponse } from "next/server";
import { deleteConversation, getConversation } from "@/services/e-learning/student/stewart/conversations";
import { requireStewartStudent, stewartErrorResponse } from "../../shared";
export const maxDuration = 120;
const headers = { "Cache-Control": "no-store" };
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireStewartStudent(); const { id } = await context.params;
    return NextResponse.json(await getConversation(userId, id, new URL(req.url).searchParams.get("before") ?? undefined), { headers });
  } catch (error) { return stewartErrorResponse("conversation read", error); }
}
export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireStewartStudent(); const { id } = await context.params;
    await deleteConversation(userId, id);
    return NextResponse.json({ deleted: true }, { headers });
  } catch (error) { return stewartErrorResponse("conversation delete", error); }
}
