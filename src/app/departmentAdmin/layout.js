'use client';
import RequireRole from '@/components/common/RequireRole';
import AppShell from '@/components/common/AppShell';

const navItems = [
  { label: 'Dashboard', icon: 'dashboard', path: '/departmentAdmin' },
  { section: 'Management' },
  { label: 'Department Admins', icon: 'users', path: '/departmentAdmin/department-admins' },
  { label: 'Teacher Management', icon: 'school', path: '/departmentAdmin/teachers' },
  { label: 'Student Validation', icon: 'users', path: '/departmentAdmin/students' },
  { label: 'Semester Promotion', icon: 'chevronRight', path: '/departmentAdmin/promotion' },
  { label: 'Users', icon: 'users', path: '/departmentAdmin/users' },
  { section: 'Monitoring' },
  { label: 'Missed Classes Report', icon: 'clock', path: '/departmentAdmin/missed-classes' },
  { section: 'Analytics' },
  { label: 'Reports', icon: 'chart', path: '/departmentAdmin/reports' },
  { section: 'Tools' },
  { label: 'Search Profile', icon: 'phone', path: '/departmentAdmin/search-mobile' },
];

export default function DepartmentAdminRootLayout({ children }) {
  return (
    <RequireRole roles={['departmentAdmin']}>
      <AppShell navItems={navItems}>{children}</AppShell>
    </RequireRole>
  );
}
