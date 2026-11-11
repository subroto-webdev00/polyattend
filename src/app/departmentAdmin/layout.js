'use client';
import RequireRole from '@/components/common/RequireRole';
import AppShell from '@/components/common/AppShell';

const navItems = [
  { label: 'Dashboard', icon: 'dashboard', path: '/departmentAdmin' },
  { label: 'Notice', icon: 'megaphone', path: '/departmentAdmin/notices' },
  { section: 'Management' },
  { label: 'Teacher Management', icon: 'users', path: '/departmentAdmin/teachers' },
  { label: 'Subject', icon: 'book', path: '/departmentAdmin/subjects' },
  { label: 'Student Validation', icon: 'users', path: '/departmentAdmin/students' },
  { label: 'Semester Promotion', icon: 'chevronRight', path: '/departmentAdmin/promotion' },
  { label: 'Users', icon: 'users', path: '/departmentAdmin/users' },
  { section: 'Monitoring' },
  { label: 'Class Report', icon: 'clock', path: '/departmentAdmin/missed-classes' },
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
