const BASE = "https://polyattend-system2026.vercel.app";
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function hit() { const t = Date.now(); const r = await fetch(BASE + "/login"); await r.text(); return Date.now() - t; }
(async () => {
  console.log("=== does an idle gap trigger a cold start? ===\n");
  console.log(`  warm call            : ${await hit()}ms`);
  console.log("  ...waiting 12s...");
  await sleep(12000);
  console.log(`  after 12s idle       : ${await hit()}ms`);
  console.log("  ...waiting 40s...");
  await sleep(40000);
  const a = await hit();
  console.log(`  after 40s idle       : ${a}ms`);
  console.log(`  immediately after    : ${await hit()}ms`);
  console.log("\nVERDICT:", a > 300 ? "COLD START confirmed - the server sleeps when idle" : "always warm; slowness is elsewhere");
  process.exit(0);
})();
