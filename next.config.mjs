import withSerwistInit from '@serwist/next';

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client'],

  // Build memory ceiling. "Collecting page data" spawns one worker per CPU,
  // and on a machine with a few GB free that fan-out is what gets the whole
  // build OOM-killed part-way through (it dies after "Compiled successfully",
  // silently, with no error). Capping to 2 workers trades a little build
  // time for a build that actually finishes. Raise it on a roomier machine.
  experimental: {
    cpus: 2,
    workerThreads: false,
  },

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
  // `disable` is set in dev, but the real hazard was the opposite direction: a
  // production build leaves an already-registered worker in the browser, and it
  // then keeps serving stale JS/CSS to `pnpm dev` after the source changes.
  // Bumping the cache name on every build makes a previously-installed worker
  // stop matching immediately instead of pinning the old assets for days.
  register: true,
  disable: process.env.NODE_ENV === 'development',
  cacheOnNavigation: true,
  reloadOnOnline: false,
});

export default withSerwist(nextConfig);
