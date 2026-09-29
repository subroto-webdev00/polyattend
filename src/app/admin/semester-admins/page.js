import SemesterAdminsManager from '@/components/semesterAdmin/SemesterAdminsManager';

// Super Admin view of Department Admins. `isAdmin` switches the shared
// component to institution-wide scope and adds the Department / Shift
// pickers to the invite form, since a Super Admin has neither of their own.
export default function Page() {
  return <SemesterAdminsManager isAdmin />;
}
