
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import prisma from '@/lib/db';
import { requireAuth, errorResponse } from '@/lib/auth';
import { cacheDel, cacheKey } from '@/lib/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Maximum active notices
const MAX_ACTIVE_NOTICES = 2;

// Image validation
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

// Must match Prisma NoticeAudience enum
const VALID_AUDIENCES = [
  'ALL',
  'DEPARTMENT_ADMIN',
  'TEACHER',
  'STUDENT',
];

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Role mapping
const ROLE_TO_AUDIENCE = {
  admin: 'ADMIN',
  departmentAdmin: 'DEPARTMENT_ADMIN',
  teacher: 'TEACHER',
  student: 'STUDENT',
};

const noticeInclude = {
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
};

// Standard API error
function err(message, status = 400) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

// Check Cloudinary configuration
function checkCloudinaryConfig() {
  if (
    !CLOUDINARY_CLOUD_NAME ||
    !CLOUDINARY_API_KEY ||
    !CLOUDINARY_API_SECRET
  ) {
    throw new Error('Cloudinary environment variables are missing.');
  }
}

// Generate Cloudinary API signature
function cloudinarySignature(params) {
  checkCloudinaryConfig();

  const signatureString =
    Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&') + CLOUDINARY_API_SECRET;

  return createHash('sha1')
    .update(signatureString)
    .digest('hex');
}

// Upload image to Cloudinary
async function saveImage(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw {
      userMessage: 'শুধু JPG, PNG, WEBP বা GIF ছবি দেওয়া যাবে।',
    };
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw {
      userMessage: 'ছবির সাইজ সর্বোচ্চ ৫ MB হতে পারে।',
    };
  }

  checkCloudinaryConfig();

  const timestamp = Math.floor(Date.now() / 1000);

  const params = {
    folder: 'polyattend/notices',
    timestamp,
  };

  const signature = cloudinarySignature(params);

  const formData = new FormData();

  const imageBuffer = Buffer.from(
    await file.arrayBuffer()
  );

  formData.append(
    'file',
    new Blob([imageBuffer], { type: file.type }),
    file.name || 'notice-image'
  );

  formData.append('api_key', CLOUDINARY_API_KEY);
  formData.append('timestamp', String(timestamp));
  formData.append('folder', params.folder);
  formData.append('signature', signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
      cache: 'no-store',
    }
  );

  const result = await response.json();

  if (!response.ok) {
    console.error('Cloudinary upload error:', result);

    throw {
      userMessage: 'ছবি আপলোড করা যায়নি। আবার চেষ্টা করুন।',
    };
  }

  return result.secure_url;
}

// Extract Cloudinary public ID from URL
function getCloudinaryPublicId(imageUrl) {
  try {
    const url = new URL(imageUrl);

    if (
      url.hostname !== 'res.cloudinary.com' ||
      !url.pathname.includes('/image/upload/')
    ) {
      return null;
    }

    const uploadPath = url.pathname.split('/image/upload/')[1];

    if (!uploadPath) return null;

    const segments = uploadPath.split('/');

    // Remove version segment (v123456789)
    if (/^v\d+$/.test(segments[0])) {
      segments.shift();
    }

    const publicIdWithExtension = segments.join('/');

    // Remove file extension
    const publicId = publicIdWithExtension.replace(/\.[^/.]+$/, '');

    return publicId || null;
  } catch {
    return null;
  }
}

// Delete image from Cloudinary
// Best effort: never interrupts notice operations
async function removeImageFile(imageUrl) {
  try {
    if (!imageUrl) return;

    const publicId = getCloudinaryPublicId(imageUrl);

    // Ignore old local image URLs
    if (!publicId) return;

    checkCloudinaryConfig();

    const timestamp = Math.floor(Date.now() / 1000);

    const params = {
      public_id: publicId,
      timestamp,
    };

    const signature = cloudinarySignature(params);

    const formData = new FormData();

    formData.append('public_id', publicId);
    formData.append('api_key', CLOUDINARY_API_KEY);
    formData.append('timestamp', String(timestamp));
    formData.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`,
      {
        method: 'POST',
        body: formData,
        cache: 'no-store',
      }
    );

    const result = await response.json();

    if (!response.ok || result.result !== 'ok') {
      console.error('Cloudinary deletion failed:', result);
    }
  } catch (error) {
    console.error('Cloudinary image deletion error:', error);
  }
}

// Read multipart or JSON request body
async function readBody(request) {
  const contentType =
    request.headers.get('content-type') || '';

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
      file:
        file &&
        typeof file === 'object' &&
        typeof file.arrayBuffer === 'function' &&
        file.size > 0
          ? file
          : null,
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

/* =========================================
   GET /api/notices
   Admin sees all active notices.
   Other users see audience/department notices.
========================================= */

export async function GET(request) {
  const auth = await requireAuth(request);

  if (auth.error) return auth.error;

  const { user } = auth;

  try {
    const where = {
      isActive: true,
    };

    if (user.role !== 'admin') {
      const audience = ROLE_TO_AUDIENCE[user.role];

      where.AND = [
        {
          OR: [
            { audience: 'ALL' },
            ...(audience && audience !== 'ADMIN'
              ? [{ audience }]
              : []),
          ],
        },
        {
          OR: [
            { departmentId: null },
            ...(user.departmentId
              ? [{ departmentId: user.departmentId }]
              : []),
          ],
        },
      ];
    }

    const notices = await prisma.notice.findMany({
      where,
      include: noticeInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      notices,
      max: MAX_ACTIVE_NOTICES,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/* =========================================
   POST /api/notices
   Admin only
========================================= */

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

    if (!title || !content) {
      return err('শিরোনাম এবং বিষয়বস্তু উভয়ই প্রয়োজন।');
    }

    if (title.length > 150) {
      return err('শিরোনাম সর্বোচ্চ ১৫০ অক্ষরের হতে পারে।');
    }

    if (!VALID_AUDIENCES.includes(audience)) {
      return err('অবৈধ অডিয়েন্স।');
    }

    if (data.departmentId) {
      const dept = await prisma.department.findUnique({
        where: {
          id: data.departmentId,
        },
        select: {
          id: true,
        },
      });

      if (!dept) {
        return err('ডিপার্টমেন্ট পাওয়া যায়নি।');
      }
    }

    const activeCount = await prisma.notice.count({
      where: {
        isActive: true,
      },
    });

    if (activeCount >= MAX_ACTIVE_NOTICES) {
      return err(
        `এক সময় সর্বোচ্চ ${MAX_ACTIVE_NOTICES} টি নোটিস পোস্ট করা যাবে। আগে একটি পুরনো নোটিস ডিলিট করুন।`,
        403
      );
    }

    let imageUrl = data.imageUrl || null;

    if (data.file) {
      savedImage = await saveImage(data.file);
      imageUrl = savedImage;
    }

    const notice = await prisma.notice.create({
      data: {
        title,
        content,
        imageUrl,
        audience,
        departmentId: data.departmentId,
        isActive: true,
        createdById: user.id,
      },
      include: noticeInclude,
    });

    await cacheDel(cacheKey('notices'));

    return NextResponse.json({
      success: true,
      notice,
    });
  } catch (error) {
    if (savedImage) {
      await removeImageFile(savedImage);
    }

    if (error?.userMessage) {
      return err(error.userMessage);
    }

    console.error('Notice POST error:', error);

    return errorResponse(error);
  }
}

/* =========================================
   PUT /api/notices
   Admin only - Edit notice
========================================= */

export async function PUT(request) {
  const auth = await requireAuth(request, ['admin']);

  if (auth.error) return auth.error;

  let savedImage = null;

  try {
    const data = await readBody(request);

    if (!data.id) {
      return err('নোটিস আইডি প্রয়োজন।');
    }

    const existing = await prisma.notice.findUnique({
      where: {
        id: data.id,
      },
    });

    if (!existing) {
      return err('নোটিস পাওয়া যায়নি।', 404);
    }

    const title = String(data.title || '').trim();
    const content = String(data.content || '').trim();
    const audience = data.audience || existing.audience;

    if (!title || !content) {
      return err('শিরোনাম এবং বিষয়বস্তু উভয়ই প্রয়োজন।');
    }

    if (title.length > 150) {
      return err('শিরোনাম সর্বোচ্চ ১৫০ অক্ষরের হতে পারে।');
    }

    if (!VALID_AUDIENCES.includes(audience)) {
      return err('অবৈধ অডিয়েন্স।');
    }

    if (data.departmentId) {
      const dept = await prisma.department.findUnique({
        where: {
          id: data.departmentId,
        },
        select: {
          id: true,
        },
      });

      if (!dept) {
        return err('ডিপার্টমেন্ট পাওয়া যায়নি।');
      }
    }

    let imageUrl = existing.imageUrl;

    if (data.file) {
      savedImage = await saveImage(data.file);
      imageUrl = savedImage;
    } else if (data.removeImage) {
      imageUrl = null;
    }

    const notice = await prisma.notice.update({
      where: {
        id: data.id,
      },
      data: {
        title,
        content,
        audience,
        departmentId: data.departmentId,
        imageUrl,
      },
      include: noticeInclude,
    });

    // Delete previous image only after successful database update
    if (
      imageUrl !== existing.imageUrl &&
      existing.imageUrl
    ) {
      await removeImageFile(existing.imageUrl);
    }

    await cacheDel(cacheKey('notices'));

    return NextResponse.json({
      success: true,
      notice,
    });
  } catch (error) {
    if (savedImage) {
      await removeImageFile(savedImage);
    }

    if (error?.userMessage) {
      return err(error.userMessage);
    }

    console.error('Notice PUT error:', error);

    return errorResponse(error);
  }
}

/* =========================================
   DELETE /api/notices?id=...
   Admin only
========================================= */

export async function DELETE(request) {
  const auth = await requireAuth(request, ['admin']);

  if (auth.error) return auth.error;

  try {
    const id = new URL(request.url).searchParams.get('id');

    if (!id) {
      return err('নোটিস আইডি প্রয়োজন।');
    }

    const notice = await prisma.notice.findUnique({
      where: {
        id,
      },
    });

    if (!notice) {
      return err('নোটিস পাওয়া যায়নি।', 404);
    }

    await prisma.notice.delete({
      where: {
        id,
      },
    });

    await removeImageFile(notice.imageUrl);

    await cacheDel(cacheKey('notices'));

    return NextResponse.json({
      success: true,
      message: 'নোটিস ডিলিট করা হয়েছে।',
    });
  } catch (error) {
    console.error('Notice DELETE error:', error);

    return errorResponse(error);
  }
}
