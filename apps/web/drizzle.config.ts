import { defineConfig } from "drizzle-kit";

/** SQL migrations for the learner database. Generate with `npm run db:generate` after changing src/server/db/schema.ts. */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
});
