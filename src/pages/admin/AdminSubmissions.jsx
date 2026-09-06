import { useState, useEffect } from 'react';
import { FileText, Eye, Trash2, Search, Calendar, Clock, Plus, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const SubmissionRow = ({ s, onStatusChange, onDelete }) => {
  const [url, setUrl] = useState('');
  
  useEffect(() => {
    supabase.storage.from('submissions').createSignedUrl(s.file_path, 3600).then(({ data }) => {
      if (data) setUrl(data.signedUrl);
    });
  }, [s.file_path]);

  const statusColors = {
    'submitted': 'bg-warning/10 text-warning',
    'reviewed': 'bg-info/10 text-info',
    'approved': 'bg-success/10 text-success',
    'rejected': 'bg-destructive/10 text-destructive'
  };

  return (
    <tr className="border-b border-muted hover:bg-muted/30">
      <td className="px-4 py-3 font-semibold text-xs">{s.user_id.slice(0, 8)}…</td>
      <td className="px-4 py-3">
        {url ? (
          <a 
            href={url} 
            target="_blank" 
            rel="noreferrer" 
            className="inline-flex items-center gap-2 text-primary font-semibold no-underline hover:underline text-xs"
          >
            <FileText className="w-4 h-4" /> {s.file_name}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">
            <FileText className="w-4 h-4 inline" /> {s.file_name}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{s.description || '—'}</td>
      <td className="px-4 py-3">
        <select 
          value={s.status} 
          onChange={(e) => onStatusChange(s.id, e.target.value)}
          className={`px-3 py-1.5 border-2 rounded-lg text-xs font-medium bg-card text-foreground focus:outline-none focus:border-primary cursor-pointer transition-colors ${statusColors[s.status] || 'border-border'}`}
        >
          <option value="submitted">Submitted</option>
          <option value="reviewed">Reviewed</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {url && (
            <a 
              href={url} 
              target="_blank" 
              rel="noreferrer" 
              className="text-primary hover:text-primary/80 p-1"
              title="View file"
            >
              <Eye className="w-4 h-4" />
            </a>
          )}
          <button 
            onClick={() => onDelete(s)} 
            className="text-destructive hover:text-destructive/80 bg-transparent border-none cursor-pointer p-1"
            title="Delete submission"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};

const AdminSubmissions = () => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availabilityData, setAvailabilityData] = useState([]);
  const [showAddAvailability, setShowAddAvailability] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [timeRange, setTimeRange] = useState({ start: '09:00', end: '17:00' });

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase.rpc('get_all_submissions');
      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    }
    setLoading(false);
  };

  const fetchAvailability = async () => {
    try {
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      const { data, error } = await supabase
        .from('admin_availability')
        .select('*')
        .eq('type', 'form_submission')
        .gte('date', monthStart.toISOString().split('T')[0])
        .lte('date', monthEnd.toISOString().split('T')[0])
        .order('date', { ascending: true });
      
      if (error) throw error;
      setAvailabilityData(data || []);
    } catch (error) {
      console.error('Error fetching availability:', error);
    }
  };

  useEffect(() => {
    fetchSubmissions();
    fetchAvailability();
  }, [currentMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateStatus = async (id, status) => {
    try {
      await supabase.rpc('admin_update_submission_status', { p_id: id, p_status: status });
      await fetchSubmissions();
    } catch (error) {
      alert('Error updating status: ' + error.message);
    }
  };

  const handleDelete = async (sub) => {
    if (!confirm('Delete this submission?')) return;
    
    try {
      await supabase.storage.from('submissions').remove([sub.file_path]);
      await supabase.rpc('admin_delete_submission', { p_id: sub.id, p_file_path: sub.file_path });
      await fetchSubmissions();
    } catch (error) {
      alert('Error deleting: ' + error.message);
    }
  };

  const addAvailability = async () => {
    if (!selectedDate) {
      alert('Please select a date');
      return;
    }

    try {
      const { error } = await supabase
        .from('admin_availability')
        .insert({
          type: 'form_submission',
          date: selectedDate,
          start_time: timeRange.start,
          end_time: timeRange.end,
          is_available: true
        });

      if (error) throw error;

      setSelectedDate('');
      setTimeRange({ start: '09:00', end: '17:00' });
      setShowAddAvailability(false);
      await fetchAvailability();
    } catch (error) {
      alert('Error adding availability: ' + error.message);
    }
  };

  const removeAvailability = async (id) => {
    if (!confirm('Remove this availability slot?')) return;

    try {
      const { error } = await supabase
        .from('admin_availability')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchAvailability();
    } catch (error) {
      alert('Error removing: ' + error.message);
    }
  };

  const filtered = submissions.filter((s) => {
    const matchesSearch = !search || 
      s.file_name.toLowerCase().includes(search.toLowerCase()) || 
      (s.description || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calendar helpers
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getAvailabilityForDate = (day) => {
    const dateStr = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
      .toISOString()
      .split('T')[0];
    return availabilityData.find(a => a.date === dateStr);
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const days = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-heading text-lg font-bold text-foreground">Paper Submissions Management</h2>
        <p className="text-xs text-muted-foreground mt-1">{filtered.length} submission(s)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Submissions Table */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                placeholder="Search files…" 
                className="w-full pl-10 pr-4 py-2.5 border-2 border-border rounded-xl text-sm bg-card text-foreground focus:outline-none focus:border-primary" 
              />
            </div>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)} 
              className="px-4 py-2.5 border-2 border-border rounded-xl text-sm bg-card text-foreground focus:outline-none focus:border-primary"
            >
              <option value="">All Status</option>
              <option value="submitted">Submitted</option>
              <option value="reviewed">Reviewed</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Submissions Table */}
          <div className="bg-card rounded-xl shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b-2 border-border">
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Submitted By</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">File</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground">Loading…</td>
                    </tr>
                  ) : filtered.length ? (
                    filtered.map((s) =>
                      <SubmissionRow 
                        key={s.id} 
                        s={s} 
                        onStatusChange={updateStatus} 
                        onDelete={handleDelete} 
                      />
                    )
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground">
                        No submissions found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Availability Calendar */}
        <div className="bg-card rounded-xl border-2 border-border p-6 h-fit">
          <div className="space-y-4">
            {/* Header */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Submission Availability
                </h3>
              </div>

              {/* Month Navigation */}
              <div className="flex justify-between items-center mb-3">
                <button 
                  onClick={previousMonth}
                  className="p-1 hover:bg-muted rounded text-sm"
                  type="button"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold text-foreground">{monthName}</span>
                <button 
                  onClick={nextMonth}
                  className="p-1 hover:bg-muted rounded text-sm"
                  type="button"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mini Calendar */}
            <div className="grid grid-cols-7 gap-1 mb-3">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                <div key={d} className="text-center text-xs font-bold text-muted-foreground p-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 mb-4">
              {days.map((day, idx) => {
                const availability = day ? getAvailabilityForDate(day) : null;
                const isToday = day && new Date().toDateString() === 
                  new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toDateString();
                
                return (
                  <div
                    key={idx}
                    className={`aspect-square text-xs rounded font-medium flex items-center justify-center transition-all relative group ${
                      !day ? 'bg-transparent' :
                      availability ? 'bg-success/20 text-success font-bold cursor-default' :
                      isToday ? 'border-2 border-primary text-foreground' :
                      'bg-muted/30 text-muted-foreground'
                    }`}
                  >
                    {day}
                    {availability && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {availability.start_time || '09:00'} - {availability.end_time || '17:00'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground">
              <span className="inline-block w-3 h-3 bg-success/20 rounded mr-2"></span>
              Available slot
            </p>

            {/* Add Availability Form */}
            <button
              onClick={() => setShowAddAvailability(!showAddAvailability)}
              className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
              type="button"
            >
              <Plus className="w-4 h-4" />
              Add Availability
            </button>

            {showAddAvailability && (
              <div className="bg-muted/30 rounded-lg p-4 space-y-3 border border-border">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">From</label>
                    <input
                      type="time"
                      value={timeRange.start}
                      onChange={(e) => setTimeRange({ ...timeRange, start: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">To</label>
                    <input
                      type="time"
                      value={timeRange.end}
                      onChange={(e) => setTimeRange({ ...timeRange, end: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
                <button
                  onClick={addAvailability}
                  className="w-full px-3 py-2 rounded-lg bg-success/20 text-success font-medium text-sm hover:bg-success/30 transition-colors"
                  type="button"
                >
                  Save
                </button>
              </div>
            )}

            {/* Active Slots */}
            {availabilityData.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground">Active Slots</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {availabilityData.map((slot) => (
                    <div key={slot.id} className="text-xs bg-success/5 rounded p-2 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-1">
                        <Clock className="w-3 h-3 text-success flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">
                            {new Date(slot.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {slot.start_time || '09:00'} - {slot.end_time || '17:00'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeAvailability(slot.id)}
                        className="text-destructive/70 hover:text-destructive px-1 py-0.5 rounded font-bold"
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSubmissions;