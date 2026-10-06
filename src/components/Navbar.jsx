import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import cvsuLogo from '@/assets/cvsu-logo.png';

// iOS-style frosted glass: strong blur + color boost, bright specular edge,
// soft inner glow and a gentle drop shadow.
const GLASS =
  'backdrop-blur-2xl backdrop-saturate-[1.8] border border-white/60 ' +
  'shadow-[0_8px_32px_rgba(20,60,40,0.14),inset_0_1px_1px_rgba(255,255,255,0.9),inset_0_-1px_1px_rgba(255,255,255,0.3),inset_0_0_24px_rgba(255,255,255,0.25)]';

// Light top-down sheen that sells the "glass" look
const Sheen = () => (
  <span
    aria-hidden
    className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/50 via-white/5 to-transparent opacity-70"
  />
);

const linkCls =
  'px-4 py-2 rounded-full font-medium text-foreground/90 hover:text-primary hover:bg-white/50 transition-colors bg-transparent border-none cursor-pointer';

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isHome = location.pathname === '/';

  const scrollTo = (id) => {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const tint = scrolled ? 'bg-white/45 dark:bg-white/15' : 'bg-white/25 dark:bg-white/10';

  return (
    <nav className="fixed top-3 left-1/2 -translate-x-1/2 w-[94%] max-w-[1200px] z-50">
      {/* Pill bar */}
      <div className={`relative rounded-full transition-all duration-300 ${tint} ${GLASS}`}>
        <Sheen />
        <div className="relative flex justify-between items-center pl-4 pr-2.5 md:pl-5 py-2">
          <Link to="/" className="flex items-center gap-3 font-heading font-bold text-lg text-primary no-underline">
            <img src={cvsuLogo} alt="CvSU Logo" className="w-9 h-9" width={36} height={36} />
            CvSU Research Center
          </Link>

          <ul className="hidden md:flex list-none gap-1 items-center m-0 p-0">
            {isHome ? (
              <>
                <li><button onClick={() => scrollTo('laboratories')} className={linkCls}>Laboratories</button></li>
                <li><button onClick={() => scrollTo('about')} className={linkCls}>About</button></li>
                <li><button onClick={() => scrollTo('feedback')} className={linkCls}>Feedback</button></li>
              </>
            ) : (
              <li><Link to="/" className={`${linkCls} no-underline`}>Home</Link></li>
            )}
            <li>
              <Link
                to="/login"
                className="gradient-primary text-primary-foreground px-5 py-2.5 rounded-full font-semibold shadow-card hover:-translate-y-0.5 hover:shadow-lg transition-all no-underline ml-2 inline-block"
              >
                Login / Register
              </Link>
            </li>
          </ul>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
            className="md:hidden w-10 h-10 rounded-full flex items-center justify-center bg-white/40 border-none text-foreground cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown: its own glass panel under the pill */}
      {mobileOpen && (
        <div className={`md:hidden relative mt-2 rounded-3xl bg-white/45 dark:bg-white/15 ${GLASS}`}>
          <Sheen />
          <div className="relative p-3 flex flex-col gap-1">
            {isHome ? (
              <>
                <button onClick={() => scrollTo('laboratories')} className={`${linkCls} text-left`}>Laboratories</button>
                <button onClick={() => scrollTo('about')} className={`${linkCls} text-left`}>About</button>
                <button onClick={() => scrollTo('feedback')} className={`${linkCls} text-left`}>Feedback</button>
              </>
            ) : (
              <Link to="/" className={`${linkCls} no-underline`} onClick={() => setMobileOpen(false)}>Home</Link>
            )}
            <Link
              to="/login"
              className="gradient-primary text-primary-foreground px-4 py-3 rounded-full font-semibold text-center no-underline mt-1"
              onClick={() => setMobileOpen(false)}
            >
              Login / Register
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;