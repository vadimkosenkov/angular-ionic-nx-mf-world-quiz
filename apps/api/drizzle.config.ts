import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit reads the TypeScript schema and writes SQL migrations into
 * `apps/api/drizzle`; no database is needed to generate them. Run from the
 * workspace root: `npx nx run api:db-generate`.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './apps/api/src/db/schema.ts',
  out: './apps/api/drizzle',
  casing: 'snake_case',
});
