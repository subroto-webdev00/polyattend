import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Unit tests for the pure logic in src/lib (password rules, display
// formatting, invite codes, rate limiting, report responses, roster totals).
// The `@` alias matches jsconfig.json so tests can import exactly the same
// specifiers the app code uses — including `vi.mock('@/lib/db')`.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    // The API route tests (added later) need the DB; keep them out of the
    // default run so `npm test` stays green without a live Postgres.
    exclude: ['**/node_modules/**', 'tests/e2e/**'],
  },
});
