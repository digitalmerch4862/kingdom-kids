
import React, { useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { UserSession } from '../types';
import Sidebar from './Sidebar';
import NetworkStatusDot from './NetworkStatusDot';
import { audio } from '../services/audio.service';
import { Menu, X } from 'lucide-react';

interface LayoutProps {
  user: UserSession | null;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ user, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isFullscreenPage = location.pathname === '/admin/faith-pathway';
  const isGuest = user?.username.toUpperCase() === 'GUEST';

  const getHomePath = () => {
    if (user?.role === 'TEACHER' || user?.role === 'ADMIN') return '/admin';
    if (isGuest) return '/leaderboard';
    return '/portal';
  };

  const toggleSidebar = () => {
    audio.playClick();
    if (window.innerWidth < 768) {
      setIsMobileMenuOpen(!isMobileMenuOpen);
    } else {
      setIsSidebarOpen(!isSidebarOpen);
    }
  };

  return (
    <div className={`min-h-screen h-full bg-[#FDF8FA] flex flex-col md:flex-row ${isFullscreenPage ? 'overflow-hidden' : ''}`}>
      
      {/* Sidebar Navigation */}
      <Sidebar 
        user={user} 
        onLogout={onLogout} 
        isOpen={isMobileMenuOpen} 
        isDesktopOpen={isSidebarOpen}
        onClose={() => setIsMobileMenuOpen(false)} 
      />

      {/* Main Content Wrapper */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out h-full min-h-0 ${user && isSidebarOpen ? 'md:pl-64' : 'md:pl-0'}`}>
        
        {/* Mobile Header (Hidden on Laptop/Tablet) */}
        {user && !isFullscreenPage && (
          <header className="md:hidden sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-pink-100 px-4">
            <div className="h-14 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Link 
                  to={getHomePath()} 
                  onClick={() => audio.playClick()}
                  className="flex items-center gap-1.5"
                >
                  <h1 className="text-xs font-black text-pink-500 uppercase tracking-tighter">Kingdom Kids</h1>
                  <NetworkStatusDot />
                </Link>
              </div>

              <button 
                onClick={toggleSidebar}
                className="p-2 text-pink-500"
                aria-label="Toggle Menu"
              >
                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </header>
        )}

        {/* Sidebar Overlay (Mobile Only) */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[55] md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        
        {/* Main Application Content Area */}
        <main className={`flex-1 flex flex-col min-h-0 ${isFullscreenPage ? 'w-full h-full' : 'p-4 md:p-10 md:pt-12 w-full max-w-7xl mx-auto'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
