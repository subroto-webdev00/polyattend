import AdminUsers from '@/components/admin/AdminUsers';

// Department Admin sees Teachers and Students only, scoped to their own
// Department+Shift+Semester by /api/users server-side.
export default function Page() {
  return (
    <AdminUsers
      roleFilters={['all', 'teacher', 'student']}
      title="Users"
      subtitle="All Teachers and Students in your Department, Shift and Semester"
    />
  );
}
