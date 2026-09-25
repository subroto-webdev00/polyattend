'use client';
import RequireRole from '@/components/common/RequireRole';
import AppShell from '@/components/common/AppShell';

const navItems = [
  { label: 'Dashboard', icon: 'dashboard', path: '/subAdmin' },
  { section: 'Management' },
  { label: 'Semester Admin', icon: 'users', path: '/subAdmin/semester-admins' },
  { label: 'Teachers', icon: 'school', path: '/subAdmin/teachers' },
  { label: 'Users', icon: 'users', path: '/subAdmin/users' },
  { section: 'Monitoring' },
  { label: 'Missed Classes Report', icon: 'clock', path: '/subAdmin/missed-classes' },
  { section: 'Analytics' },
  { label: 'Reports', icon: 'chart', path: '/subAdmin/reports' },
  { section: 'Tools' },
  { label: 'Search Profile', icon: 'phone', path: '/subAdmin/search-mobile' },
];

export default function SubAdminRootLayout({ children }) {
  return (
    <RequireRole roles={['subAdmin']}>
      <AppShell navItems={navItems}>{children}</AppShell>
    </RequireRole>
  );
}
