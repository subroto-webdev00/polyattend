import { redirect } from 'next/navigation';

// The old standalone Reports page has been consolidated into the full
// Subject / Session / Student Reports screen at /teacher/export.
export default function Page() {
  redirect('/teacher/export');
}
