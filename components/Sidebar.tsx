
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { UserSession, Student } from '../types';
import { audio } from '../services/audio.service';
import { db } from '../services/db.service';
import NetworkStatusDot from './NetworkStatusDot';
import { 
  LayoutDashboard, 
  BookOpen,
  Camera, 
  Users, 
  Star, 
  Scale, 
  Trophy, 
  LogOut, 
  X,
  MessageSquare,
  Settings,
  PlayCircle,
  Facebook,
  Search,
  Command,
  Clock,
  LayoutGrid,
  History,
  UserPlus,
  ArrowRight,
  Target,
  FileText,
  Calendar
} from 'lucide-react';

interface SidebarProps {
  user: UserSession | null;
  onLogout: () => void;
  isOpen?: boolean;
  isDesktopOpen?: boolean;
  onClose?: () => void;
}

interface SidebarItem {
  label: string;
  icon: any;
  path: string;
  badge?: number | null;
}

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout, isOpen, isDesktopOpen = true, onClose }) => {
  const navigate = useNavigate();
  const [followUpCount, setFollowUpCount] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All Categories');
  const [students, setStudents] = useState<Student[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const categories = [
    { name: 'All Categories', icon: LayoutGrid },
    { name: 'Students', icon: Users },
    { name: 'Pages', icon: FileText },
    { name: 'Milestones', icon: Target },
  ];

  const appPages = [
    { name: 'Dashboard', path: '/admin', type: 'Page' },
    { name: 'Teacher\'s Board', path: '/admin/teachers-board', type: 'Page' },
    { name: 'Follow-Up', path: '/admin/follow-up', type: 'Page' },
    { name: 'Points Ledger', path: '/admin/points', type: 'Page' },
    { name: 'Student Registry', path: '/admin/students', type: 'Page' },
    { name: 'Leaderboard', path: '/leaderboard', type: 'Page' },
  ];

  useEffect(() => {
    if (user && (user.role === 'TEACHER' || user.role === 'ADMIN')) {
      db.getStudents().then(res => {
        setStudents(res);
        const count = res.filter(s => s.consecutiveAbsences > 0 && s.studentStatus === 'active').length;
        setFollowUpCount(count);
      }).catch(console.error);
    }
  }, [user]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isSearchOpen]);

  // Search Results Filtering
  const results = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    const filteredStudents = students.filter(s => 
      s.fullName.toLowerCase().includes(query) || 
      s.accessKey.toLowerCase().includes(query)
    );
    const filteredPages = appPages.filter(p => p.name.toLowerCase().includes(query));

    let combined: any[] = [];
    if (activeCategory === 'All Categories' || activeCategory === 'Students') {
      combined = [...combined, ...filteredStudents.map(s => ({ ...s, name: s.fullName, type: 'Student', path: '/admin/students' }))];
    }
    if (activeCategory === 'All Categories' || activeCategory === 'Pages') {
      combined = [...combined, ...filteredPages];
    }

    return combined.slice(0, 10);
  }, [searchQuery, students, activeCategory]);

  if (!user) return null;

  const isTeacherOrAdmin = user.role === 'TEACHER' || user.role === 'ADMIN';
  const isRad = user.username.toLowerCase() === 'rad';
  const isGuest = user.username.toUpperCase() === 'GUEST';

  const teacherItems: SidebarItem[] = [
    { label: 'DASHBOARD', icon: LayoutDashboard, path: '/admin' },
    { label: "TEACHER'S BOARD", icon: Calendar, path: '/admin/teachers-board' },
    { label: 'FOLLOW-UP', icon: MessageSquare, path: '/admin/follow-up', badge: followUpCount > 0 ? followUpCount : null },
    { label: 'QR CHECK-IN', icon: Camera, path: '/admin/qr-scan' },
    { label: 'STUDENTS', icon: Users, path: '/admin/students' },
    { label: 'POINTS LEDGER', icon: Star, path: '/admin/points' },
    { label: 'FAIRNESS MONITOR', icon: Scale, path: '/admin/fairness' },
    { label: 'LEADERBOARD', icon: Trophy, path: '/leaderboard' },
    { label: 'FAITH PATHWAY', icon: BookOpen, path: '/admin/faith-pathway' },
  ];

  const parentItems: SidebarItem[] = [
    { label: 'MY PORTAL', icon: LayoutDashboard, path: '/portal' },
    { label: 'LEADERBOARD', icon: Trophy, path: '/leaderboard' },
    { label: 'KIDSFLIX', icon: PlayCircle, path: '/kidsflix' },
    { label: 'FB FEED', icon: Facebook, path: '/facebook' }, 
  ];

  const menuItems = isTeacherOrAdmin ? teacherItems : parentItems.filter(item => !(isGuest && item.path === '/portal'));

  const getHomePath = () => {
    if (isTeacherOrAdmin) return '/admin';
    if (isGuest) return '/leaderboard';
    return '/portal';
  };

  const handleSearchNav = (path: string) => {
    audio.playClick();
    setIsSearchOpen(false);
    setSearchQuery('');
    navigate(path);
  };

  return (
    <>
      <aside 
        className={`
          w-64 bg-white flex flex-col fixed inset-y-0 left-0 z-[56] transition-transform duration-300 ease-in-out border-r border-gray-100 shadow-xl
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          ${isDesktopOpen ? 'md:translate-x-0' : 'md:-translate-x-full'}
        `}
      >
        <div className="p-6 pb-4 shrink-0 bg-white border-b border-gray-50/50">
          <div className="flex items-center justify-between mb-8">
            <Link 
              to={getHomePath()} 
              onClick={() => { audio.playClick(); if(onClose) onClose(); }}
              className="flex items-center gap-2 group"
            >
              <div className="relative flex items-center gap-2">
                <h1 className="text-2xl font-black text-pink-500 uppercase tracking-tighter transition-all group-hover:scale-105">
                  Kingdom Kids
                </h1>
                <NetworkStatusDot />
              </div>
            </Link>
            <button className="md:hidden text-gray-400 p-2 hover:bg-gray-50 rounded-lg" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <button 
            onClick={() => { audio.playClick(); setIsSearchOpen(true); }}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all border border-gray-200 group text-left shadow-sm"
          >
            <div className="flex items-center gap-3">
              <Search size={16} className="text-gray-400 group-hover:text-pink-500 transition-colors" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-gray-600">Search...</span>
            </div>
            <div className="hidden lg:flex items-center gap-1 px-1.5 py-0.5 bg-white rounded border border-gray-200">
              <Command size={10} className="text-gray-400" />
              <span className="text-[8px] font-black text-gray-400">K</span>
            </div>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar space-y-8">
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/admin'}
                onMouseEnter={() => audio.playHover()}
                onClick={() => {
                  audio.playClick();
                  if (onClose) onClose();
                }}
                className={({ isActive }) =>
                  `flex items-center justify-between px-4 py-3 rounded-xl font-black transition-all uppercase tracking-widest text-[9px] ${
                    isActive
                      ? 'bg-pink-500 text-white shadow-lg shadow-pink-100'
                      : 'text-gray-500 hover:bg-pink-50 hover:text-pink-600'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <item.icon className={`w-4 h-4 transition-colors`} strokeWidth={2.5} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="bg-pink-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md shadow-sm">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}

            {isTeacherOrAdmin && isRad && (
              <NavLink
                to="/admin/control-center"
                onMouseEnter={() => audio.playHover()}
                onClick={() => { audio.playClick(); if (onClose) onClose(); }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl font-black transition-all uppercase tracking-widest text-[9px] mt-4 ${
                    isActive
                      ? 'bg-pink-500 text-white shadow-lg shadow-pink-100'
                      : 'text-gray-500 hover:bg-pink-50 hover:text-pink-600'
                  }`
                }
              >
                <Settings className="w-4 h-4" strokeWidth={2.5} />
                <span>CONTROL CENTER</span>
              </NavLink>
            )}
          </nav>

          <div className="pt-8 border-t border-gray-100 space-y-4">
            <div className="px-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-pink-50 rounded-xl flex items-center justify-center text-pink-500 font-black text-sm border border-pink-100 shadow-sm">
                {user.username[0]}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-[10px] font-black text-gray-800 truncate uppercase tracking-tight">{user.username}</span>
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest truncate">
                  {user.role}
                </span>
              </div>
            </div>
            <button
              onMouseEnter={() => audio.playHover()}
              onClick={() => { audio.playClick(); onLogout(); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-[9px] font-black text-gray-400 hover:text-pink-600 transition-colors uppercase tracking-widest group"
            >
              <LogOut className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              <span>SIGN OUT</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Global GHL-Style Search Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[10vh] bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div 
            className="w-full max-w-3xl bg-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Input Area */}
            <div className="flex items-center px-6 py-5 border-b border-gray-100 bg-white">
              <Search size={20} className="text-gray-400 shrink-0" />
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder="Search for anything..." 
                className="w-full bg-transparent border-none outline-none px-4 text-base font-medium text-gray-800 placeholder:text-gray-300"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded shrink-0">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ESC</span>
              </div>
            </div>

            {/* Modal Body: Two-Column Layout */}
            <div className="flex h-[450px]">
              {/* Category Sidebar */}
              <div className="w-[200px] bg-white border-r border-gray-100 py-2 shrink-0">
                {categories.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => { audio.playClick(); setActiveCategory(cat.name); }}
                    className={`w-full flex items-center gap-3 px-6 py-3.5 text-left transition-all border-l-4 ${
                      activeCategory === cat.name 
                        ? 'bg-pink-50 text-pink-600 border-pink-500' 
                        : 'text-gray-500 hover:bg-gray-50 border-transparent'
                    }`}
                  >
                    <cat.icon size={18} className={activeCategory === cat.name ? 'text-pink-600' : 'text-gray-400'} />
                    <span className="text-xs font-bold uppercase tracking-tight">{cat.name}</span>
                  </button>
                ))}
              </div>

              {/* Main Content Area */}
              <div className="flex-1 bg-white overflow-y-auto custom-scrollbar p-6">
                {searchQuery.trim() === '' ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <History size={16} className="text-gray-300" />
                      <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Recent Activity</span>
                    </div>
                    <div className="space-y-2">
                      {appPages.slice(0, 3).map((page) => (
                        <button 
                          key={page.name}
                          onClick={() => handleSearchNav(page.path)}
                          className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-50 hover:border-pink-100 hover:bg-pink-50/30 transition-all group text-left shadow-sm"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 group-hover:text-pink-500 group-hover:bg-white transition-all">
                              <BookOpen size={20} />
                            </div>
                            <div>
                              <p className="text-sm font-black text-gray-800 uppercase tracking-tight">{page.name}</p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Page</p>
                            </div>
                          </div>
                          <ArrowRight size={16} className="text-gray-200 group-hover:text-pink-300 transition-all opacity-0 group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : results.length > 0 ? (
                  <div className="space-y-4">
                     <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Results found</span>
                     </div>
                     <div className="space-y-2">
                        {results.map((item: any, idx: number) => (
                          <button 
                            key={`${item.id}-${idx}`}
                            onClick={() => handleSearchNav(item.path)}
                            className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-50 hover:border-pink-100 hover:bg-pink-50/30 transition-all group text-left"
                          >
                             <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 group-hover:text-pink-500 group-hover:bg-white transition-all">
                                   {item.type === 'Student' ? <Users size={20} /> : <BookOpen size={20} />}
                                </div>
                                <div>
                                   <p className="text-sm font-black text-gray-800 uppercase tracking-tight">{item.name}</p>
                                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                     {item.type} {item.accessKey ? `• ${item.accessKey}` : ''}
                                   </p>
                                </div>
                             </div>
                             <ArrowRight size={16} className="text-gray-200 group-hover:text-pink-300 transition-all" />
                          </button>
                        ))}
                     </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-start justify-center h-full pt-10 px-4">
                    <div className="text-left space-y-6 w-full">
                       <div className="space-y-1">
                          <p className="text-sm text-gray-500">No matching result for <span className="font-black text-gray-800">"{searchQuery}"</span></p>
                       </div>
                       
                       { (activeCategory === 'All Categories' || activeCategory === 'Students') && (
                         <button 
                          onClick={() => handleSearchNav('/admin/students')}
                          className="flex items-center gap-2 text-pink-500 font-bold text-sm hover:underline"
                        >
                           <UserPlus size={18} /> Add contact "{searchQuery}"
                         </button>
                       )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[9px] font-black text-gray-400">Ctrl</div>
                    <div className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[9px] font-black text-gray-400">K</div>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Open search</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 flex items-center justify-center bg-white border border-gray-200 rounded text-[10px] font-black text-gray-400">↵</div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select</span>
                </div>
              </div>
              <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em]">Powered by Kingdom Kids AI</p>
            </div>
          </div>
          
          <div className="absolute inset-0 -z-10" onClick={() => setIsSearchOpen(false)} />
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(236, 72, 153, 0.2); }
      `}</style>
    </>
  );
};

export default Sidebar;
