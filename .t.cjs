// Copy of the function exactly as it now stands in src/lib/auth.js
function normalizeDepartmentAdmin(user) {
  if (user?.role === 'departmentAdmin') {
    user.semesters = [1, 2, 3, 4, 5, 6, 7, 8];
    if (!user.semester || ![1,2,3,4,5,6,7,8].includes(Number(user.semester))) {
      user.semester = 1;
    }
  }
  return user;
}
const cases = [
  ["DA empty semesters + sem 1", { role:'departmentAdmin', semester:1, semesters: [] }, true],
  ["DA null semesters",         { role:'departmentAdmin', semester:1, semesters: null }, true],
  ["DA single-entry [1]",       { role:'departmentAdmin', semester:1, semesters: [1] }, true],
  ["DA already [1..8]",         { role:'departmentAdmin', semester:1, semesters: [1,2,3,4,5,6,7,8] }, true],
  ["DA semester out of range",  { role:'departmentAdmin', semester:99, semesters: [] }, true],
  ["teacher  (must NOT change)",{ role:'teacher', semester:3, semesters: [3] }, false],
  ["student  (must NOT change)",{ role:'student', semester:5, semesters: [] }, false],
  ["admin    (must NOT change)",{ role:'admin', semester:1, semesters: [] }, false],
];
let fails = 0;
for (const [name, input, isDA] of cases) {
  const before = JSON.stringify(input.semesters);
  const beforeSem = input.semester;
  const out = normalizeDepartmentAdmin(structuredClone(input));
  const ok = isDA
    ? (Array.isArray(out.semesters) && out.semesters.length === 8)
    : (JSON.stringify(out.semesters) === before && out.semester === beforeSem);
  if (!ok) fails++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(28)} -> semesters=${JSON.stringify(out.semesters)} semester=${out.semester}`);
}
console.log("");
console.log(fails === 0 ? "ALL PASS" : fails + " FAILURE(S)");
