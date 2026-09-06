import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, Microscope, Star, Send, Users, Calendar, Award, ChevronRight, CheckCircle2, Package, FileText, Download, Shield } from 'lucide-react';
import Navbar from '@/components/Navbar';
import StatusBadge from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import cvsuLogo from '@/assets/cvsu-logo.png';




const Index = () => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [comment, setComment] = useState('');
  const [labs, setLabs] = useState([]);
  const [equipmentCount, setEquipmentCount] = useState(0);

  useEffect(() => {
    Promise.all([
    supabase.from('laboratories').select('*').order('id'),
    supabase.from('equipment').select('id', { count: 'exact', head: true })]
    ).then(([labRes, eqRes]) => {
      setLabs(labRes.data || []);
      setEquipmentCount(eqRes.count || 0);
    });
  }, []);

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    
    if (rating === 0) {
      setFeedbackError('Please select a rating');
      return;
    }

    if (!fullName.trim()) {
      setFeedbackError('Please enter your full name');
      return;
    }

    if (!email.trim()) {
      setFeedbackError('Please enter your email');
      return;
    }

    if (!comment.trim()) {
      setFeedbackError('Please enter a comment');
      return;
    }

    setFeedbackLoading(true);
    setFeedbackError('');

    try {
      // For homepage feedback (not authenticated), we use a guest user_id
      // You can use a dummy UUID or create a guest feedback record
      const { error } = await supabase.from('feedbacks').insert({
        researcher_name: fullName,
        email: email,
        laboratory_id: null,
        rating: rating,
        comment: comment
      });

      if (error) {
        setFeedbackError('Failed to submit feedback. ' + error.message);
      } else {
        setFeedbackSubmitted(true);
        // Reset form
        setFullName('');
        setEmail('');
        setComment('');
        setRating(0);
        // Hide success message after 3 seconds
        setTimeout(() => setFeedbackSubmitted(false), 3000);
      }
    } catch (err) {
      setFeedbackError('Error submitting feedback: ' + err.message);
      console.error(err);
    }
    setFeedbackLoading(false);
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />

      {/* Hero + Features (contained card, matches design mockup) */}
      <section className="pt-28 pb-10 px-[4%]">
        <div className="max-w-[1300px] mx-auto rounded-[2rem] relative overflow-hidden gradient-hero border border-primary/10">
          <div className="absolute inset-[-50%] bg-[radial-gradient(circle_at_25%_25%,hsl(224_72%_40%/0.1),transparent_50%),radial-gradient(circle_at_75%_75%,hsl(187_92%_42%/0.1),transparent_50%)] animate-float z-[1] pointer-events-none" />

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
              <Link to="/login" className="gradient-primary text-primary-foreground px-8 py-4 rounded-xl font-semibold text-base no-underline shadow-lg hover:-translate-y-1 hover:shadow-xl transition-all inline-flex items-center gap-2">
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
      <section id="laboratories" className="py-24 px-[5%] bg-card">
        <div className="text-center mb-14">
          <h2 className="font-heading text-[clamp(1.9rem,4vw,2.8rem)] text-primary mb-3 font-bold">Our Laboratories</h2>
          <p className="text-lg text-muted-foreground max-w-[580px] mx-auto">World-class research facilities equipped with state-of-the-art instruments</p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-6 max-w-[1200px] mx-auto">
          {labs.map((lab) =>
          <div key={lab.id} className="bg-card rounded-2xl p-6 shadow-card border border-border hover:-translate-y-2 hover:shadow-card-hover transition-all relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-1 gradient-primary" />
              <div className="w-14 h-14 gradient-primary rounded-xl flex items-center justify-center mb-5 text-primary-foreground">
                <FlaskConical className="w-5 h-5" />
              </div>
              <h3 className="font-heading text-sm text-primary mb-1 font-bold leading-snug">{lab.lab_name}</h3>
              <code className="text-[0.7rem] bg-muted px-1.5 py-0.5 rounded text-primary">{lab.lab_code}</code>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4 mt-3">{lab.description}</p>
              <div className="flex justify-between items-center mb-4 flex-wrap gap-1">
                <span className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground font-medium">
                  Capacity: {lab.max_capacity ?? 'N/A'}
                </span>
                <StatusBadge status={lab.status} />
              </div>
              {lab.status === 'available' ?
            <Link to="/login"
            className="w-full py-3 gradient-primary text-primary-foreground border-none rounded-lg font-semibold text-sm no-underline block text-center hover:-translate-y-0.5 hover:shadow-lg transition-all">
                  Reserve Now <ChevronRight className="w-4 h-4 inline" />
                </Link> :

            <span className="w-full py-3 bg-muted text-muted-foreground rounded-lg font-semibold text-sm block text-center cursor-not-allowed">
                  Not Available
                </span>
            }
            </div>
          )}
        </div>
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
      <section id="about" className="py-24 px-[5%] bg-card">
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
            <div key={stat.label} className="text-center p-8 bg-muted/50 rounded-2xl shadow-card">
                <div className="text-accent mb-2">{stat.icon}</div>
                <span className="font-heading text-3xl font-bold text-primary block">{stat.num}</span>
                <span className="text-muted-foreground font-medium text-sm mt-1">{stat.label}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Feedback */}
      <section id="feedback" className="py-24 px-[5%] bg-muted/50">
        <div className="text-center mb-14">
          <h2 className="font-heading text-[clamp(1.9rem,4vw,2.8rem)] text-primary mb-3 font-bold">Share Your Feedback</h2>
          <p className="text-lg text-muted-foreground max-w-[580px] mx-auto">Help us improve our facilities and services</p>
        </div>
        <form onSubmit={handleFeedbackSubmit} className="max-w-[600px] mx-auto bg-card p-10 rounded-2xl shadow-card">
          {feedbackSubmitted &&
          <div className="bg-success/10 border border-success/25 text-success rounded-xl p-4 mb-6 flex items-center gap-2 font-medium animate-slide-in">
              <CheckCircle2 className="w-5 h-5" /> Thank you for your feedback! It has been saved.
            </div>
          }
          {feedbackError &&
          <div className="bg-destructive/10 border border-destructive/25 text-destructive rounded-xl p-4 mb-6 text-sm font-medium">
              {feedbackError}
            </div>
          }
          <div className="mb-5">
            <label className="block mb-1.5 text-foreground font-semibold text-sm">Full Name <span className="text-destructive">*</span></label>
            <input 
              type="text"
              required 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-border rounded-lg text-base bg-card text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors" 
            />
          </div>
          <div className="mb-5">
            <label className="block mb-1.5 text-foreground font-semibold text-sm">Email <span className="text-destructive">*</span></label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 border-border rounded-lg text-base bg-card text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors" 
            />
          </div>
          <div className="mb-5">
            <label className="block mb-1.5 text-foreground font-semibold text-sm">Rating <span className="text-destructive">*</span></label>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((s) =>
              <button 
                key={s} 
                type="button" 
                onClick={() => setRating(s)} 
                onMouseEnter={() => setHoverRating(s)} 
                onMouseLeave={() => setHoverRating(0)}
                className="bg-transparent border-none cursor-pointer transition-transform hover:scale-110"
              >
                  <Star className={`w-8 h-8 ${(hoverRating || rating) >= s ? 'fill-warning text-warning' : 'text-border'}`} />
                </button>
              )}
            </div>
          </div>
          <div className="mb-5">
            <label className="block mb-1.5 text-foreground font-semibold text-sm">Comment <span className="text-destructive">*</span></label>
            <textarea 
              required 
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full px-4 py-3 border-2 border-border rounded-lg text-base bg-card text-foreground resize-y focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors" 
            />
          </div>
          <button 
            type="submit" 
            disabled={feedbackLoading}
            className="w-full py-4 gradient-primary text-primary-foreground border-none rounded-xl font-bold text-base cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" /> {feedbackLoading ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>
      </section>

      {/* Footer */}
      <footer className="py-8 px-[5%] bg-foreground text-center">
        <p className="text-primary-foreground/60 text-sm flex items-center justify-center gap-2">
          <img src={cvsuLogo} alt="CvSU" className="w-5 h-5" width={20} height={20} loading="lazy" /> © 2026 Cavite State University — Research Center Laboratory Reservation System
        </p>
      </footer>
    </div>);

};

export default Index;