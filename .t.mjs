import { normalizeDepartmentAdmin } from "./src/lib/auth.js";
const cases = [
  ["empty semesters + semester 1", { role:'departmentAdmin', semester:1, semesters: [] }],
  ["null semesters",                { role:'departmentAdmin', semester:1, semesters: null }],
  ["single-entry [1]",              { role:'departmentAdmin', semester:1, semesters: [1] }],
  ["already [1..8]",                { role:'departmentAdmin', semester:1, semesters: [1,2,3,4,5,6,7,8] }],
  ["teacher  (must NOT change)",    { role:'teacher', semester:3, semesters: [3] }],
  ["student  (must NOT change)",    { role:'student', semester:5, semesters: [] }],
  ["admin    (must NOT change)",    { role:'admin', semester:1, semesters: [] }],
];
let fails = 0;
for (const [name, input] of cases) {
  const before = JSON.stringify(input.semesters);
  const out = normalizeDepartmentAdmin(structuredClone(input));
  const isDA = input.role === 'departmentAdmin';
  const ok = isDA
    ? (Array.isArray(out.semesters) && out.semesters.length === 8)
    : JSON.stringify(out.semesters) === before;
  if (!ok) fails++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(30)} -> ${JSON.stringify(out.semesters)}`);
}
console.log("");
console.log(fails === 0 ? "ALL PASS" : `${fails} FAILURE(S)`);
