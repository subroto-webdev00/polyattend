'use client';
import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { blockIfSessionActive } from '@/utils/sessionGuard';
import { getGreetingText } from '@/lib/display';
import Icon from './Icon';
import Modal from './Modal';

const ROLE_LABELS = {
  admin: 'Admin',
  semesterAdmin: 'Semester Admin',
  teacher: 'Teacher',
  student: 'Student',
};

export default function AppShell({ navItems, children }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Two INDEPENDENT toggles on purpose. `sidebarOpen` drives the mobile
  // off-canvas drawer; `sidebarCollapsed` drives the desktop hamburger.
  // They can't share one flag because handleNav() closes the mobile drawer
  // after every tap — if the desktop collapse reused it, the sidebar would
  // fold shut on every single navigation.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [query, setQuery] = useState('');

  // Every role already has a full "Search Profile" screen backed by the
  // lookup APIs, so the top-bar field doesn't reimplement search — it hands
  // the query to that page, which prefills and runs it on arrival.
  const searchPath = navItems.find((n) => !n.section && /search/i.test(n.path || ''))?.path;
  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q || !searchPath) return;
    // Same hard block as navigation: leaving mid-session is never allowed.
    if (blockIfSessionActive()) return;
    router.push(`${searchPath}?q=${encodeURIComponent(q)}`);
    setQuery('');
    setSidebarOpen(false);
  };

  const displayRole = ROLE_LABELS[user?.role] || user?.role || '';

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

  return (
    <div className={`shell-root${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
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
        {/* TOP NAV — greeting + global search. Visible on mobile AND desktop. */}
        <header className="top-nav">
          <button
            className="menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Icon name="menu" size={22} />
          </button>

          <div className="top-nav-greeting">
            <div className="top-nav-greeting-main">
              <span className="top-nav-greeting-text">
                {getGreetingText()}, {displayRole}
              </span>
              <span className="top-nav-greeting-sub">Let&apos;s make today&apos;s attendance tracking smooth</span>
            </div>
          </div>

          <div className="top-nav-right">
            {searchPath && (
              <form className="top-nav-search" onSubmit={handleSearch} role="search">
                <span className="top-nav-search-icon"><Icon name="search" size={15} /></span>
                <input
                  type="search"
                  className="top-nav-search-input"
                  placeholder={user?.role === 'student' ? 'Search by roll…' : 'Search by name…'}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search profile"
                />
              </form>
            )}
            <span className={`top-nav-role tag ${user?.role === 'teacher' ? 'tag-green' : user?.role === 'admin' ? 'tag-blue' : 'tag-amber'}`} style={{ fontSize: 10, textTransform: 'capitalize' }}>
              {displayRole}
            </span>
            {/* Desktop hamburger: folds the sidebar away to free the width */}
            <button
              className="menu-btn top-nav-burger-desktop"
              onClick={() => setSidebarCollapsed(v => !v)}
              aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
              aria-expanded={!sidebarCollapsed}
              title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            >
              <Icon name="menu" size={22} />
            </button>
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
