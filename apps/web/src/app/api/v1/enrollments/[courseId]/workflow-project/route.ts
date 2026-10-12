import { getSessionUser } from "@/server/auth";
import { body,handle,ok } from "@/server/http";
import { workflowOf,saveWorkflow } from "@/server/workflow-project";
import { WorkflowSaveSchema } from "@/lib/workflow-project";
type Ctx = { params: Promise<{ courseId: string }> };
export const GET = handle(async (_req: Request,{ params }: Ctx) => ok(await workflowOf(await getSessionUser(),(await params).courseId)));
export const PUT = handle(async (req: Request,{ params }: Ctx) => { const input = await body(req,WorkflowSaveSchema); return ok(await saveWorkflow(await getSessionUser(),(await params).courseId,input.diagram,input.revision)); });
