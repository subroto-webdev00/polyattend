// Normalize Prisma's separate foreign keys + relations into the populated
// document shape used throughout the existing frontend.
//
// Why this exists: the frontend was written against the old Mongo-style
// documents where `subjectId`/`teacherId`/`departmentId` WERE the populated
// objects (and `_id` was the primary key). Prisma returns scalar foreign
// keys plus separate relation fields, so any route that hands a raw session
// to a component makes it render a UUID where a name belongs ("Unknown
// Subject", a department id in the subtitle) — and `session._id` comes back
// undefined, which silently disabled the student's "I am Present" button
// (its handler returns early when `_id` is missing).
export function normalizeSession(session) {
  if (!session) return session;
  return {
    ...session,
    _id: session.id,
    teacherId: session.teacher
      ? { ...session.teacher, _id: session.teacher.id || session.teacher._id }
      : session.teacherId,
    departmentId: session.department
      ? { ...session.department, _id: session.department.id }
      : session.departmentId,
    subjectId: session.subject
      ? { ...session.subject, _id: session.subject.id }
      : session.subjectId,
  };
}
