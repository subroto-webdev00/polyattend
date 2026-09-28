import AdminTeachers from '@/components/admin/AdminTeachers';

// Super Admin view of Teachers. Creating a Teacher is an Admin-only action
// (a Super Admin has no Department or Shift of their own to inherit, so both
// are picked in the form), and the list spans the whole institution.
export default function Page() {
  return <AdminTeachers />;
}
