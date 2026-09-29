import sendEmail from './sendEmail';

// ── FEATURE: Email notifications ───────────────────────────────────────────
// Used for both:
//   1) "Class started" — sent to every student in a class the moment a
//      teacher starts an attendance session (POST /api/sessions).
//   2) "You missed a class" — sent to each student who ended up marked
//      absent when a session is closed (PUT /api/sessions/:id/end).
//
// Sends concurrently and never throws: a slow/broken mail provider, or one
// bad email address, must never fail the session start/end request itself
// (the attendance session is the important part; the email is a courtesy).
// Each recipient's send is isolated with Promise.allSettled.
export async function notifyBulk(students, buildMessage) {
  const recipients = (students || []).filter((s) => s?.email);
  if (recipients.length === 0) return { sent: 0, failed: 0 };

  const results = await Promise.allSettled(
    recipients.map((student) => {
      const { subject, message, html } = buildMessage(student);
      return sendEmail({ email: student.email, subject, message, html });
    })
  );

  const sent = results.filter((r) => r.status === 'fulfilled' && r.value?.success).length;
  return { sent, failed: recipients.length - sent };
}

export function classStartedEmail({ subjectName, subjectCode, teacherName }) {
  const subject = `${subjectName} class has started — Mark Attendance now`;
  const message = `The class for ${subjectName} (${subjectCode}) has just started${teacherName ? ` (${teacherName})` : ''}. Mark your Attendance now.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #1a6b4a; text-align: center;">📚 Class Started!</h2>
      <p>The class for <strong>${subjectName} (${subjectCode})</strong> has just started${teacherName ? `, Teacher: <strong>${teacherName}</strong>` : ''}.</p>
      <div style="background-color: #f0fdf4; border: 2px solid #1a6b4a; border-radius: 8px; padding: 14px; text-align: center; margin: 20px 0;">
        <span style="font-size: 15px; font-weight: bold; color: #1a6b4a;">Mark your Attendance now</span>
      </div>
      <p style="color: #64748b; font-size: 13px;">If you are already present in class, the teacher will mark you present via manual attendance. You can also self check-in through the app.</p>
    </div>`;
  return { subject, message, html };
}

export function classMissedEmail({ subjectName, subjectCode, date }) {
  const dateStr = new Date(date).toLocaleDateString('en-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const subject = `You missed a class for ${subjectName}`;
  const message = `You have been marked Absent in the ${subjectName} (${subjectCode}) class on ${dateStr}.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #991b1b; text-align: center;">⚠️ Class Missed</h2>
      <p>You have been marked <strong style="color:#991b1b;">Absent</strong> in the <strong>${subjectName} (${subjectCode})</strong> class on <strong>${dateStr}</strong>.</p>
      <p style="color: #64748b; font-size: 13px;">Keeping regular attendance is important — if your attendance falls below a certain percentage, you will not be able to sit for the exam. You can view your overall attendance on the "Attendance" page in the app.</p>
    </div>`;
  return { subject, message, html };
}

// ── FEATURE: Invite code emails ─────────────────────────────────────────
// Used for the whole hierarchy invite flow: Admin ->
// Department Admin -> Teacher, and Semester
// Admin → Student pre-approval. Each recipient gets a 12-character
// alphanumeric code (valid 1 month) to complete their own registration
// with just Email + Code (+ Password, + Roll for students).
const ROLE_LABEL = {
  semesterAdmin: 'Department Admin',
  teacher: 'Teacher',
  student: 'Student',
};

export function inviteCodeEmail({ name, role, code }) {
  const roleLabel = ROLE_LABEL[role] || role;
  const subject = `PolyAttend — ${roleLabel} Registration Code`;
  const message = `Hello ${name},\n\nYou have been added to PolyAttend as a ${roleLabel}. Use the code below to complete your registration:\n\nCode: ${code}\n\nThis code is valid for 1 month. Go to the Registration page and complete registration using your Email and this Code.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #1a6b4a; text-align: center;">Welcome to PolyAttend</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>You have been added to PolyAttend as a <strong>${roleLabel}</strong>. Use the code below to complete your registration:</p>
      <div style="background-color: #f0fdf4; border: 2px dashed #1a6b4a; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0;">
        <span style="font-size: 22px; font-weight: bold; color: #1a6b4a; letter-spacing: 3px; font-family: monospace;">${code}</span>
      </div>
      <p style="color: #64748b; font-size: 13px;">This code is valid for 1 month. Go to the Registration page and complete registration using your Email and this Code. Do not share this code with anyone other than yourself.</p>
    </div>`;
  return { subject, message, html };
}
