import AdminUsers from '@/components/admin/AdminUsers';

// Department Admin sees Semester Admins, Teachers, and Students — but only within
// their own Department+Shift, which /api/users enforces server-side.
export default function Page() {
  return (
    <AdminUsers
      roleFilters={['all', 'semesterAdmin', 'teacher', 'student']}
      title="Users"
      subtitle="All Semester Admins, Teachers and Students in your Department and Shift"
    />
  );
}
