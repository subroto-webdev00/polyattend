import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import ToasterClient from '@/components/common/ToasterClient';

export const metadata = {
  applicationName: 'PolyAttend',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PolyAttend',
  },
  title: {
    default: 'PolyAttend — Thakurgaon Polytechnic Institute',
    template: '%s | PolyAttend',
  },
  description: 'PolyAttend is a Smart Attendance Management System built exclusively for Thakurgaon Polytechnic Institute (TPI), Bangladesh. ' +
    'Admin has full control over the entire system — managing departments, shifts, department admins, system settings, holidays, and generating institution-wide attendance reports. ' +
    'Department Admin manages an entire department and shift — creating other department admins, adding and approving students, assigning teachers to subjects across every semester, promoting students to the next semester, and monitoring department-wide attendance. ' +
    'Teachers can start live attendance sessions for their class — students are notified instantly and can mark themselves present by scanning a QR code or through a self-mark button. Teachers can also mark students present manually by searching by name or student ID, view session history, generate subject-wise attendance reports, and export data as PDF or Excel. ' +
    'Students can view their real-time attendance percentage for each subject, see their full attendance history, check which sessions they were present or absent, and receive instant notifications when a teacher starts a session for their class. ' +
    'Core features include QR-based session attendance, real-time self-mark, manual attendance by teacher, role-based dashboards for four user types, department and subject management, semester promotion system, holiday management, email OTP verification for secure registration and login, two-factor authentication for admin roles, rate-limited login protection, automated PDF and Excel report generation, and a fully responsive mobile-friendly interface. ' +
    'PolyAttend is accessible on both desktop and mobile, and is live at polyattend-system2026.vercel.app.',
  keywords: [
    // Brand
    'PolyAttend',
    'PolyAttend TPI',
    'PolyAttend login',
    'PolyAttend app',
    'PolyAttend Thakurgaon',

    // Institute short
    'TPI',
    'TPI attendance',
    'TPI login',
    'TPI portal',
    'TPI app',
    'TPI student',
    'TPI teacher',
    'TPI hazira',
    'TPI CST',
    'TPI department',
    'TPI result',
    'TPI notice',
    'TPI website',
    'TPI online',

    // Full institute name variants
    'Thakurgaon Polytechnic',
    'Thakurgaon Polytechnic Institute',
    'Thakurgaon Polytechnic attendance',
    'Thakurgaon Polytechnic login',
    'Thakurgaon Polytechnic student',
    'Thakurgaon Polytechnic app',
    'Thakurgaon Polytechnic portal',
    'Thakurgaon Polytechnic hazira',
    'Thakurgaon Polytechnic CST',

    // Bengali-region name variants
    'Thakurgaon Polytechnic Institute hazira',
    'Thakurgaon Polytechnic attendance system',
    'Polytechnic hazira system',
    'Polytechnic online hazira',
    'Online hazira system',
    'Digital attendance polytechnic',

    // Attendance generic
    'attendance system',
    'attendance app',
    'attendance management',
    'attendance tracker',
    'attendance portal',
    'online attendance',
    'digital attendance',
    'smart attendance',
    'QR attendance',
    'QR based attendance',
    'QR code attendance system',
    'automatic attendance',
    'attendance dashboard',
    'attendance report',
    'attendance software',
    'student attendance',
    'student attendance management',
    'teacher attendance',
    'teacher attendance dashboard',
    'class attendance',
    'college attendance',
    'attendance checker',
    'attendance calculator',
    'daily attendance',
    'real time attendance',
    'live attendance session',
    'self mark attendance',
    'manual attendance',

    // Role based
    'admin attendance system',
    'department wide attendance',
    'department admin department',
    'department admin',
    'role based attendance system',
    'multi role attendance system',
    'teacher session management',
    'student self mark',

    // Report & export
    'attendance PDF report',
    'attendance Excel report',
    'attendance export',
    'subject wise attendance report',
    'department attendance report',

    // Polytechnic generic
    'polytechnic attendance',
    'polytechnic attendance management system Bangladesh',
    'polytechnic login',
    'polytechnic student portal',
    'polytechnic app',
    'polytechnic system',
    'polytechnic institute app',
    'polytechnic institute Bangladesh',
    'polytechnic Bangladesh',
    'diploma attendance',
    'diploma engineering attendance',
    'diploma student portal',
    'semester promotion system',

    // BTEB related
    'BTEB attendance',
    'BTEB student attendance system',
    'BTEB student system',
    'BTEB portal',
    'BTEB login',

    // Department related
    'CST attendance',
    'CST department TPI',
    'Computer Science Technology TPI',
    'polytechnic CST',

    // Security
    'OTP verification attendance',
    'two factor authentication system',
    'secure attendance login',
    'email OTP login',

    // Action / intent keywords
    'how to check attendance TPI',
    'how to see TPI attendance',
    'how to check Thakurgaon Polytechnic attendance',
    'polytechnic hazira app',
    'TPI app download',
    'student login system',
    'teacher login system',
    'school management system Bangladesh',
    'attendance system Bangladesh',
    'best attendance app Bangladesh',
    'web based attendance system',
    'student attendance app Bangladesh',
    'Next.js attendance system',
    'QR code attendance Bangladesh',
    'real time attendance system',
    'session based attendance',
  ],
  authors: [{ name: 'Subroto' }],
  metadataBase: new URL('https://polyattend-system2026.vercel.app'),
  openGraph: {
    title: 'PolyAttend — Thakurgaon Polytechnic Institute',
    description: 'PolyAttend is a Smart Attendance Management System for Thakurgaon Polytechnic Institute (TPI), Bangladesh. Four role-based dashboards for Admin, Department Admin, Teachers, and Students. Features include live QR session attendance, real-time self-mark, manual attendance, semester promotion, holiday management, PDF and Excel reports, email OTP verification, and two-factor login — built for every department, shift, and semester of TPI.',
    url: 'https://polyattend-system2026.vercel.app',
    siteName: 'PolyAttend',
    locale: 'en_US',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: 'Rv-warpxyxgzIEGN5-ulYl0zJ3IfODOf1AjL_X9Ibjg',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0A2C1E',
};

export default function RootLayout({ children }) {
  // The app UI, emails and reports are entirely in English, so the document
  // language is "en". While this was "bn", screen readers pronounced the
  // English text with Bengali phonetics and Chrome offered to translate the
  // page on every visit.
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <ToasterClient />
        </AuthProvider>
      </body>
    </html>
  );
}