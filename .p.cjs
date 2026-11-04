const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const das = await p.user.findMany({
    where: { role: 'departmentAdmin' },
    select: { id:true, name:true, email:true, semester:true, semesters:true, shift:true, departmentId:true, isActive:true }
  });
  console.log('departmentAdmin accounts:', das.length);
  for (const d of das) {
    console.log('---');
    console.log('  name      :', d.name);
    console.log('  email     :', d.email);
    console.log('  semester  :', d.semester, '  <- singular column');
    console.log('  semesters :', JSON.stringify(d.semesters), '  <- array column');
    console.log('  shift     :', d.shift, '| active:', d.isActive);
    const arr = d.semesters || [];
    console.log('  VERDICT   :', (Array.isArray(arr) && arr.length === 8) ? 'OK (has 1-8)' : 'PROBLEM - array empty or missing');
  }
  await p.$disconnect();
})().catch(e=>{console.error(e.message);process.exit(1);});
