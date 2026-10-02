'use client';
import RequireRole from '@/components/common/RequireRole';
import AppShell from '@/components/common/AppShell';

const navItems = [
  { label: 'Dashboard', icon: 'dashboard', path: '/admin' },
  { section: 'Management' },
  { label: 'Users', icon: 'users', path: '/admin/users' },
  { label: 'Department Admins', icon: 'users', path: '/admin/department-admins' },
  { label: 'Teachers', icon: 'school', path: '/admin/teachers' },
  { label: 'Departments', icon: 'department', path: '/admin/departments' },
  { label: 'Subjects', icon: 'book', path: '/admin/subjects' },
  { label: 'Holidays', icon: 'calendar', path: '/admin/holidays' },
  { section: 'Monitoring' },
  { label: 'Class Report', icon: 'clock', path: '/admin/missed-classes' },
  { section: 'Analytics' },
  { label: 'Reports', icon: 'chart', path: '/admin/reports' },
  { section: 'System' },
  { label: 'Search Profile', icon: 'phone', path: '/admin/search-mobile' },
  { label: 'Settings', icon: 'settings', path: '/admin/settings' },
];

export default function AdminRootLayout({ children }) {
  return (
    <RequireRole roles={['admin']}>
      <AppShell navItems={navItems}>{children}</AppShell>
    </RequireRole>
  );
}
