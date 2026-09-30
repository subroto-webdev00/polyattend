import DepartmentAdminsManager from '@/components/departmentAdmin/DepartmentAdminsManager';

// Super Admin view of Department Admins. This is the only place one can be
// created — a Department Admin's own scope is a single Department + Shift, so
// they have nothing to hire into.
export default function Page() {
  return <DepartmentAdminsManager />;
}
