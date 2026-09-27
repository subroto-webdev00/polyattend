import { NextResponse } from 'next/server';

// ── Report file delivery ───────────────────────────────────────────────────
// Every report route used to answer with JSON no matter what the client asked
// for, so a "report.pdf" / "report.xlsx" download was really a JSON file with
// the wrong extension — Excel and Acrobat both refuse to open it.
//
// This helper centralises the format decision so all three report routes
// behave identically:
//
//   ?format=pdf   -> real PDF   (application/pdf)
//   ?format=xlsx  -> real XLSX  (application/vnd.openxmlformats-...)
//   ?format=json  -> the raw JSON payload (kept for debugging / future use)
//   no format     -> XLSX, because every current caller is a file download
//
// `filename` is used for Content-Disposition so the browser picks a sensible
// name even before the frontend sets its own.

export function wantsJson(request) {
  return new URL(request.url).searchParams.get('format') === 'json';
}

export function wantsPdf(request) {
  return new URL(request.url).searchParams.get('format') === 'pdf';
}

export function fileResponse(buffer, filename, kind) {
  const types = {
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  const ext = kind === 'pdf' ? 'pdf' : 'xlsx';
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': types[kind],
      'Content-Disposition': `attachment; filename="${filename}.${ext}"`,
      'Content-Length': String(buffer.byteLength ?? buffer.length ?? 0),
      // Reports are per-user and per-instant; never let a proxy or the
      // browser hand back a stale copy of somebody else's attendance.
      'Cache-Control': 'no-store',
    },
  });
}
