import { getSessionUser } from "@/server/auth";
import { body,handle,ok } from "@/server/http";
import { saveWorkflow } from "@/server/workflow-project";
import { WorkflowSaveSchema } from "@/lib/workflow-project";
type Ctx = { params: Promise<{ courseId: string }> };
export const POST = handle(async (req: Request,{ params }: Ctx) => { const input = await body(req,WorkflowSaveSchema); return ok(await saveWorkflow(await getSessionUser(),(await params).courseId,input.diagram,input.revision,true)); });
