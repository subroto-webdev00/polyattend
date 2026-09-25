'use client';
import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { blockIfSessionActive } from '@/utils/sessionGuard';
import Icon from './Icon';
import Modal from './Modal';

const ROLE_LABELS = {
  admin: 'Admin',
  subAdmin: 'Department Admin',
  semesterAdmin: 'Semester Admin',
  teacher: 'Teacher',
  student: 'Student',
};

export default function AppShell({ navItems, children }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isActive = (path) => pathname === path || (path !== `/${user?.role}` && pathname.startsWith(path + '/'));

  const handleNav = (path) => {
    // FIX: this used to be a skippable confirm() ("leave anyway?"). A
    // teacher could just click through it, which defeats the point. Now
    // it's a true hard block — while a session is active, navigation is
    // simply cancelled with no bypass; ending the session is the only way
    // through.
    if (blockIfSessionActive()) return;
    router.push(path);
    setSidebarOpen(false);
  };

  const handleLogout = () => {
    if (blockIfSessionActive()) return;
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    logout();
    router.push('/login');
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';
  const displayRole = ROLE_LABELS[user?.role] || user?.role || '';

  return (
    <div className="shell-root">
      {/* SIDEBAR */}
      <nav className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        <div className="sidebar-logo-frame">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <Icon name="school" size={18} />
            </div>
            <div>
              <div className="sidebar-logo-text">PolyAttend</div>
              <div className="sidebar-logo-sub">Attendance System</div>
            </div>
          </div>
        </div>

        <div className="sidebar-nav">
          {navItems.map((item, idx) => (
            item.section ? (
              <div key={idx} className="sidebar-section">{item.section}</div>
            ) : (
              <button key={idx} className={`sidebar-item${isActive(item.path) ? ' active' : ''}`} onClick={() => handleNav(item.path)}>
                <Icon name={item.icon} size={18} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && <span className="sidebar-badge">{item.badge}</span>}
              </button>
            )
          ))}
        </div>

        <div className="sidebar-footer-frame">
          <div className="sidebar-footer">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-username">{user?.name}</div>
              <div className="sidebar-role" style={{ textTransform: 'capitalize' }}>{displayRole}</div>
            </div>
            <button
              className="sidebar-logout"
              onClick={handleLogout}
              title="Logout"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, borderRadius: 10,
                background: 'rgba(248,113,113,0.12)',
                border: '1.5px solid rgba(248,113,113,0.28)',
                color: '#f87171', cursor: 'pointer',
                transition: 'all 0.18s',
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(248,113,113,0.25)'; e.currentTarget.style.transform='scale(1.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(248,113,113,0.12)'; e.currentTarget.style.transform='scale(1)'; }}
            >
              <Icon name="logout" size={16} />
            </button>
          </div>
        </div>
      </nav>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* MAIN */}
      <div className="shell-main">
        {/* MOBILE TOP NAV */}
        <header className="top-nav">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)}>
            <Icon name="menu" size={22} />
          </button>
          <div className="top-nav-logo">
            <div className="top-nav-logo-frame">
              <div className="top-nav-logo-icon"><Icon name="school" size={14} /></div>
            </div>
            PolyAttend
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`tag ${user?.role === 'teacher' ? 'tag-green' : user?.role === 'admin' ? 'tag-blue' : 'tag-amber'}`} style={{ fontSize: 10, textTransform: 'capitalize' }}>
              {displayRole}
            </span>
          </div>
        </header>

        {/* CONTENT */}
        <main className="shell-content">
          {children}
        </main>

        {/* MOBILE BOTTOM NAV */}
        <nav className="bottom-nav">
          {navItems.filter(n => !n.section && n.icon).slice(0, 5).map((item, idx) => (
            <button key={idx} className={`bnav-btn${isActive(item.path) ? ' active' : ''}`} onClick={() => handleNav(item.path)}>
              <Icon name={item.icon} size={22} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Logout confirmation */}
      <Modal open={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10, padding: '4px 0 8px' }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'rgba(248, 113, 113, 0.14)', color: '#f87171',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="logout" size={24} />
          </div>
          <div className="modal-title" style={{ marginBottom: 0 }}>Logout?</div>
          <p style={{ fontSize: 13, color: 'var(--txt2)', margin: 0 }}>
            Are you sure you want to Logout from your account?
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
          <button
            className="btn-primary"
            style={{ background: 'var(--danger)' }}
            onClick={confirmLogout}
          >
            Yes, Logout
          </button>
        </div>
      </Modal>
    </div>
  );
}
