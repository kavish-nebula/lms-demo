import { getSessionUser } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { projectTickets } from "@/server/project";

/** The hidden tickets to run, without what Scout should do with them. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ courseId: string }> }) =>
  ok(await projectTickets(await getSessionUser(), (await params).courseId)),
);
