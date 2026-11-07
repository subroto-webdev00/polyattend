'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { blockIfSessionActive } from '@/utils/sessionGuard';
import api from '@/utils/api';
import Icon from './Icon';
import Modal from './Modal';
import NoticeModal from './NoticeModal';
import { noticesPath } from './noticeMeta';

const ROLE_LABELS = {
  admin: 'Admin',
  departmentAdmin: 'Department Admin',
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
  const [notifOpen, setNotifOpen] = useState(false);
  const [notices, setNotices] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [activeNotice, setActiveNotice] = useState(null);

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

  // Where the logo sends you. Read from the nav itself rather than hard-coded
  // as `/admin` or `/student`: the logo has to land each role on ITS OWN home,
  // and a role whose root path ever changes should not need this edited too.
  // Falls back to the first real nav entry if the root isn't listed.
  const homePath = (() => {
    const root = `/${user?.role}`;
    const match = navItems.find((n) => !n.section && n.path === root);
    if (match) return match.path;
    return navItems.find((n) => !n.section)?.path || '/';
  })();

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    logout();
    router.push('/login');
  };

  // Fetch notices for the notification bell (all roles see notices meant for them)
  useEffect(() => {
    if (!user) return;
    setNotifLoading(true);
    api.get('/notices')
      .then(res => setNotices(res.data.notices || []))
      .catch(() => setNotices([]))
      .finally(() => setNotifLoading(false));
  }, [user]);

  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';
  // The top bar shows a single letter; the sidebar footer keeps the full pair.
  const userInitial = (user?.name?.trim()?.[0] || '?').toUpperCase();

  return (
    <div className={`shell-root${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      {/* SIDEBAR */}
      <nav className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        <div className="sidebar-logo-frame">
          <button
            className="sidebar-logo"
            type="button"
            onClick={() => handleNav(homePath)}
            aria-label={`${ROLE_LABELS[user?.role] || 'Account'} home`}
            title="Go to home"
          >
            <div className="sidebar-logo-icon">
              <Icon name="school" size={18} />
            </div>
            <div>
              <div className="sidebar-logo-text">PolyAttend</div>
              <div className="sidebar-logo-sub">Attendance System</div>
            </div>
          </button>
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
                background: 'rgba(239,68,68,0.12)',
                border: '1.5px solid rgba(239,68,68,0.28)',
                color: '#dc2626', cursor: 'pointer',
                transition: 'all 0.18s',
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,0.25)'; e.currentTarget.style.transform='scale(1.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(239,68,68,0.12)'; e.currentTarget.style.transform='scale(1)'; }}
            >
              <Icon name="logout" size={16} />
            </button>
          </div>
        </div>
      </nav>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* MAIN */}
      <div className="shell-main">
        {/* TOP NAV — reference layout: burger + wide search on the left, then
            the notification bell and the signed-in user block on the right.
            The greeting used to live here; it now heads the dashboard page
            itself, so the bar stays a clean utility strip. */}
        <header className="top-nav">
          <button
            className="menu-btn top-nav-burger-mobile"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Icon name="menu" size={20} />
          </button>

          {searchPath && (
            <form className="top-nav-search" onSubmit={handleSearch} role="search">
              <span className="top-nav-search-icon"><Icon name="search" size={16} /></span>
              <input
                type="search"
                className="top-nav-search-input"
                placeholder="Search students, teachers, subjects..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search"
              />
            </form>
          )}

          <div className="top-nav-right">
            {/* Notification bell — shows notices for the signed-in user's role */}
            <button
              className={`top-nav-bell${notices.length > 0 ? ' has-notices' : ''}`}
              onClick={() => setNotifOpen(!notifOpen)}
              title="Notifications"
              aria-label="Notifications"
            >
              <img src="/bell.svg" alt="" width={22} height={22} />
              {notices.length > 0 && (
                <span className="top-nav-bell-badge">
                  {notices.length > 9 ? '9+' : notices.length}
                </span>
              )}
            </button>

            <button
              className="top-nav-user"
              onClick={() => setShowLogoutConfirm(true)}
              title="Account"
            >
              <span className="top-nav-avatar">{userInitial}</span>
              <span className="top-nav-user-text">
                <span className="top-nav-user-name">{user?.name || displayRole}</span>
                <span className="top-nav-user-role">{displayRole}</span>
              </span>
              <Icon name="chevronDown" size={15} className="top-nav-user-chevron" />
            </button>

            {/* Desktop hamburger: folds the sidebar away to free the width */}
            <button
              className="menu-btn top-nav-burger-desktop"
              onClick={() => setSidebarCollapsed(v => !v)}
              aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
              aria-expanded={!sidebarCollapsed}
              title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            >
              <Icon name="menu" size={20} />
            </button>
          </div>
        </header>

        {/* Notification dropdown panel */}
        {notifOpen && (
          <div
            className="notif-dropdown"
            style={{
              position: 'fixed', top: 60, right: 10, width: 340,
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)', zIndex: 50,
              overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', fontSize: 14, color: '#0f172a' }}>Notifications</span>
              <button onClick={() => setNotifOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#64748b' }}>&times;</button>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto', padding: 8 }}>
              {notifLoading ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Loading…</div>
              ) : notices.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 13 }}>No notifications</div>
              ) : (
                notices.map(n => (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => { setNotifOpen(false); setActiveNotice(n); }}
                    onKeyDown={e => { if (e.key === 'Enter') { setNotifOpen(false); setActiveNotice(n); } }}
                    style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', gap: 10 }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {n.imageUrl && (
                      <img src={n.imageUrl} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: '1px solid #e2e8f0' }} />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: '600', fontSize: 13, color: '#0f172a' }}>{n.title}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.content}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                        {new Date(n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={() => { setNotifOpen(false); handleNav(noticesPath(user?.role)); }}
              style={{ width: '100%', padding: '10px 16px', border: 'none', borderTop: '1px solid #f1f5f9', background: '#f8fafc', color: '#2563eb', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              View all notices
            </button>
          </div>
        )}

        {/* Close dropdown when clicking outside */}
        {notifOpen && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 49 }}
            onClick={() => setNotifOpen(false)}
          />
        )}

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

      <NoticeModal notice={activeNotice} onClose={() => setActiveNotice(null)} />

      {/* Logout confirmation */}
      <Modal open={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10, padding: '4px 0 8px' }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.14)', color: '#dc2626',
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
