import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
import { cacheDel, cacheKey } from '@/lib/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// এক সময় সর্বোচ্চ ২টি নোটিস সক্রিয় থাকবে।
const MAX_ACTIVE_NOTICES = 2;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VALID_AUDIENCES = ['ALL', 'ADMIN', 'DEPARTMENT_ADMIN', 'TEACHER', 'STUDENT'];
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'notices');

// BUG FIX: user.role is "departmentAdmin" but the audience enum value is
// "DEPARTMENT_ADMIN". `role.toUpperCase()` gave "DEPARTMENTADMIN", so Department
// Admins never received notices addressed to them.
const ROLE_TO_AUDIENCE = {
  admin: 'ADMIN',
  departmentAdmin: 'DEPARTMENT_ADMIN',
  teacher: 'TEACHER',
  student: 'STUDENT',
};

const noticeInclude = {
  createdBy: { select: { id: true, name: true, email: true, role: true } },
};

function err(message, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

// Saves an uploaded image and returns its public URL, or throws a
// { userMessage } error for a bad file.
async function saveImage(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw { userMessage: 'শুধু JPG, PNG, WEBP বা GIF ছবি দেওয়া যাবে।' };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw { userMessage: 'ছবির সাইজ সর্বোচ্চ ৫ MB হতে পারে।' };
  }
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[file.type];
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  // Name is generated, never taken from the client (path traversal / odd chars).
  const filename = `notice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()));
  return `/api/notices/image/${filename}`;
}

// Removes the file behind an imageUrl we created. Never throws.
function removeImageFile(imageUrl) {
  try {
    if (!imageUrl) return;
    const name = path.basename(imageUrl);
    if (!/^notice_[\w.-]+$/.test(name)) return;
    const full = path.join(UPLOAD_DIR, name);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch { /* best effort */ }
}

// Reads title/content/audience/departmentId/image from multipart or JSON.
async function readBody(request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('image');
    return {
      title: form.get('title'),
      content: form.get('content'),
      audience: form.get('audience') || undefined,
      departmentId: form.get('departmentId') || null,
      id: form.get('id') || null,
      removeImage: form.get('removeImage') === 'true',
      file: file && typeof file === 'object' && file.size > 0 ? file : null,
    };
  }
  const body = await request.json();
  return {
    title: body.title,
    content: body.content,
    audience: body.audience || undefined,
    departmentId: body.departmentId || null,
    id: body.id || null,
    removeImage: body.removeImage === true,
    file: null,
    imageUrl: body.imageUrl || null,
  };
}

/*─────────────────────────────────────────────────────────────────────────────
  GET /api/notices
  অ্যাডমিন সব সক্রিয় নোটিস দেখে (ম্যানেজ করার জন্য)।
  অন্যরা শুধু নিজের রোল ও ডিপার্টমেন্টের নোটিস দেখে।
─────────────────────────────────────────────────────────────────────────────*/
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const { user } = auth;

  try {
    const where = { isActive: true };

    if (user.role !== 'admin') {
      const audience = ROLE_TO_AUDIENCE[user.role];
      where.AND = [
        { OR: [{ audience: 'ALL' }, ...(audience ? [{ audience }] : [])] },
        { OR: [{ departmentId: null }, ...(user.departmentId ? [{ departmentId: user.departmentId }] : [])] },
      ];
    }

    const notices = await prisma.notice.findMany({
      where,
      include: noticeInclude,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ success: true, notices, max: MAX_ACTIVE_NOTICES });
  } catch (error) { return errorResponse(error); }
}

/*─────────────────────────────────────────────────────────────────────────────
  POST /api/notices   (শুধু অ্যাডমিন)
─────────────────────────────────────────────────────────────────────────────*/
export async function POST(request) {
  const auth = await requireAuth(request, ['admin']);
  if (auth.error) return auth.error;
  const { user } = auth;

  let savedImage = null;
  try {
    const data = await readBody(request);
    const title = String(data.title || '').trim();
    const content = String(data.content || '').trim();
    const audience = data.audience || 'ALL';

    if (!title || !content) return err('শিরোনাম এবং বিষয়বস্তু উভয়ই প্রয়োজন।');
    if (title.length > 150) return err('শিরোনাম সর্বোচ্চ ১৫০ অক্ষরের হতে পারে।');
    if (!VALID_AUDIENCES.includes(audience)) return err('অবৈধ অডিয়েন্স।');

    // A wrong department id would otherwise surface as a raw foreign-key 500.
    if (data.departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: data.departmentId }, select: { id: true } });
      if (!dept) return err('ডিপার্টমেন্ট পাওয়া যায়নি।');
    }

    const activeCount = await prisma.notice.count({ where: { isActive: true } });
    if (activeCount >= MAX_ACTIVE_NOTICES) {
      return err(`এক সময় সর্বোচ্চ ${MAX_ACTIVE_NOTICES} টি নোটিস পোস্ট করা যাবে। আগে একটি পুরনো নোটিস ডিলিট করুন।`, 403);
    }

    let imageUrl = data.imageUrl || null;
    if (data.file) imageUrl = savedImage = await saveImage(data.file);

    const notice = await prisma.notice.create({
      data: { title, content, imageUrl, audience, departmentId: data.departmentId, isActive: true, createdById: user.id },
      include: noticeInclude,
    });
    await cacheDel(cacheKey('notices'));
    return NextResponse.json({ success: true, notice });
  } catch (error) {
    removeImageFile(savedImage); // don't leave an orphan file if the insert failed
    if (error?.userMessage) return err(error.userMessage);
    return errorResponse(error);
  }
}

/*─────────────────────────────────────────────────────────────────────────────
  PUT /api/notices   (শুধু অ্যাডমিন) — নোটিস এডিট
  body: { id, title, content, audience, departmentId, image?, removeImage? }
─────────────────────────────────────────────────────────────────────────────*/
export async function PUT(request) {
  const auth = await requireAuth(request, ['admin']);
  if (auth.error) return auth.error;

  let savedImage = null;
  try {
    const data = await readBody(request);
    if (!data.id) return err('নোটিস আইডি প্রয়োজন।');

    const existing = await prisma.notice.findUnique({ where: { id: data.id } });
    if (!existing) return err('নোটিস পাওয়া যায়নি।', 404);

    const title = String(data.title || '').trim();
    const content = String(data.content || '').trim();
    const audience = data.audience || existing.audience;
    if (!title || !content) return err('শিরোনাম এবং বিষয়বস্তু উভয়ই প্রয়োজন।');
    if (title.length > 150) return err('শিরোনাম সর্বোচ্চ ১৫০ অক্ষরের হতে পারে।');
    if (!VALID_AUDIENCES.includes(audience)) return err('অবৈধ অডিয়েন্স।');

    if (data.departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: data.departmentId }, select: { id: true } });
      if (!dept) return err('ডিপার্টমেন্ট পাওয়া যায়নি।');
    }

    let imageUrl = existing.imageUrl;
    if (data.file) imageUrl = savedImage = await saveImage(data.file);
    else if (data.removeImage) imageUrl = null;

    const notice = await prisma.notice.update({
      where: { id: data.id },
      data: { title, content, audience, departmentId: data.departmentId, imageUrl },
      include: noticeInclude,
    });

    if (imageUrl !== existing.imageUrl) removeImageFile(existing.imageUrl);
    await cacheDel(cacheKey('notices'));
    return NextResponse.json({ success: true, notice });
  } catch (error) {
    removeImageFile(savedImage);
    if (error?.userMessage) return err(error.userMessage);
    return errorResponse(error);
  }
}

/*─────────────────────────────────────────────────────────────────────────────
  DELETE /api/notices?id=...   (শুধু অ্যাডমিন)
─────────────────────────────────────────────────────────────────────────────*/
export async function DELETE(request) {
  const auth = await requireAuth(request, ['admin']);
  if (auth.error) return auth.error;

  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return err('নোটিস আইডি প্রয়োজন।');

    const notice = await prisma.notice.findUnique({ where: { id } });
    if (!notice) return err('নোটিস পাওয়া যায়নি।', 404);

    await prisma.notice.delete({ where: { id } });
    removeImageFile(notice.imageUrl);
    await cacheDel(cacheKey('notices'));
    return NextResponse.json({ success: true, message: 'নোটিস ডিলিট করা হয়েছে।' });
  } catch (error) { return errorResponse(error); }
}
