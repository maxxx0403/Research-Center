import { useState, useEffect } from 'react';
import { Star, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const UserFeedback = () => {
  const { user, session } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedLabId, setSelectedLabId] = useState('');
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Fetch labs on mount
  useEffect(() => {
    const fetchLabs = async () => {
      const { data } = await supabase.from('laboratories').select('id, lab_name, lab_code').eq('status', 'available');
      setLabs(data || []);
    };
    fetchLabs();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get fresh session to ensure auth token is valid
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      const currentUser = freshSession?.user ?? user;

      if (!currentUser?.id) {
        setError('You must be logged in to submit feedback.');
        setLoading(false);
        return;
      }

      const { error: err } = await supabase.from('feedbacks').insert({
        user_id: currentUser.id,
        researcher_name: currentUser.user_metadata?.full_name || 'User',
        email: currentUser.email,
        laboratory_id: selectedLabId ? Number(selectedLabId) : null,
        rating: rating,
        comment: comment
      });

      if (err) {
        setError(err.message);
      } else {
        setSuccess(true);
        setRating(0);
        setComment('');
        setSelectedLabId('');
      }
    } catch (err) {
      setError('Failed to submit feedback');
      console.error(err);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="max-w-[600px] mx-auto">
        <div className="bg-card rounded-2xl shadow-lg p-12 text-center animate-fade-up">
          <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
          <h2 className="font-heading text-3xl text-primary mb-3">Thank You!</h2>
          <p className="text-muted-foreground mb-6">Your feedback has been submitted successfully. We appreciate your valuable input to improve our services.</p>
          <button
            onClick={() => setSuccess(false)}
            className="gradient-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold no-underline hover:-translate-y-0.5 transition-all"
          >
            Submit Another Feedback
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[700px] mx-auto">
      <div className="text-center mb-8">
        <h1 className="font-heading text-3xl font-bold text-primary mb-2">We'd Love Your Feedback</h1>
        <p className="text-muted-foreground">Help us improve the Research Center Laboratory Reservation System</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card rounded-2xl shadow-lg p-8 space-y-8">
        {error && (
          <div className="bg-destructive/10 border border-destructive/25 text-destructive rounded-xl p-3 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Rating Section */}
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
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-8 h-8 ${
                    (hoverRating || rating) >= star
                      ? 'fill-warning text-warning'
                      : 'text-border'
                  }`}
                />
              </button>
            ))}
          </div>
          <div className="text-center text-sm text-muted-foreground">
            {rating > 0 && (
              <>
                {rating === 1 && '😞 Poor'}
                {rating === 2 && '😕 Fair'}
                {rating === 3 && '😐 Good'}
                {rating === 4 && '😊 Very Good'}
                {rating === 5 && '😍 Excellent'}
              </>
            )}
          </div>
        </div>

        {/* Laboratory Selection */}
        <div>
          <label className="block mb-1.5 font-semibold text-sm text-foreground">Which laboratory did you use? (Optional)</label>
          <select
            value={selectedLabId}
            onChange={(e) => setSelectedLabId(e.target.value)}
            className="w-full px-4 py-3 border-2 border-border rounded-xl text-base bg-card text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          >
            <option value="">Select a laboratory…</option>
            {labs.map((lab) => (
              <option key={lab.id} value={lab.id}>
                {lab.lab_name} ({lab.lab_code})
              </option>
            ))}
          </select>
        </div>

        {/* Comment Section */}
        <div>
          <label className="block mb-1.5 font-semibold text-sm text-foreground">Comments</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us what you think… What did we do well? What could we improve?"
            rows={4}
            className="w-full px-4 py-3 border-2 border-border rounded-xl text-base bg-card text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 resize-y"
          />
          <p className="text-xs text-muted-foreground mt-1">{comment.length} / 1000 characters</p>
        </div>

        {/* Submit Button */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || rating === 0}
            className="flex-1 gradient-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold border-none cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting…' : 'Submit Feedback'}
          </button>
          <button
            type="button"
            onClick={() => {
              setRating(0);
              setComment('');
              setSelectedLabId('');
              setError('');
            }}
            className="px-6 py-3 rounded-xl font-semibold border-2 border-border bg-card text-foreground cursor-pointer hover:border-primary hover:text-primary transition-colors"
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
};

export default UserFeedback;