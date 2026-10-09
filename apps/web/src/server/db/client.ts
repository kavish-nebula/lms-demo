import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getLearner } from "@/data";
import * as schema from "./schema";

/**
 * The learner database. Locally it is PGlite (Postgres compiled to WASM,
 * stored in apps/web/.data/pglite), so there is nothing to install; with
 * DATABASE_URL set it is a real Postgres server (Cloud SQL in production).
 * Both run the same Drizzle queries and the same SQL migrations (drizzle/).
 *
 * PGlite allows one connection, and Next's dev server re-evaluates modules,
 * so the instance lives on globalThis and every caller shares it.
 */

/** Both drivers expose the same query builder; typed as the PGlite one. */
export type DB = PgliteDatabase<typeof schema>;

const store = globalThis as unknown as { __lmsDb?: Promise<DB> };

export function db(): Promise<DB> {
  if (!store.__lmsDb) {
    store.__lmsDb = open().catch((e) => {
      store.__lmsDb = undefined;
      throw e;
    });
  }
  return store.__lmsDb;
}

/** apps/web, whether the server was started from there or from the monorepo root. */
export function appRoot(): string {
  const cwd = process.cwd();
  for (const dir of [cwd, path.join(cwd, "apps", "web")]) {
    if (fs.existsSync(path.join(dir, "drizzle", "meta", "_journal.json"))) return dir;
  }
  return cwd;
}

export const dbKind = () => (process.env.DATABASE_URL ? "postgres" : "pglite");

async function open(): Promise<DB> {
  const migrationsFolder = path.join(appRoot(), "drizzle");
  let database: DB;
  if (process.env.DATABASE_URL) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pg = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), { schema });
    await migrate(pg, { migrationsFolder });
    database = pg as unknown as DB;
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const dir = process.env.PGLITE_DIR ?? path.join(appRoot(), ".data", "pglite");
    if (dir !== "memory://") fs.mkdirSync(dir, { recursive: true });
    const client = new PGlite(dir === "memory://" ? undefined : dir);
    database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder });
  }
  await seed(database);
  return database;
}

/** The demo learner, until a real identity provider signs people in. */
async function seed(database: DB) {
  const { user } = await getLearner();
  await database.insert(schema.users).values({ id: user.user_id, name: user.name, email: user.email }).onConflictDoNothing();
}
