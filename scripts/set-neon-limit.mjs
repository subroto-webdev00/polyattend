#!/usr/bin/env node
/**
 * Set a consumption limit on a Neon project so you get warned BEFORE the
 * free-tier CU-hour allowance runs out.
 *
 * Usage:
 *   NEON_API_KEY=... NEON_PROJECT_ID=... node scripts/set-neon-limit.mjs [thresholdPercent]
 *
 * Where to get the values:
 *   API key  : Neon Console -> Account Settings -> API Keys -> Generate
 *   Project  : Neon Console -> your project -> Settings -> the Project ID
 *              shown there (looks like "wandering-leaf-48698404", NOT just
 *              the numeric suffix).
 *
 * This uses Neon's actual quota mechanism: a PATCH to /projects/{id} that
 * sets settings.quota.compute_time_seconds. There is no separate
 * "actions"/"apply_consumption_limit" endpoint - quotas live directly on
 * the project's settings object.
 * Docs: https://neon.com/docs/guides/consumption-limits
 */

const API_KEY = process.env.NEON_API_KEY;
const PROJECT_ID = process.env.NEON_PROJECT_ID;

const FREE_PLAN_CU_HOURS = 100;
const thresholdPct = Math.min(100, Math.max(1, Number(process.argv[2]) || 80));

if (!API_KEY || !PROJECT_ID) {
  console.error('Missing NEON_API_KEY and/or NEON_PROJECT_ID.');
  process.exit(1);
}

const api = 'https://console.neon.tech/api/v2';

async function neon(path, init = {}) {
  const res = await fetch(`${api}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) {
    throw new Error(`${init.method || 'GET'} ${path} -> ${res.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function main() {
  console.log(`Checking project ${PROJECT_ID} ...`);

  await neon(`/projects/${PROJECT_ID}`);

  const thresholdCuHours = Math.round((FREE_PLAN_CU_HOURS * thresholdPct) / 100);
  const thresholdSeconds = thresholdCuHours * 3600;

  const body = {
    project: {
      settings: {
        quota: {
          compute_time_seconds: thresholdSeconds,
        },
      },
    },
  };

  await neon(`/projects/${PROJECT_ID}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

  console.log('');
  console.log('Consumption limit applied.');
  console.log(`  free allowance : ${FREE_PLAN_CU_HOURS} CU-hours / month`);
  console.log(`  suspends at    : ${thresholdCuHours} CU-hours (${thresholdPct}%) = ${thresholdSeconds}s compute_time_seconds`);
  console.log('');
  console.log('When this triggers, all active computes for the project are');
  console.log('suspended and cannot be restarted via API or new connections');
  console.log('until you raise the quota or the next billing period starts.');
}

main().catch(err => {
  console.error('\nFailed:', err.message);
  console.error('\nChecklist:');
  console.error('  - Is NEON_API_KEY a valid, non-expired key?');
  console.error('  - Is the key scoped to the right project/account?');
  console.error('  - Is NEON_PROJECT_ID the full slug (e.g. wandering-leaf-48698404),');
  console.error('    not just the trailing number?');
  process.exit(1);
});