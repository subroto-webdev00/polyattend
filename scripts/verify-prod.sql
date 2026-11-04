-- Verify the production schema matches what the app expects.
-- READ-ONLY: every statement below is a SELECT. Safe to run repeatedly.
--
-- Run this in Neon -> SQL Editor after prod-schema-sync.sql.
-- Everything must come back PASS. Any FAIL means the app will break there.

\echo '=== 1. Role enum values — must be exactly admin, departmentAdmin, teacher, student ==='
SELECT string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS role_values
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname = 'Role'
GROUP BY t.typname;

\echo '=== 2. InviteRole enum values — must be exactly departmentAdmin, teacher ==='
SELECT string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS invite_role_values
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname = 'InviteRole'
GROUP BY t.typname;

\echo '=== 3. No user may still hold a removed role ==='
SELECT COUNT(*) AS users_with_removed_role,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS verdict
FROM users
WHERE role::text IN ('semesterAdmin', 'subAdmin');

\echo '=== 4. No invite may still hold a removed role ==='
SELECT COUNT(*) AS invites_with_removed_role,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS verdict
FROM admin_invites
WHERE role::text IN ('semesterAdmin', 'subAdmin');

\echo '=== 5. Accounts per role ==='
SELECT role::text AS role, COUNT(*) AS accounts
FROM users
GROUP BY role
ORDER BY accounts DESC;

\echo '=== 6. Departments must have admins in the expected roles ==='
SELECT
  COUNT(*) FILTER (WHERE role = 'admin')            AS super_admins,
  COUNT(*) FILTER (WHERE role = 'departmentAdmin')  AS department_admins,
  COUNT(*) FILTER (WHERE role = 'teacher')          AS teachers,
  COUNT(*) FILTER (WHERE role = 'student')          AS students
FROM users;

\echo '=== 7. Department Admin accounts must cover all 8 semesters ==='
-- The app grants semesters = [1..8] to a department-wide admin. If a row was
-- migrated from the old narrow role it may carry a single semester instead,
-- which silently hides most of their Student Validation tabs.
SELECT
  name,
  email,
  department_id,
  shift::text AS shift,
  COALESCE(array_length(semesters, 1), 0) AS semester_count,
  CASE
    WHEN COALESCE(array_length(semesters, 1), 0) = 8 THEN 'PASS'
    ELSE 'FAIL - covers only ' || COALESCE(array_length(semesters, 1), 0) || ' semester(s)'
  END AS verdict
FROM users
WHERE role = 'departmentAdmin'
ORDER BY name;

\echo '=== 8. Teachers must have a shift ==='
-- Create Teacher requires a Shift now, and Assign Subject reuses it. A NULL
-- shift means that teacher falls back to inheriting their first Subject's.
SELECT COUNT(*) AS teachers_without_shift,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS verdict
FROM users
WHERE role = 'teacher' AND shift IS NULL;

\echo '=== 9. Sections must all be a valid Group (A/B/C/D) ==='
SELECT COUNT(*) AS students_with_bad_group,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS verdict
FROM users
WHERE role = 'student'
  AND section IS NOT NULL
  AND section::text NOT IN ('A', 'B', 'C', 'D');

\echo '=== 10. Column presence the app relies on ==='
SELECT
  COUNT(*) FILTER (WHERE table_name = 'users'         AND column_name = 'semesters')    AS users_semesters,
  COUNT(*) FILTER (WHERE table_name = 'users'         AND column_name = 'student_id')   AS users_student_id,
  COUNT(*) FILTER (WHERE table_name = 'sessions'      AND column_name = 'start_time')   AS sessions_start_time,
  COUNT(*) FILTER (WHERE table_name = 'sessions'      AND column_name = 'end_time')     AS sessions_end_time,
  COUNT(*) FILTER (WHERE table_name = 'sessions'      AND column_name = 'substitute_by') AS sessions_substitute_by,
  COUNT(*) FILTER (WHERE table_name = 'attendances'   AND column_name = 'scanned_at')   AS attendances_scanned_at,
  CASE WHEN COUNT(*) = 7 THEN 'PASS' ELSE 'FAIL - a column is missing' END AS verdict
FROM information_schema.columns
WHERE (table_name, column_name) IN (
  ('users', 'semesters'), ('users', 'student_id'),
  ('sessions', 'start_time'), ('sessions', 'end_time'), ('sessions', 'substitute_by'),
  ('attendances', 'scanned_at'), ('attendances', 'marked_by')
);

\echo '=== 11. Attendance rows must never be orphaned ==='
-- Attendance -> Session is a required FK. Orphaned rows mean a session was
-- deleted without its marks, which would break every student's percentage.
SELECT COUNT(*) AS orphaned_attendance,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS verdict
FROM attendances a
LEFT JOIN sessions s ON s.id = a.session_id
WHERE s.id IS NULL;

\echo '=== 12. Data volume — should be non-zero on a live production DB ==='
SELECT
  (SELECT COUNT(*) FROM users)             AS users,
  (SELECT COUNT(*) FROM subjects)          AS subjects,
  (SELECT COUNT(*) FROM sessions)          AS sessions,
  (SELECT COUNT(*) FROM attendances)       AS attendances,
  (SELECT COUNT(*) FROM departments)       AS departments;
