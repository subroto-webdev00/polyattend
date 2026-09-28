'use client';
import RequireRole from '@/components/common/RequireRole';
import AppShell from '@/components/common/AppShell';

const navItems = [
  { label: 'Dashboard', icon: 'dashboard', path: '/semesterAdmin' },
  { section: 'Management' },
  { label: 'Semester Admins', icon: 'users', path: '/semesterAdmin/semester-admins' },
  { label: 'Student Validation', icon: 'users', path: '/semesterAdmin/students' },
  { label: 'Semester Promotion', icon: 'chevronRight', path: '/semesterAdmin/promotion' },
  { label: 'Users', icon: 'users', path: '/semesterAdmin/users' },
  { section: 'Monitoring' },
  { label: 'Missed Classes Report', icon: 'clock', path: '/semesterAdmin/missed-classes' },
  { section: 'Analytics' },
  { label: 'Reports', icon: 'chart', path: '/semesterAdmin/reports' },
  { section: 'Tools' },
  { label: 'Search Profile', icon: 'phone', path: '/semesterAdmin/search-mobile' },
];

export default function SemesterAdminRootLayout({ children }) {
  return (
    <RequireRole roles={['semesterAdmin']}>
      <AppShell navItems={navItems}>{children}</AppShell>
    </RequireRole>
  );
}
