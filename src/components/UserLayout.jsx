import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarCheck, FlaskConical, MessageSquare, LogOut, ChevronLeft, ChevronDown, FileText, Package, Settings, LifeBuoy, Flag } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import NotificationBell from '@/components/NotificationBell';
import cvsuLogo from '@/assets/cvsu-logo.png';
import '@/glass.css';

const menuItems = [
{ to: '/user/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
{ to: '/user/reservations', icon: CalendarCheck, label: 'My Reservations' },
{ to: '/user/reserve', icon: FlaskConical, label: 'Reserve Lab' },
{ to: '/user/reserve-equipment', icon: Package, label: 'Reserve Equipment' },
{ to: '/user/forms', icon: FileText, label: 'Forms and Papers' },
{ to: '/user/feedback', icon: MessageSquare, label: 'Feedback' },
{ to: '/user/report-problem', icon: Flag, label: 'Report a Problem' },
{ to: '/user/help', icon: LifeBuoy, label: 'Help & Support' }];


const UserLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  // Every page starts at the top when you switch pages (e.g. Reserve Lab -> Reserve Equipment),
  // instead of keeping the previous page's scroll position.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.pathname]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-muted/50"><div className="text-muted-foreground">Loading...</div></div>;
  }

  if (!user) {
    navigate('/login?redirect=' + encodeURIComponent(location.pathname));
    return null;
  }

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="glass-ui relative isolate flex min-h-screen bg-background font-body">
      {/* Soft color blobs so the glass has something to blur */}
      <div aria-hidden className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute -top-28 -left-16 w-[520px] h-[520px] rounded-full bg-primary/35 blur-3xl" />
        <div className="absolute -top-10 right-[2%] w-[460px] h-[460px] rounded-full bg-emerald-400/40 blur-3xl" />
        <div className="absolute top-[40%] -left-24 w-[460px] h-[460px] rounded-full bg-lime-400/30 blur-3xl" />
        <div className="absolute top-[30%] left-[45%] w-[380px] h-[380px] rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute top-[48%] -right-24 w-[480px] h-[480px] rounded-full bg-emerald-500/30 blur-3xl" />
        <div className="absolute -bottom-28 left-[18%] w-[500px] h-[500px] rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-16 right-[8%] w-[420px] h-[420px] rounded-full bg-emerald-400/35 blur-3xl" />
      </div>
      <div className={`fixed inset-0 bg-foreground/50 z-40 lg:hidden transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`w-[260px] ${sidebarOpen ? '' : 'lg:w-16'} min-h-screen bg-primary/80 backdrop-blur-2xl backdrop-saturate-150 border-r border-white/20 shadow-[8px_0_32px_rgba(20,60,40,0.15)] text-primary-foreground fixed top-0 left-0 z-50 flex flex-col transition-[transform,width] duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className={`p-5 ${sidebarOpen ? '' : 'lg:px-[14px]'} border-b border-primary-foreground/10 transition-[padding] duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)]`}>
          <div className="flex items-center gap-3">
            <img src={cvsuLogo} alt="CvSU Logo" className="w-9 h-9 flex-shrink-0" width={36} height={36} />
            <div className={`overflow-hidden whitespace-nowrap transition-all duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${sidebarOpen ? 'max-w-[200px] opacity-100' : 'lg:max-w-0 lg:opacity-0'}`}><div className="font-heading font-bold text-sm leading-tight">CvSU Research Center</div><div className="text-[0.7rem] text-primary-foreground/50">Researcher Portal</div></div>
          </div>
        </div>
        <nav className="flex-1 py-3">
          {menuItems.map((item) =>
          <Link key={item.to} to={item.to} onClick={() => { if (window.innerWidth < 1024) setSidebarOpen(false); }}
          aria-label={item.label}
          className={`relative group flex items-center gap-3 px-5 py-3 text-sm font-medium no-underline transition-colors border-l-[3px] ${location.pathname === item.to ? 'text-primary-foreground bg-secondary/20 border-l-secondary' : 'text-primary-foreground/60 border-l-transparent hover:text-primary-foreground hover:bg-primary-foreground/5'}`}>
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
              <span className={`overflow-hidden whitespace-nowrap transition-all duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${sidebarOpen ? 'max-w-[200px] opacity-100' : 'lg:max-w-0 lg:opacity-0'}`}>{item.label}</span>
              {!sidebarOpen && (
                <span className="hidden lg:block absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-md bg-foreground text-background text-xs font-semibold whitespace-nowrap shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50">{item.label}</span>
              )}
            </Link>
          )}
        </nav>
      </aside>

      <div className={`flex-1 flex flex-col min-h-screen transition-[margin] duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${sidebarOpen ? 'lg:ml-[260px]' : 'lg:ml-16'}`}>
        <header className="bg-white/40 backdrop-blur-2xl backdrop-saturate-150 border-b border-white/60 px-6 py-3.5 flex justify-between items-center sticky top-0 z-30 shadow-[0_4px_24px_rgba(20,60,40,0.08)]">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'} className="bg-transparent border-none text-foreground cursor-pointer p-1.5 rounded-lg hover:bg-muted active:scale-90 transition-all duration-200"><ChevronLeft className={`w-5 h-5 transition-transform duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${sidebarOpen ? 'rotate-0' : 'rotate-180'}`} /></button>
            <h1 className="font-heading text-base font-bold text-foreground">{menuItems.find((m) => m.to === location.pathname)?.label || 'Research Panel'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell reservationsLink="/user/reservations" />
            <div className="relative">
              <button onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 pl-3 pr-2 py-2 rounded-lg bg-white/50 hover:bg-white/70 text-foreground border-none cursor-pointer transition-colors">
                <span className="text-sm font-semibold text-foreground hidden sm:inline max-w-[140px] truncate">
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>

              {menuOpen &&
              <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 bg-white/85 backdrop-blur-2xl border border-white/70 rounded-2xl shadow-xl overflow-hidden animate-fade-up p-2">
                    <div className="px-4 py-2.5 border-b border-border mb-1">
                      <p className="text-xs font-semibold text-foreground truncate">{user?.email}</p>
                    </div>
                    <Link to="/user/settings" onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold no-underline transition-colors mb-1 ${location.pathname === '/user/settings' ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}>
                      <Settings className="w-4 h-4 flex-shrink-0" /> Settings
                    </Link>
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-transparent text-destructive text-sm font-semibold cursor-pointer border-none hover:bg-destructive/10 transition-colors">
                      <LogOut className="w-4 h-4 flex-shrink-0" /> Sign Out
                    </button>
                  </div>
                </>
              }
            </div>
          </div>
        </header>
        <main className="p-6 flex-1"><Outlet /></main>
      </div>
    </div>);

};

export default UserLayout;