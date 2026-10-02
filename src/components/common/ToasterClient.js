'use client';
import { Toaster } from 'react-hot-toast';

export default function ToasterClient() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 3500,
        style: { borderRadius: '12px', background: '#ffffff', color: '#0f172a', border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(15,23,42,0.12)' },
        success: { iconTheme: { primary: '#10b981', secondary: '#ffffff' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#ffffff' } },
      }}
    />
  );
}
