import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../ui/Button';
import NavbarBalance from '../wallet/NavbarBalance';
import InstallPromptBanner from '../pwa/InstallPromptBanner';
import { hasAdminTabAccess } from '../../types/roles';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const safeAreaInsetStyle = useMemo(
    () => ({
      paddingLeft: "var(--safe-area-left)",
      paddingRight: "var(--safe-area-right)",
      paddingBottom: "var(--safe-area-bottom)",
    }),
    []
  );
  const safeAreaTopStyle = useMemo(
    () => ({
      paddingTop: "var(--safe-area-top)",
    }),
    []
  );
  const logoSrc = '/assets/logo.png';
  const isGameRoute = location.pathname.startsWith('/game/');
  const vipStatus = user?.vipStatus?.toUpperCase();
  const showVipBadge = !!user?.isVip || vipStatus === 'PENDING';
  const vipBadgeLabel = vipStatus === 'PENDING' && !user?.isVip ? 'VIP Pending' : 'VIP';

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const navLinks = useMemo(
    () => {
      const links = [
        { to: '/', label: 'Play' },
        { to: '/tables', label: 'Browse Cribs' },
        { to: '/contests', label: 'Cash Crown Tournaments' },
        { to: '/how-to-play', label: 'How to Play' },
        { to: '/account', label: 'Account' },
      ];
      if (user?.role && hasAdminTabAccess(user.role)) {
        links.push({ to: '/admin', label: 'Admin' });
      }
      return links;
    },
    [user?.role]
  );

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/login');
  };

  if (isGameRoute) {
    return <div className="min-h-screen bg-[#0f0f10] text-gray-100">{children}</div>;
  }

  return (
    <div className="rt-site-shell relative min-h-screen text-gray-100" style={safeAreaInsetStyle}>
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(1100px 620px at 8% 6%, rgba(247,188,58,0.17), transparent 65%),' +
            'radial-gradient(980px 540px at 92% 8%, rgba(255,138,38,0.14), transparent 60%),' +
            'linear-gradient(180deg, #08090b 0%, #101216 48%, #08090b 100%)',
        }}
        aria-hidden
      />
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-30 bg-[radial-gradient(circle_at_1px_1px,#ffffff_1px,transparent_0)] [background-size:30px_30px]" />

      <header className="rt-site-header sticky top-0 z-50 border-b border-white/10 bg-[#0c0f14]/86 backdrop-blur-xl" style={safeAreaTopStyle}>
        <div className="rt-site-header-row mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3">
              <img src={logoSrc} alt="ReemTeam logo" className="h-9 w-9 object-contain" />
              <span className="rt-site-wordmark text-lg font-semibold tracking-wide text-white rt-page-title">
                ReemTeam
              </span>
            </Link>

            {isAuthenticated && (
              <nav className="hidden lg:flex items-center gap-1">
                {navLinks.map((link) => {
                  const active = location.pathname === link.to;
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={`rounded-lg px-3 py-2 text-sm transition ${
                        active
                          ? 'bg-white/10 text-white'
                          : 'text-white/65 hover:bg-white/8 hover:text-white'
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <NavbarBalance />
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">Active Profile</div>
                  <div className="text-sm text-white/85">{user?.username}</div>
                  {showVipBadge && (
                    <span className="mt-1 inline-flex items-center rounded-full border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-amber-200">
                      {vipBadgeLabel}
                    </span>
                  )}
                </div>
                <Button variant="secondary" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Login
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="sm">
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}
          </div>

          <button
            type="button"
            className="lg:hidden rounded-lg border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/80"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>

        {menuOpen && (
          <div className="rt-site-mobile-menu lg:hidden border-t border-white/10 bg-[#0c0f14]/94 px-4 py-4">
            {isAuthenticated ? (
              <div className="space-y-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">Active Profile</div>
                  <div className="mt-1 text-sm text-white/85">{user?.username}</div>
                </div>
                {showVipBadge && (
                  <div className="rounded-xl border border-amber-300/35 bg-amber-300/10 px-3 py-2 text-center text-[11px] uppercase tracking-[0.18em] text-amber-200">
                    {vipBadgeLabel}
                  </div>
                )}
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMenuOpen(false)}
                    className={`block rounded-lg px-3 py-2 text-sm ${
                      location.pathname === link.to
                        ? 'bg-white/10 text-white'
                        : 'text-white/75 hover:bg-white/8'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="pt-2">
                  <NavbarBalance />
                </div>
                <Button variant="secondary" size="sm" className="w-full" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link to="/login" onClick={() => setMenuOpen(false)}>
                  <Button variant="ghost" size="sm" className="w-full">
                    Login
                  </Button>
                </Link>
                <Link to="/register" onClick={() => setMenuOpen(false)}>
                  <Button variant="primary" size="sm" className="w-full">
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="rt-site-main mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <InstallPromptBanner />

      <footer className="rt-site-footer mt-12 border-t border-white/10 bg-[#0b0d11]/85 py-6 text-center text-xs text-white/50">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-3 flex flex-wrap items-center justify-center gap-4 text-white/60">
            <Link to="/privacy" className="hover:text-amber-200 transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-amber-200 transition-colors">
              Terms of Service
            </Link>
            <Link to="/data-deletion" className="hover:text-amber-200 transition-colors">
              User Data Deletion
            </Link>
            <Link to="/how-to-play" className="hover:text-amber-200 transition-colors">
              How to Play
            </Link>
          </div>
          <div>&copy; 2020 DFB Solutions. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};
