import { Link, useLocation } from 'react-router-dom';

// Grouped sidebar navigation shared by the Admin, Staff and User layouts.
// groups: [{ title: string, items: [{ to, icon, label }] }]
const SidebarNav = ({ groups, sidebarOpen, setSidebarOpen }) => {
  const location = useLocation();

  return (
    <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
      {groups.map((group, gi) => (
        <div key={group.title} className="mb-1">
          {sidebarOpen ? (
            <div className={`px-5 ${gi === 0 ? 'pt-2' : 'pt-4'} pb-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-primary-foreground/40 whitespace-nowrap`}>
              {group.title}
            </div>
          ) : (
            gi > 0 && <div className="hidden lg:block mx-4 my-2 border-t border-primary-foreground/15" />
          )}
          {group.items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => { if (window.innerWidth < 1024) setSidebarOpen(false); }}
              aria-label={item.label}
              className={`relative group flex items-center gap-3 px-5 py-2.5 text-sm font-medium no-underline transition-colors border-l-[3px] ${location.pathname === item.to ? 'text-primary-foreground bg-secondary/20 border-l-secondary' : 'text-primary-foreground/60 border-l-transparent hover:text-primary-foreground hover:bg-primary-foreground/5'}`}
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
              <span className={`overflow-hidden whitespace-nowrap transition-all duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${sidebarOpen ? 'max-w-[200px] opacity-100' : 'lg:max-w-0 lg:opacity-0'}`}>{item.label}</span>
              {!sidebarOpen && (
                <span className="hidden lg:block absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-md bg-foreground text-background text-xs font-semibold whitespace-nowrap shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50">{item.label}</span>
              )}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
};

export default SidebarNav;