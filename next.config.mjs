import withSerwistInit from '@serwist/next';

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client'],

  // The middle role was renamed from "Semester Admin" to "Department Admin"
  // and its routes moved with it. Anyone holding an old bookmark — or a link
  // from an old email or chat — should land on the new page instead of a 404.
  // `permanent: false` is a 307, so the browser re-checks on the next visit
  // rather than caching the hop forever.
  //
  // Order matters: Next.js applies the first match, so the two paths that also
  // changed their own segment are listed before the catch-all that just moves
  // the prefix.
  //
  // API routes are deliberately NOT redirected: a stale client hitting an old
  // API path should fail loudly rather than be silently pointed at a
  // different handler.
  async redirects() {
    return [
      { source: '/semesterAdmin/semester-admins', destination: '/departmentAdmin/department-admins', permanent: false },
      { source: '/admin/semester-admins', destination: '/admin/department-admins', permanent: false },
      { source: '/semesterAdmin/:path*', destination: '/departmentAdmin/:path*', permanent: false },
      { source: '/semesterAdmin', destination: '/departmentAdmin', permanent: false },
    ];
  },

  // Security headers applied to every route (pages + API).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.js',
  swDest: 'public/sw.js',
  register: true,
  disable: process.env.NODE_ENV === 'development',
});

export default withSerwist(nextConfig);
