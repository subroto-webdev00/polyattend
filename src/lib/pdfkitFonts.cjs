/* eslint-disable */
// Why this file exists (PDF downloads used to500 on Vercel with
// `Cannot find module '#standard-fonts/Helvetica'`):
//
// pdfkit 0.20 loads its built-in faces lazily from inside its own package:
//
//     const require$1 = createRequire(import.meta.url);
//     Helvetica: () => require$1('#standard-fonts/Helvetica')
//
// package.json maps that to `./js/standard-fonts/Helvetica.cjs`, so that
// exact file has to exist inside the deployed lambda. Webpack cannot see
// `require$1(...)` (it is not a bare `require` call) and Vercel's file
// tracer cannot resolve `#` specifiers either — so the file was never
// shipped, and every PDF failed.
//
// Requiring the public subpath from CommonJS selects pdfkit's `require`
// export condition, which points at those same `.cjs` files. Because
// pdfkit is listed in `serverExternalPackages`, this call stays a real
// runtime `require`, so the tracer now copies the font files into the
// bundle (verified in `.nft.json`: js/standard-fonts/*.cjs present).
//
// Only the faces `pdfReport.js` actually uses are listed; add a line here
// if a report ever needs Times/Courier/Symbol.
require('pdfkit/standard-fonts/Helvetica');
require('pdfkit/standard-fonts/HelveticaBold');

module.exports = {};
