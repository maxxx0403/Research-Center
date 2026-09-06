import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarCheck, FlaskConical, MessageSquare, LogOut, Menu, ChevronDown, FileText, Package, Settings } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import NotificationBell from '@/components/NotificationBell';
import cvsuLogo from '@/assets/cvsu-logo.png';

const menuItems = [
{ to: '/user/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
{ to: '/user/reserve', icon: FlaskConical, label: 'Reserve Lab' },
{ to: '/user/reserve-equipment', icon: Package, label: 'Reserve Equipment' },
{ to: '/user/reservations', icon: CalendarCheck, label: 'My Reservations' },
{ to: '/user/feedback', icon: MessageSquare, label: 'Feedback' },
{ to: '/user/forms', icon: FileText, label: 'Forms and Papers' }];


const UserLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

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
    <div className="flex min-h-screen bg-muted/50 font-body">
      {sidebarOpen && <div className="fixed inset-0 bg-foreground/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`w-[260px] min-h-screen gradient-sidebar text-primary-foreground fixed top-0 left-0 z-50 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b border-primary-foreground/10">
          <div className="flex items-center gap-3">
            <img src={cvsuLogo} alt="CvSU Logo" className="w-9 h-9" width={36} height={36} />
            <div><div className="font-heading font-bold text-sm leading-tight">CvSU Research Center</div><div className="text-[0.7rem] text-primary-foreground/50">Researcher Portal</div></div>
          </div>
        </div>
        <nav className="flex-1 py-3">
          {menuItems.map((item) =>
          <Link key={item.to} to={item.to} onClick={() => { if (window.innerWidth < 1024) setSidebarOpen(false); }}
          className={`flex items-center gap-3 px-5 py-3 text-sm font-medium no-underline transition-colors border-l-[3px] ${location.pathname === item.to ? 'text-primary-foreground bg-secondary/20 border-l-secondary' : 'text-primary-foreground/60 border-l-transparent hover:text-primary-foreground hover:bg-primary-foreground/5'}`}>
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" /> {item.label}
            </Link>
          )}
        </nav>
      </aside>

      <div className={`flex-1 flex flex-col min-h-screen transition-[margin] duration-300 ${sidebarOpen ? 'lg:ml-[260px]' : 'lg:ml-0'}`}>
        <header className="bg-card border-b border-border px-6 py-3.5 flex justify-between items-center sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="bg-transparent border-none text-foreground cursor-pointer p-1.5 rounded-lg hover:bg-muted transition-colors"><Menu className="w-5 h-5" /></button>
            <h1 className="font-heading text-base font-bold text-foreground">{menuItems.find((m) => m.to === location.pathname)?.label || 'Research Panel'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell reservationsLink="/user/reservations" />
            <div className="relative">
              <button onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 pl-3 pr-2 py-2 rounded-lg bg-muted hover:bg-muted/70 text-foreground border-none cursor-pointer transition-colors">
                <span className="text-sm font-semibold text-foreground hidden sm:inline max-w-[140px] truncate">
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>

              {menuOpen &&
              <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-fade-up p-2">
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
