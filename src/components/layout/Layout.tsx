import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../ui/Button';
import NavbarBalance from '../wallet/NavbarBalance';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const logoSrc = '/assets/logo.png';
  const isGameRoute = location.pathname.startsWith('/game/');

  const navLinks = useMemo(
    () => [
      { to: '/tables', label: 'Tables' },
      { to: '/contests', label: 'Contests' },
      { to: '/account', label: 'Account' },
    ],
    []
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
    <div className="relative min-h-screen text-gray-100">
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

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0c0f14]/86 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3">
              <img src={logoSrc} alt="ReemTeam logo" className="h-9 w-9 object-contain" />
              <span className="text-lg font-semibold tracking-wide text-white rt-page-title">
                ReemTeam
              </span>
            </Link>

            {isAuthenticated && (
              <nav className="hidden md:flex items-center gap-1">
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

          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <NavbarBalance />
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">Active Profile</div>
                  <div className="text-sm text-white/85">{user?.username}</div>
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
            className="md:hidden rounded-lg border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/80"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#0c0f14]/94 px-4 py-4">
            {isAuthenticated ? (
              <div className="space-y-2">
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

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      <footer className="mt-12 border-t border-white/10 bg-[#0b0d11]/85 py-6 text-center text-xs text-white/50">
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
          </div>
          <div>&copy; {new Date().getFullYear()} ReemTeam. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};
