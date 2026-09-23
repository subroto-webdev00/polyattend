# PolyAttend — MongoDB → PostgreSQL + Prisma Migration

## ধাপ ১: পুরানো packages সরাও, নতুন install করো

```bash
npm remove mongoose
npm install @prisma/client bcryptjs jsonwebtoken exceljs nodemailer
npm install -D prisma
```

## ধাপ ২: .env file বানাও

```bash
cp .env.example .env
```
তারপর `.env` এ তোমার database info দাও:
```
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/polyattend"
```

## ধাপ ৩: Prisma setup করো

```bash
# Prisma client generate করো
npx prisma generate

# Database এ tables বানাও (migration)
npx prisma migrate dev --name init

# অথবা production এ:
npx prisma migrate deploy
```

## ধাপ ৪: Default data seed করো

```bash
npm run db:seed
```
এটা departments আর settings এর default data দেবে।

## ধাপ ৫: Project চালাও

```bash
npm run dev
```

## ধাপ ৬: Prisma Studio (optional — GUI দিয়ে database দেখো)

```bash
npm run db:studio
```

---

## ফাইল Structure যা বদলেছে

| আগে (MongoDB) | এখন (PostgreSQL + Prisma) |
|---|---|
| `src/lib/dbConnect.js` | `src/lib/db.js` (Prisma client) |
| `src/lib/models/*.js` | `prisma/schema.prisma` |
| `src/lib/auth.js` | Updated — Prisma query |
| `src/lib/holidayCheck.js` | Updated — Prisma query |
| সব `api/*/route.js` | Mongoose → Prisma converted |

## Import Change (সব route এ)

```js
// আগে
import dbConnect from '@/lib/dbConnect';
import User from '@/lib/models/User';
await dbConnect();
const user = await User.findById(id).populate('departmentId');

// এখন
import prisma from '@/lib/db';
const user = await prisma.user.findUnique({
  where: { id },
  include: { department: true }
});
```

## Key Mongoose → Prisma conversion

| Mongoose | Prisma |
|---|---|
| `User.find({role:'student'})` | `prisma.user.findMany({where:{role:'student'}})` |
| `User.findById(id)` | `prisma.user.findUnique({where:{id}})` |
| `User.findOne({email})` | `prisma.user.findFirst({where:{email}})` |
| `User.create({...})` | `prisma.user.create({data:{...}})` |
| `User.findByIdAndUpdate(id,{$set:{...}})` | `prisma.user.update({where:{id},data:{...}})` |
| `Session.updateOne({},{$inc:{presentCount:1}})` | `prisma.session.update({data:{presentCount:{increment:1}}})` |
| `.populate('departmentId')` | `include:{department:true}` |
| `$gt`, `$lt`, `$ne`, `$in` | `{gt:}`, `{lt:}`, `{not:}`, `{in:[]}` |
| `_id` | `id` |

## TTL (Auto-delete) — Cron Job দরকার

MongoDB তে TTL index ছিল, PostgreSQL এ নেই।
এই route call করো প্রতিদিন (Vercel Cron / cron-job.org):

```
GET /api/cron/cleanup  (পরে বানাতে হবে)
```

```js
// src/app/api/cron/cleanup/route.js
import prisma from '@/lib/db';
export async function GET() {
  await prisma.pendingRegistration.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 24*60*60*1000) } }
  });
  await prisma.ignoredMiss.deleteMany({
    where: { date: { lt: new Date(Date.now() - 7*24*60*60*1000) } }
  });
  return Response.json({ success: true });
}
```
