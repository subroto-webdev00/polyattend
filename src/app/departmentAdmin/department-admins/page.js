import DepartmentAdminsManager from '@/components/departmentAdmin/DepartmentAdminsManager';

// Department Admins are department-wide, so they manage the other Semester
// Admins in their own department + shift. This page used to belong to the
// old role split.
export default function Page() {
  return <DepartmentAdminsManager />;
}
