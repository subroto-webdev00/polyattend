'use client';

// Shrink a picture in the browser before it is uploaded.
//
// Two reasons this matters:
//  1. Vercel caps request bodies at 4.5 MB, so a raw phone photo (often
//     4-8 MB) never even reaches the API route.
//  2. Notices keep a maximum of two active posts, but the image is stored in
//     the database when Cloudinary is unavailable — small files keep queries
//     fast and the Neon row limits happy.
//
// Returns the original File untouched when compression is not possible or not
// worthwhile (e.g. GIFs, where re-encoding would flatten the animation).

const MAX_DIMENSION = 1600;
const QUALITY = 0.82;

export default async function compressImage(file) {
  if (!file || typeof file === 'undefined') return file;
  if (file.type === 'image/gif') return file;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type || '')) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    if (scale === 1 && file.size < 300 * 1024) {
      bitmap.close?.();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const ctx = canvas.getContext('2d');
    // JPEG has no alpha channel; paint white so transparent PNGs do not
    // come out with a black background.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY)
    );

    if (!blob || blob.size >= file.size) return file;

    const baseName = (file.name || 'notice').replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
