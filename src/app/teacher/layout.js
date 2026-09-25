'use client';
import RequireRole from '@/components/common/RequireRole';
import AppShell from '@/components/common/AppShell';

const navItems = [
  { label: 'Dashboard', icon: 'dashboard', path: '/teacher' },
  { label: 'Subject', icon: 'book', path: '/teacher/subjects' },
  { label: 'Students', icon: 'users', path: '/teacher/students' },
  { label: 'Take Attendance', icon: 'clipboard', path: '/teacher/attendance' },
  { label: 'Covered Miss Class', icon: 'play', path: '/teacher/covered-miss-class' },
  { label: 'Session History', icon: 'history', path: '/teacher/sessions' },
  { label: 'Reports', icon: 'chart', path: '/teacher/export' },
  { label: 'Search Profile', icon: 'phone', path: '/teacher/search-mobile' },
];

export default function TeacherRootLayout({ children }) {
  return (
    <RequireRole roles={['teacher']}>
      <AppShell navItems={navItems}>{children}</AppShell>
    </RequireRole>
  );
}
