import { sql } from "drizzle-orm";
import { db, dbKind } from "@/server/db/client";
import { handle, ok } from "@/server/http";
import { aiConfigured, plannerModel } from "@/server/planner/llm";

/** GET /api/v1/health: the database is reachable and migrated; says whether AI planning is configured. */
export const GET = handle(async () => {
  const database = await db();
  const [row] = await database.execute<{ users: number }>(sql`select count(*)::int as users from users`).then((r) => r.rows);
  return ok({ ok: true, database: dbKind(), users: row?.users ?? 0, ai: aiConfigured(), model: aiConfigured() ? plannerModel() : null });
});
