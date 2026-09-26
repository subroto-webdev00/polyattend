'use client';
import { Toaster } from 'react-hot-toast';

export default function ToasterClient() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 3500,
        style: { borderRadius: '12px', background: '#0D2419', color: '#EAF5EF', border: '1px solid #27523C', boxShadow: '0 8px 24px rgba(0,0,0,0.45)' },
        success: { iconTheme: { primary: '#22c55e', secondary: '#0D2419' } },
        error: { iconTheme: { primary: '#f43f5e', secondary: '#0D2419' } },
      }}
    />
  );
}
