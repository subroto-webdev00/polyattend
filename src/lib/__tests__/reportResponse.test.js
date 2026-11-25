import { describe, it, expect } from 'vitest';
import { wantsJson, wantsPdf, fileResponse } from '../reportResponse';

const req = (url) => ({ url });

describe('format negotiation', () => {
  it('detects ?format=json and ?format=pdf', () => {
    expect(wantsJson(req('http://x/api/reports/class/1?format=json'))).toBe(true);
    expect(wantsJson(req('http://x/api/reports/class/1'))).toBe(false);
    expect(wantsPdf(req('http://x/api/reports/class/1?format=pdf'))).toBe(true);
    expect(wantsPdf(req('http://x/api/reports/class/1?format=xlsx'))).toBe(false);
  });
});

describe('fileResponse', () => {
  const buffer = Buffer.from('%PDF-1.4 fake');

  it('serves a real PDF with a download filename', async () => {
    const res = fileResponse(buffer, 'class-report', 'pdf');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="class-report.pdf"');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Content-Length')).toBe(String(buffer.length));
    expect((await res.text()).startsWith('%PDF-')).toBe(true);
  });

  it('defaults to the XLSX type and extension for anything non-pdf', async () => {
    const res = fileResponse(buffer, 'student-report', 'xlsx');
    expect(res.headers.get('Content-Type'))
      .toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="student-report.xlsx"');
  });

  it('names unknown kinds as .xlsx (the default download)', () => {
    const res = fileResponse(buffer, 'report', undefined);
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="report.xlsx"');
  });
});
