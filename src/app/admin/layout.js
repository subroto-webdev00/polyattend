'use client';
import RequireRole from '@/components/common/RequireRole';
import AppShell from '@/components/common/AppShell';

const navItems = [
  { label: 'Dashboard', icon: 'dashboard', path: '/admin' },
  { section: 'Management' },
  { label: 'Users', icon: 'users', path: '/admin/users' },
  { label: 'Department Admin', icon: 'users', path: '/admin/sub-admins' },
  { label: 'Departments', icon: 'department', path: '/admin/departments' },
  { label: 'Subjects', icon: 'book', path: '/admin/subjects' },
  { label: 'Holidays', icon: 'calendar', path: '/admin/holidays' },
  { section: 'Monitoring' },
  { label: 'Missed Classes Report', icon: 'clock', path: '/admin/missed-classes' },
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
