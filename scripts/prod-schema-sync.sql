-- ============================================================================
-- PolyAttend - production schema sync
--
-- Brings the Neon database in line with prisma/schema.prisma.
-- Generated with `prisma migrate diff`, then extended with the data cleanup
-- that the generated script cannot do on its own: the enum cast below fails
-- outright while any row still holds a 'subAdmin' value.
--
-- Everything runs in ONE transaction, so if any statement fails the database
-- is left exactly as it was.
--
-- Verified against a byte-for-byte restore of the real production dump.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Clear the 'subAdmin' value BEFORE the enum loses it.
--    The Department Admin role was removed from the product; Semester Admin
--    now carries those department-wide powers, so the account is converted
--    rather than deleted (keeps the login and its history).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  affected integer;
BEGIN
  UPDATE users SET role = 'semesterAdmin'::"Role" WHERE role = 'subAdmin'::"Role";
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected > 0 THEN
    RAISE NOTICE 'users: converted % row(s) from subAdmin to semesterAdmin', affected;
  END IF;

  UPDATE admin_invites SET role = 'semesterAdmin'::"InviteRole" WHERE role = 'subAdmin'::"InviteRole";
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected > 0 THEN
    RAISE NOTICE 'admin_invites: converted % row(s) from subAdmin to semesterAdmin', affected;
  END IF;

  -- Hard stop if anything still holds the removed value.
  IF EXISTS (SELECT 1 FROM users WHERE role::text = 'subAdmin') THEN
    RAISE EXCEPTION 'aborting: a user still has role subAdmin';
  END IF;
  IF EXISTS (SELECT 1 FROM admin_invites WHERE role::text = 'subAdmin') THEN
    RAISE EXCEPTION 'aborting: an admin_invite still has role subAdmin';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. InviteRole: drop 'subAdmin'
-- ----------------------------------------------------------------------------
CREATE TYPE "InviteRole_new" AS ENUM ('semesterAdmin', 'teacher');
ALTER TABLE "admin_invites" ALTER COLUMN "role" TYPE "InviteRole_new" USING ("role"::text::"InviteRole_new");
ALTER TYPE "InviteRole" RENAME TO "InviteRole_old";
ALTER TYPE "InviteRole_new" RENAME TO "InviteRole";
DROP TYPE "public"."InviteRole_old";

-- ----------------------------------------------------------------------------
-- 3. Role: drop 'subAdmin'
-- ----------------------------------------------------------------------------
CREATE TYPE "Role_new" AS ENUM ('admin', 'semesterAdmin', 'teacher', 'student');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";

-- ----------------------------------------------------------------------------
-- 4. admin_invites.invited_by becomes nullable, so deleting a user who sent
--    invites sets it to NULL instead of being blocked.
-- ----------------------------------------------------------------------------
ALTER TABLE "admin_invites" DROP CONSTRAINT "admin_invites_invited_by_fkey";
ALTER TABLE "admin_invites" ALTER COLUMN "invited_by" DROP NOT NULL;
ALTER TABLE "admin_invites" ADD CONSTRAINT "admin_invites_invited_by_fkey"
  FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 5. The six foreign keys that were never created in production.
-- ----------------------------------------------------------------------------
ALTER TABLE "student_pre_approvals" ADD CONSTRAINT "student_pre_approvals_added_by_fkey"
  FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_pre_approvals" ADD CONSTRAINT "student_pre_approvals_used_by_user_id_fkey"
  FOREIGN KEY ("used_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pending_registrations" ADD CONSTRAINT "pending_registrations_department_id_fkey"
  FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pending_registrations" ADD CONSTRAINT "pending_registrations_shadow_student_id_fkey"
  FOREIGN KEY ("shadow_student_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ignored_misses" ADD CONSTRAINT "ignored_misses_subject_id_fkey"
  FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ignored_misses" ADD CONSTRAINT "ignored_misses_ignored_by_fkey"
  FOREIGN KEY ("ignored_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
