const BASE = "https://polyattend-system2026.vercel.app";
// Cold vs warm: the first hit on a serverless function includes a cold start,
// which is the most common cause of "my app is slow" that is NOT the database.
async function time(path, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = Date.now();
    try { const r = await fetch(BASE + path); await r.text(); out.push({ ms: Date.now()-t, s: r.status }); }
    catch (e) { out.push({ ms: Date.now()-t, s: "ERR" }); }
  }
  return out;
}
(async () => {
  console.log("=== /api/health (no auth) — 5 calls ===");
  const h = await time("/api/health", 5);
  h.forEach((r,i) => console.log(`  call ${i+1}: ${String(r.ms).padStart(5)}ms  ${r.s}`));

  console.log("\n=== /login (static page) — 3 calls ===");
  const l = await time("/login", 3);
  l.forEach((r,i) => console.log(`  call ${i+1}: ${String(r.ms).padStart(5)}ms  ${r.s}`));

  console.log("\n=== / (home, server-rendered) — 3 calls ===");
  const m = await time("/", 3);
  m.forEach((r,i) => console.log(`  call ${i+1}: ${String(r.ms).padStart(5)}ms  ${r.s}`));

  const all = [...h,...l,...m].map(r=>r.ms);
  console.log(`\n  total requests: ${all.length}`);
  console.log(`  fastest : ${Math.min(...all)}ms`);
  console.log(`  slowest : ${Math.max(...all)}ms`);
  console.log(`  average : ${Math.round(all.reduce((a,b)=>a+b,0)/all.length)}ms`);
  process.exit(0);
})();
