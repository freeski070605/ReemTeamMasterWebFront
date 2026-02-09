import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../ui/Button';
import NavbarBalance from '../wallet/NavbarBalance';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const logoSrc = "/assets/logo.png";
  const displayFont = '"Oswald", "Gabarito", sans-serif';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout-shell bg-[#0f0f10] text-gray-100 flex flex-col">
      <header className="layout-header bg-black/70 border-b border-white/10 sticky top-0 z-50 backdrop-blur">
        <div className="layout-header-inner max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-3">
              <img src={logoSrc} alt="ReemTeam logo" className="w-9 h-9 object-contain" />
              <span className="text-xl font-bold tracking-wide text-white" style={{ fontFamily: displayFont }}>ReemTeam</span>
            </Link>
            {isAuthenticated && (
              <nav className="hidden md:flex gap-4">
                <Link to="/tables" className={`hover:text-yellow-200 transition-colors ${location.pathname === '/tables' ? 'text-white font-medium' : 'text-white/60'}`}>Tables</Link>
                <Link to="/account" className={`hover:text-yellow-200 transition-colors ${location.pathname === '/account' ? 'text-white font-medium' : 'text-white/60'}`}>Account</Link>
              </nav>
            )}
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <NavbarBalance />
                <div className="text-sm text-gray-400">
                  <span className="block text-xs text-white/50">Playing as</span>
                  {user?.username}
                </div>
                <Button variant="secondary" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : (
              <div className="flex gap-2">
                <Link to="/login">
                  <Button variant="ghost" size="sm">Login</Button>
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="sm">Sign Up</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="layout-main flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      <footer className="layout-footer bg-black/70 border-t border-white/10 py-6 text-center text-white/50 text-sm">
        &copy; {new Date().getFullYear()} ReemTeam. All rights reserved.
      </footer>
    </div>
  );
};
