import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, Microscope, Star, Send, Users, Calendar, Award, ChevronRight, CheckCircle2, Package, FileText, Download, Shield, Search, Lock } from 'lucide-react';
import Navbar from '@/components/Navbar';
import StatusBadge from '@/components/StatusBadge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import cvsuLogo from '@/assets/cvsu-logo.png';




const Index = () => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [selectedLabId, setSelectedLabId] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [comment, setComment] = useState('');
  const [labs, setLabs] = useState([]);
  const [equipmentCount, setEquipmentCount] = useState(0);
  const [labSearch, setLabSearch] = useState('');
  const [labStatusFilter, setLabStatusFilter] = useState('all');

  useEffect(() => {
    Promise.all([
    supabase.from('laboratories').select('*').order('id'),
    supabase.from('equipment').select('id', { count: 'exact', head: true })]
    ).then(([labRes, eqRes]) => {
      setLabs(labRes.data || []);
      setEquipmentCount(eqRes.count || 0);
    });
  }, []);

  const filteredLabs = useMemo(() => {
    const term = labSearch.trim().toLowerCase();
    return labs.filter((lab) => {
      const matchesSearch = !term ||
        lab.lab_name?.toLowerCase().includes(term) ||
        lab.lab_code?.toLowerCase().includes(term) ||
        lab.floor?.toLowerCase?.().includes(term);
      const matchesStatus = labStatusFilter === 'all' || lab.status === labStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [labs, labSearch, labStatusFilter]);

  const resetFeedbackForm = () => {
    setRating(0);
    setHoverRating(0);
    setFullName('');
    setEmail('');
    setComment('');
    setSelectedLabId('');
    setFeedbackError('');
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();

    if (rating === 0) {
      setFeedbackError('Please select a rating');
      return;
    }

    setFeedbackLoading(true);
    setFeedbackError('');

    try {
      // Homepage feedback is from guests (not logged in), so there's no user_id
      const { error } = await supabase.from('feedbacks').insert({
        researcher_name: fullName.trim() || 'Anonymous',
        email: email.trim(),
        is_anonymous: !fullName.trim() && !email.trim(),
        laboratory_id: selectedLabId ? Number(selectedLabId) : null,
        rating,
        comment
      });

      if (error) {
        setFeedbackError('Failed to submit feedback. ' + error.message);
      } else {
        resetFeedbackForm();
        setFeedbackSubmitted(true);
      }
    } catch (err) {
      setFeedbackError('Failed to submit feedback');
      console.error(err);
    }
    setFeedbackLoading(false);
  };

  return (
    <div className="relative isolate min-h-screen bg-background overflow-x-hidden">
      {/* Soft color blobs behind the page so the glass navbar has something to blur */}
      <div aria-hidden className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute -top-28 -left-16 w-[520px] h-[520px] rounded-full bg-primary/35 blur-3xl" />
        <div className="absolute -top-10 right-[2%] w-[460px] h-[460px] rounded-full bg-emerald-400/40 blur-3xl" />
        <div className="absolute top-[32%] -left-24 w-[460px] h-[460px] rounded-full bg-lime-400/30 blur-3xl" />
        <div className="absolute top-[28%] left-[36%] w-[380px] h-[380px] rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute top-[42%] -right-24 w-[480px] h-[480px] rounded-full bg-emerald-500/30 blur-3xl" />
        <div className="absolute -bottom-28 left-[14%] w-[500px] h-[500px] rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-16 right-[6%] w-[420px] h-[420px] rounded-full bg-emerald-400/35 blur-3xl" />
      </div>
      <Navbar />

      {/* Hero + Features (contained card, matches design mockup) */}
      <section className="pt-28 pb-10 px-[4%]">
        <div className="max-w-[1300px] mx-auto rounded-[2rem] relative overflow-hidden gradient-hero border border-primary/10">
          <div className="absolute inset-[-50%] bg-[radial-gradient(circle_at_25%_25%,hsl(145_63%_30%/0.10),transparent_50%),radial-gradient(circle_at_75%_75%,hsl(140_55%_45%/0.10),transparent_50%)] animate-float z-[1] pointer-events-none" />

          {/* Hero content */}
          <div className="text-center relative z-[2] pt-16 pb-14 px-8 animate-fade-up">
            <img src={cvsuLogo} alt="Cavite State University Logo" className="w-20 h-20 mx-auto mb-6" width={80} height={80} />
            <div className="inline-flex items-center gap-2 bg-card text-primary px-4 py-1.5 rounded-full text-xs font-semibold mb-6 border border-primary/20 shadow-sm">
              <Microscope className="w-3.5 h-3.5" /> Cavite State University — Research Center
            </div>
            <h1 className="font-heading text-[clamp(2.2rem,4.5vw,3.6rem)] font-bold text-primary mb-6 leading-tight max-w-[780px] mx-auto">
              Research Center Laboratory Reservation System
            </h1>
            <p className="text-lg text-muted-foreground mb-10 max-w-[620px] mx-auto">
              Book laboratories, reserve equipment, submit research papers, and manage your research workflow — all in one platform.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link to="/login" className="bg-card text-primary border-2 border-primary px-8 py-4 rounded-xl font-semibold text-base no-underline shadow-lg cursor-pointer hover:bg-primary hover:text-primary-foreground hover:-translate-y-1 hover:scale-[1.03] hover:shadow-2xl active:scale-[0.98] active:translate-y-0 transition-all duration-200 inline-flex items-center gap-2">
                <Calendar className="w-5 h-5" /> Reserve Now
              </Link>
              <a href="#laboratories" className="bg-card text-primary border-2 border-primary px-8 py-4 rounded-xl font-semibold text-base no-underline hover:bg-primary hover:text-primary-foreground hover:-translate-y-1 transition-all inline-flex items-center gap-2">
                <FlaskConical className="w-5 h-5" /> View Labs
              </a>
            </div>
          </div>

          {/* Features Overview */}
          <div className="relative z-[2] px-6 sm:px-10 pb-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[1200px] mx-auto">
              {[
              { icon: <FlaskConical className="w-6 h-6" />, title: 'Laboratory Reservation', desc: 'Book labs across 3 floors for your research needs' },
              { icon: <Package className="w-6 h-6" />, title: 'Equipment Reservation', desc: `Access ${equipmentCount}+ pieces of research equipment` },
              { icon: <FileText className="w-6 h-6" />, title: 'Forms & Papers', desc: 'Download clearance forms and submit documents online' },
              { icon: <Shield className="w-6 h-6" />, title: 'Secure Portal', desc: 'Personal dashboard to track all your reservations' }].
              map((f) =>
              <div key={f.title} className="bg-card rounded-2xl p-6 shadow-card text-center hover:-translate-y-1 hover:shadow-card-hover transition-all">
                  <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center mx-auto mb-4 text-primary-foreground">{f.icon}</div>
                  <h3 className="font-heading text-sm font-bold text-foreground mb-2">{f.title}</h3>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Laboratories */}
      <section id="laboratories" className="py-24 px-[5%]">
        <div className="text-center mb-10">
          <h2 className="font-heading text-[clamp(1.9rem,4vw,2.8rem)] text-primary mb-3 font-bold">Our Laboratories</h2>
          <p className="text-lg text-muted-foreground max-w-[580px] mx-auto">World-class research facilities equipped with state-of-the-art instruments</p>
        </div>

        {/* Search & filter */}
        <div className="max-w-[1200px] mx-auto mb-10 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={labSearch}
              onChange={(e) => setLabSearch(e.target.value)}
              placeholder="Search laboratories by name, code, or floor…"
              className="w-full pl-10 pr-4 py-3 border-2 border-white/70 rounded-lg text-sm bg-white/50 backdrop-blur-xl text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors"
            />
          </div>
          <Select value={labStatusFilter} onValueChange={setLabStatusFilter}>
            <SelectTrigger className="px-4 py-3 h-auto border-2 border-white/70 rounded-lg text-sm bg-white/50 backdrop-blur-xl text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 sm:w-56">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent className="isolate bg-white/40 dark:bg-white/10 backdrop-blur-2xl backdrop-saturate-[1.8] border border-white/70
                shadow-[0_8px_32px_rgba(20,60,40,0.18),inset_0_1px_1px_rgba(255,255,255,0.9),inset_0_0_24px_rgba(255,255,255,0.3)]
                relative overflow-hidden">
              <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-white/50 via-white/5 to-transparent" />
              <SelectItem value="all" className="focus:bg-white/60 focus:text-foreground rounded-lg">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/50" /> All statuses
                </span>
              </SelectItem>
              <SelectItem value="available" className="focus:bg-white/60 focus:text-foreground rounded-lg">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-success" /> Available
                </span>
              </SelectItem>
              <SelectItem value="occupied" className="focus:bg-white/60 focus:text-foreground rounded-lg">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-warning" /> Occupied
                </span>
              </SelectItem>
              <SelectItem value="maintenance" className="focus:bg-white/60 focus:text-foreground rounded-lg">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-destructive" /> Under Maintenance
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredLabs.length === 0 ?
        <p className="text-center text-muted-foreground max-w-[1200px] mx-auto py-10">No laboratories match your search.</p> :

        <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-6 max-w-[1200px] mx-auto">
          {filteredLabs.map((lab) =>
          <div key={lab.id} className={`isolate rounded-2xl p-6 bg-white/30 dark:bg-white/10 backdrop-blur-2xl backdrop-saturate-[1.8] border border-white/70
                shadow-[0_8px_32px_rgba(20,60,40,0.12),inset_0_1px_1px_rgba(255,255,255,0.9),inset_0_0_24px_rgba(255,255,255,0.3)]
                hover:-translate-y-2 hover:shadow-[0_16px_40px_rgba(20,60,40,0.20),inset_0_1px_1px_rgba(255,255,255,0.9),inset_0_0_24px_rgba(255,255,255,0.3)]
                transition-all relative overflow-hidden group ${lab.status !== 'available' ? 'opacity-90' : ''}`}>
              <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-white/50 via-white/5 to-transparent" />
              <div className={`absolute top-0 left-0 right-0 h-1 ${lab.status === 'available' ? 'gradient-primary' : lab.status === 'maintenance' ? 'bg-destructive' : 'bg-warning'}`} />
              <div className="w-14 h-14 gradient-primary rounded-xl flex items-center justify-center mb-5 text-primary-foreground">
                <FlaskConical className="w-5 h-5" />
              </div>
              <h3 className="font-heading text-sm text-primary mb-1 font-bold leading-snug">{lab.lab_name}</h3>
              <code className="text-[0.7rem] bg-white/60 px-1.5 py-0.5 rounded text-primary">{lab.lab_code}</code>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4 mt-3">{lab.description}</p>
              <div className="flex justify-between items-center mb-4 flex-wrap gap-1">
                <span className="bg-white/60 px-3 py-1 rounded-full text-xs text-muted-foreground font-medium">
                  Capacity: {lab.max_capacity ?? 'N/A'}
                </span>
                <StatusBadge status={lab.status} />
              </div>
              {lab.status === 'available' ?
            <Link to="/login"
            className="w-full py-3 gradient-primary text-primary-foreground border-none rounded-lg font-semibold text-sm no-underline flex items-center justify-center gap-1.5 cursor-pointer hover:-translate-y-0.5 hover:scale-[1.02] hover:brightness-110 hover:shadow-lg active:scale-[0.98] active:translate-y-0 transition-all duration-200">
                  Reserve Now <ChevronRight className="w-4 h-4" />
                </Link> :

            <span className="w-full py-3 bg-destructive/10 text-destructive border-2 border-destructive/25 rounded-lg font-bold text-sm flex items-center justify-center gap-1.5 cursor-not-allowed">
                  <Lock className="w-4 h-4" /> Not Available
                </span>
            }
            </div>
          )}
        </div>
        }
      </section>

      {/* Downloadable Forms */}
      <section className="py-20 px-[4%]">
        <div className="max-w-[1300px] mx-auto rounded-[2rem] bg-muted/40 border border-primary/10 py-16 px-8">
          <div className="text-center mb-12">
            <h2 className="font-heading text-[clamp(1.9rem,4vw,2.8rem)] text-primary mb-3 font-bold">Downloadable Forms</h2>
            <p className="text-lg text-muted-foreground max-w-[580px] mx-auto">Download the required forms before your laboratory visit</p>
          </div>
          <div className="max-w-[800px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            <a href="/forms/UREC-QF-33_Facility_Equipment_Use_Clearance.pdf" download
            className="bg-card rounded-2xl border-2 border-border p-6 flex items-start gap-4 no-underline hover:border-primary hover:shadow-lg transition-all group">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                <Download className="w-7 h-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-semibold tracking-wider uppercase mb-1">UREC-QF-33</p>
                <p className="font-heading font-bold text-sm text-foreground mb-1">Facility/Equipment Use Clearance</p>
                <p className="text-xs text-primary font-semibold">Download here →</p>
              </div>
            </a>
            <a href="/forms/UREC-QF-35_Hazardous_Waste_Material_Disposal_Form.docx" download
            className="bg-card rounded-2xl border-2 border-border p-6 flex items-start gap-4 no-underline hover:border-primary hover:shadow-lg transition-all group">
              <div className="w-14 h-14 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0 group-hover:bg-warning/20 transition-colors">
                <Download className="w-7 h-7 text-warning" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-semibold tracking-wider uppercase mb-1">UREC-QF-35</p>
                <p className="font-heading font-bold text-sm text-foreground mb-1">Hazardous Waste Material Disposal Form</p>
                <p className="text-xs text-primary font-semibold">Download here →</p>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-24 px-[5%]">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="font-heading text-[2.3rem] text-primary mb-6 font-bold">About the Research Center</h2>
            <p className="text-muted-foreground mb-4 text-lg">The CvSU Research Center — under the Office of the Vice President for Research, Innovation, and Extension — provides cutting-edge laboratory facilities for academic and industrial research, supporting scientific discovery and innovation.</p>
            <p className="text-muted-foreground mb-6">Our facilities span 3 buildings: the Interdisciplinary Research Building (IDRB), the Research Center Building (RC), and the Central Experiment Station (CES), housing laboratories across multiple scientific disciplines.</p>
            <ul className="list-none space-y-3">
              {[`${labs.length} specialized research laboratories`, '3 buildings: IDRB, RC, and CES', 'Online reservation & submission system', 'Expert technical support staff', 'Safety training programs'].map((item) =>
              <li key={item} className="flex items-center gap-3 text-muted-foreground text-base">
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                  {item}
                </li>
              )}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
            { num: String(labs.length), label: 'Laboratories', icon: <FlaskConical className="w-6 h-6" /> },
            { num: `${equipmentCount}+`, label: 'Equipment', icon: <Package className="w-6 h-6" /> },
            { num: '3', label: 'Buildings', icon: <Users className="w-6 h-6" /> },
            { num: '4.5★', label: 'Avg Rating', icon: <Award className="w-6 h-6" /> }].
            map((stat) =>
            <div key={stat.label} className="isolate text-center p-8 bg-white/30 dark:bg-white/10 backdrop-blur-2xl backdrop-saturate-[1.8] border border-white/70 rounded-2xl
                shadow-[0_8px_32px_rgba(20,60,40,0.12),inset_0_1px_1px_rgba(255,255,255,0.9),inset_0_0_24px_rgba(255,255,255,0.3)]
                hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(20,60,40,0.20),inset_0_1px_1px_rgba(255,255,255,0.9),inset_0_0_24px_rgba(255,255,255,0.3)]
                transition-all relative overflow-hidden">
                <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-white/50 via-white/5 to-transparent" />
                <div className="text-accent mb-2">{stat.icon}</div>
                <span className="font-heading text-3xl font-bold text-primary block">{stat.num}</span>
                <span className="text-muted-foreground font-medium text-sm mt-1">{stat.label}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Feedback */}
      <section id="feedback" className="py-24 px-[5%]">
        <div className="text-center mb-14">
          <h2 className="font-heading text-[clamp(1.9rem,4vw,2.8rem)] text-primary mb-3 font-bold">We'd Love Your Feedback</h2>
          <p className="text-lg text-muted-foreground max-w-[580px] mx-auto">Help us improve the Research Center Laboratory Reservation System</p>
        </div>

        {feedbackSubmitted ? (
          <div className="isolate max-w-[600px] mx-auto text-center animate-fade-up p-12 bg-white/30 dark:bg-white/10 backdrop-blur-2xl backdrop-saturate-[1.8] border border-white/70 rounded-2xl
              shadow-[0_8px_32px_rgba(20,60,40,0.12),inset_0_1px_1px_rgba(255,255,255,0.9),inset_0_0_24px_rgba(255,255,255,0.3)] relative overflow-hidden">
            <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-white/50 via-white/5 to-transparent" />
            <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
            <h3 className="font-heading text-3xl text-primary mb-3">Thank You!</h3>
            <p className="text-muted-foreground mb-6">Your feedback has been submitted successfully. We appreciate your valuable input to improve our services.</p>
            <button
              type="button"
              onClick={() => setFeedbackSubmitted(false)}
              className="gradient-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold border-none cursor-pointer hover:-translate-y-0.5 transition-all"
            >
              Submit Another Feedback
            </button>
          </div>
        ) : (
          <form onSubmit={handleFeedbackSubmit} className="isolate max-w-[700px] mx-auto space-y-8 p-8 bg-white/30 dark:bg-white/10 backdrop-blur-2xl backdrop-saturate-[1.8] border border-white/70 rounded-2xl
              shadow-[0_8px_32px_rgba(20,60,40,0.12),inset_0_1px_1px_rgba(255,255,255,0.9),inset_0_0_24px_rgba(255,255,255,0.3)] relative overflow-hidden">
            <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-white/50 via-white/5 to-transparent" />
            {feedbackError && (
              <div className="bg-destructive/10 border border-destructive/25 text-destructive rounded-xl p-3 text-sm font-medium">
                {feedbackError}
              </div>
            )}

            {/* Rating */}
            <div>
              <label className="block mb-3 font-semibold text-foreground">
                How would you rate your experience? <span className="text-destructive">*</span>
              </label>
              <div className="flex justify-center gap-3 mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="bg-transparent border-none cursor-pointer transition-transform hover:scale-110"
                  >
                    <Star className={`w-8 h-8 transition-colors ${(hoverRating || rating) >= star ? 'fill-warning text-warning' : 'fill-warning/10 text-warning/50'}`} />
                  </button>
                ))}
              </div>
              <div className="text-center text-sm text-muted-foreground min-h-[1.25rem]">
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Very Good'}
                {rating === 5 && 'Excellent'}
              </div>
            </div>

            {/* Name + Email (optional) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block mb-1.5 font-semibold text-sm text-foreground">Full Name (Optional)</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-white/70 rounded-xl text-base bg-white/50 backdrop-blur-xl text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <div>
                <label className="block mb-1.5 font-semibold text-sm text-foreground">Email (Optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-white/70 rounded-xl text-base bg-white/50 backdrop-blur-xl text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
            </div>

            {/* Laboratory */}
            <div>
              <label className="block mb-1.5 font-semibold text-sm text-foreground">Which laboratory did you use? (Optional)</label>
              <select
                value={selectedLabId}
                onChange={(e) => setSelectedLabId(e.target.value)}
                className="w-full px-4 py-3 border-2 border-white/70 rounded-xl text-base bg-white/50 backdrop-blur-xl text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              >
                <option value="">Select a laboratory…</option>
                {labs.map((lab) => (
                  <option key={lab.id} value={lab.id}>
                    {lab.lab_name} ({lab.lab_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Comments */}
            <div>
              <label className="block mb-1.5 font-semibold text-sm text-foreground">Comments</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Tell us what you think… What did we do well? What could we improve?"
                rows={4}
                maxLength={1000}
                className="w-full px-4 py-3 border-2 border-white/70 rounded-xl text-base bg-white/50 backdrop-blur-xl text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 resize-y"
              />
              <p className="text-xs text-muted-foreground mt-1">{comment.length} / 1000 characters</p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={feedbackLoading || rating === 0}
                className="flex-1 gradient-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold border-none cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" /> {feedbackLoading ? 'Submitting…' : 'Submit Feedback'}
              </button>
              <button
                type="button"
                onClick={resetFeedbackForm}
                className="px-6 py-3 rounded-xl font-semibold border-2 border-white/70 bg-white/50 backdrop-blur-xl text-foreground cursor-pointer hover:border-primary hover:text-primary transition-colors"
              >
                Clear
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Footer */}
      <footer className="py-8 px-[5%] bg-foreground text-center">
        <p className="text-primary-foreground/60 text-sm flex items-center justify-center gap-2">
          <img src={cvsuLogo} alt="CvSU" className="w-5 h-5" width={20} height={20} loading="lazy" /> © 2026 Cavite State University — Research Center Laboratory Reservation System
        </p>
        <p className="mt-2 text-sm">
          <Link to="/privacy-policy" className="text-primary-foreground/60 hover:text-primary-foreground/90 no-underline underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
        </p>
      </footer>
    </div>);

};

export default Index;