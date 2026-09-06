import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import cvsuLogo from '@/assets/cvsu-logo.png';

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isHome = location.pathname === '/';

  const scrollTo = (id) => {
    setMobileOpen(false);
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 bg-card/95 backdrop-blur-xl border-b ${scrolled ? 'shadow-card border-border' : 'border-transparent'}`}>
      <div className="max-w-[1400px] mx-auto flex justify-between items-center px-[5%] py-4">
        <Link to="/" className="flex items-center gap-3 font-heading font-bold text-lg text-primary no-underline">
          <img src={cvsuLogo} alt="CvSU Logo" className="w-9 h-9" width={36} height={36} />
          CvSU Research Center
        </Link>

        <ul className="hidden md:flex list-none gap-1 items-center">
          {isHome ?
          <>
              <li><button onClick={() => scrollTo('laboratories')} className="px-4 py-2 rounded-lg font-medium text-foreground hover:text-primary hover:bg-muted transition-colors">Laboratories</button></li>
              <li><button onClick={() => scrollTo('about')} className="px-4 py-2 rounded-lg font-medium text-foreground hover:text-primary hover:bg-muted transition-colors">About</button></li>
              <li><button onClick={() => scrollTo('feedback')} className="px-4 py-2 rounded-lg font-medium text-foreground hover:text-primary hover:bg-muted transition-colors">Feedback</button></li>
            </> :

          <li><Link to="/" className="px-4 py-2 rounded-lg font-medium text-foreground hover:text-primary hover:bg-muted transition-colors no-underline">Home</Link></li>
          }
          <li>
            <Link to="/login" className="gradient-primary text-primary-foreground px-5 py-2 rounded-xl font-semibold shadow-card hover:-translate-y-0.5 hover:shadow-lg transition-all no-underline ml-2">
              Login / Register
            </Link>
          </li>
        </ul>

        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden bg-transparent border-none text-foreground">
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {mobileOpen &&
      <div className="md:hidden bg-card border-t border-border px-[5%] py-4 flex flex-col gap-2">
          {isHome ?
        <>
              <button onClick={() => scrollTo('laboratories')} className="text-left px-4 py-2 rounded-lg font-medium text-foreground hover:bg-muted">Laboratories</button>
              <button onClick={() => scrollTo('about')} className="text-left px-4 py-2 rounded-lg font-medium text-foreground hover:bg-muted">About</button>
              <button onClick={() => scrollTo('feedback')} className="text-left px-4 py-2 rounded-lg font-medium text-foreground hover:bg-muted">Feedback</button>
            </> :

        <Link to="/" className="px-4 py-2 rounded-lg font-medium text-foreground hover:bg-muted no-underline" onClick={() => setMobileOpen(false)}>Home</Link>
        }
          <Link to="/login" className="gradient-primary text-primary-foreground px-4 py-2.5 rounded-xl font-semibold text-center no-underline mt-2" onClick={() => setMobileOpen(false)}>Login / Register</Link>
        </div>
      }
    </nav>);

};

export default Navbar;