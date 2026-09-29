-- ============================================================================
-- PolyAttend - production schema sync
--
-- Brings the Neon database in line with prisma/schema.prisma:
--
--   * Role / InviteRole: 'semesterAdmin' renamed to 'departmentAdmin'
--   * Role / InviteRole: the old 'subAdmin' value removed entirely
--   * admin_invites.invited_by becomes nullable (ON DELETE SET NULL)
--   * the six foreign keys that were never created in production
--
-- Written for PostgreSQL 18, which is what Neon is running.
--
-- WHY RENAME VALUE AND NOT A RECREATED TYPE
-- The usual Prisma output for an enum change rebuilds the type, which rewrites
-- every row and takes an ACCESS EXCLUSIVE lock on the table for the duration.
-- On a live database that is exactly the kind of change you do not want to
-- discover during a login. `ALTER TYPE ... RENAME VALUE` is a metadata-only
-- catalog edit: it is instant, it never touches a row, and the stored text
-- stays byte-for-byte identical. Every WHERE clause, every index and every
-- existing row keeps working — only the label changes.
--
-- Only dropping 'subAdmin' genuinely needs the type rebuilt, because a value
-- cannot be removed in place. That part is wrapped in a DO block that first
-- moves any remaining rows off the value and then aborts if it could not, so
-- the rebuild can never fail halfway with half the users renamed.
--
-- The whole thing is idempotent: re-running it is a no-op, so it is safe to
-- run more than once.
--
-- Verified against a byte-for-byte restore of the real production dump.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. semesterAdmin -> departmentAdmin (metadata-only, instant, no row rewrite)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Role', 'InviteRole'] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type ty ON ty.oid = e.enumtypid
      WHERE ty.typname = t AND e.enumlabel = 'semesterAdmin'
    ) THEN
      EXECUTE format('ALTER TYPE %I RENAME VALUE %L TO %L', t, 'semesterAdmin', 'departmentAdmin');
      RAISE NOTICE '%: renamed semesterAdmin -> departmentAdmin', t;
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Clear the removed 'subAdmin' value before the type loses it.
--    The old Department Admin role was deleted from the product; the surviving
--    account is folded into the department-wide admin rather than dropped, so
--    its login and history survive.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  n integer;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
             WHERE t.typname = 'Role' AND e.enumlabel = 'subAdmin') THEN
    UPDATE users SET role = 'departmentAdmin'::"Role" WHERE role = 'subAdmin'::"Role";
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      RAISE NOTICE 'users: moved % row(s) from subAdmin to departmentAdmin', n;
    END IF;

    -- Hard stop rather than let the rebuild below fail with a cast error.
    IF EXISTS (SELECT 1 FROM users WHERE role::text = 'subAdmin') THEN
      RAISE EXCEPTION 'aborting: a user still has role subAdmin';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
             WHERE t.typname = 'InviteRole' AND e.enumlabel = 'subAdmin') THEN
    UPDATE admin_invites SET role = 'departmentAdmin'::"InviteRole" WHERE role = 'subAdmin'::"InviteRole";
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      RAISE NOTICE 'admin_invites: moved % row(s) from subAdmin to departmentAdmin', n;
    END IF;

    IF EXISTS (SELECT 1 FROM admin_invites WHERE role::text = 'subAdmin') THEN
      RAISE EXCEPTION 'aborting: an admin_invite still has role subAdmin';
    END IF;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Drop the 'subAdmin' value from both enums. This is the only step that
--    rewrites a table, and it is skipped entirely when the value is already
--    gone (which is the normal case).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  has_role    boolean;
  has_invite  boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'Role' AND e.enumlabel = 'subAdmin')    INTO has_role;
  SELECT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'InviteRole' AND e.enumlabel = 'subAdmin') INTO has_invite;

  IF has_role THEN
    CREATE TYPE "Role_new" AS ENUM ('admin', 'departmentAdmin', 'teacher', 'student');
    ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
    ALTER TYPE "Role" RENAME TO "Role_old";
    ALTER TYPE "Role_new" RENAME TO "Role";
    DROP TYPE "public"."Role_old";
    RAISE NOTICE 'Role: dropped the subAdmin value';
  END IF;

  IF has_invite THEN
    CREATE TYPE "InviteRole_new" AS ENUM ('departmentAdmin', 'teacher');
    ALTER TABLE "admin_invites" ALTER COLUMN "role" TYPE "InviteRole_new" USING ("role"::text::"InviteRole_new");
    ALTER TYPE "InviteRole" RENAME TO "InviteRole_old";
    ALTER TYPE "InviteRole_new" RENAME TO "InviteRole";
    DROP TYPE "public"."InviteRole_old";
    RAISE NOTICE 'InviteRole: dropped the subAdmin value';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. admin_invites.invited_by becomes nullable, so deleting a user who sent
--    invites sets it to NULL instead of being blocked.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admin_invites' AND column_name = 'invited_by'
      AND is_nullable = 'NO'
  ) THEN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_invites_invited_by_fkey') THEN
      ALTER TABLE "admin_invites" DROP CONSTRAINT "admin_invites_invited_by_fkey";
    END IF;
    ALTER TABLE "admin_invites" ALTER COLUMN "invited_by" DROP NOT NULL;
    ALTER TABLE "admin_invites" ADD CONSTRAINT "admin_invites_invited_by_fkey"
      FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    RAISE NOTICE 'admin_invites.invited_by is now nullable';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. The six foreign keys that were never created in production.
--    Written out one by one rather than looped: this script runs against a
--    live database, and a plain IF EXISTS per key is something a reviewer can
--    check line by line without reasoning about array indexing.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_pre_approvals_added_by_fkey') THEN
    ALTER TABLE "student_pre_approvals" ADD CONSTRAINT "student_pre_approvals_added_by_fkey"
      FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    RAISE NOTICE 'added student_pre_approvals_added_by_fkey';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_pre_approvals_used_by_user_id_fkey') THEN
    ALTER TABLE "student_pre_approvals" ADD CONSTRAINT "student_pre_approvals_used_by_user_id_fkey"
      FOREIGN KEY ("used_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    RAISE NOTICE 'added student_pre_approvals_used_by_user_id_fkey';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pending_registrations_department_id_fkey') THEN
    ALTER TABLE "pending_registrations" ADD CONSTRAINT "pending_registrations_department_id_fkey"
      FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    RAISE NOTICE 'added pending_registrations_department_id_fkey';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pending_registrations_shadow_student_id_fkey') THEN
    ALTER TABLE "pending_registrations" ADD CONSTRAINT "pending_registrations_shadow_student_id_fkey"
      FOREIGN KEY ("shadow_student_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    RAISE NOTICE 'added pending_registrations_shadow_student_id_fkey';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ignored_misses_subject_id_fkey') THEN
    ALTER TABLE "ignored_misses" ADD CONSTRAINT "ignored_misses_subject_id_fkey"
      FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    RAISE NOTICE 'added ignored_misses_subject_id_fkey';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ignored_misses_ignored_by_fkey') THEN
    ALTER TABLE "ignored_misses" ADD CONSTRAINT "ignored_misses_ignored_by_fkey"
      FOREIGN KEY ("ignored_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    RAISE NOTICE 'added ignored_misses_ignored_by_fkey';
  END IF;
END $$;

COMMIT;
