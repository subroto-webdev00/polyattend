import TeacherManagement from '@/components/departmentAdmin/TeacherManagement';

// Teacher Management for a Department Admin. The list is scoped to the caller's
// own Department by the API, so there is no filter to configure here, and
// there is no Create form — making a Teacher is a Super Admin action.
export default function Page() {
  return <TeacherManagement />;
}
