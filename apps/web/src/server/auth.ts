import "server-only";
import { eq } from "drizzle-orm";
import { getLearner } from "@/data";
import { db } from "./db/client";
import { users } from "./db/schema";

export type SessionUser = { id: string; name: string; email: string };

/**
 * Who is asking. Until a managed identity provider is wired in, every request
 * is the demo learner; swap this one function for the IdP session lookup.
 * Every query in src/server is scoped by the id it returns.
 */
export async function getSessionUser(): Promise<SessionUser> {
  const database = await db();
  const { user } = await getLearner();
  const row = await database.query.users.findFirst({ where: eq(users.id, user.user_id) });
  if (!row) throw new Error("Demo user missing from the database");
  return { id: row.id, name: row.name, email: row.email };
}
