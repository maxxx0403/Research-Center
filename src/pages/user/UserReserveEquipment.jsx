import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Package, CheckCircle2, Info, Clock, Users, Plus, X, AlertCircle, Hash } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { validateReservationFields, sanitizeText } from '@/lib/validation';

const isClosedDay = (dateStr) => {
  const day = new Date(dateStr).getDay();
  return day === 5 || day === 6 || day === 0;
};

const isOutsideHours = (dateStr) => {
  const hours = new Date(dateStr).getHours();
  const minutes = new Date(dateStr).getMinutes();
  return hours < 7 || hours > 18 || (hours === 18 && minutes > 0);
};

const validateDateTime = (start, end) => {
  if (!start || !end) return 'Please fill in both start and end date/time.';
  if (isClosedDay(start) || isClosedDay(end))
    return 'Closed on Friday, Saturday, and Sunday. Please select Monday to Thursday only.';
  if (isOutsideHours(start) || isOutsideHours(end))
    return 'Operating hours are 7:00 AM to 6:00 PM only.';
  if (new Date(end) <= new Date(start))
    return 'End date/time must be after start date/time.';
  return null;
};

const inputClass =
  'w-full px-4 py-3 border-2 border-border rounded-xl text-base bg-card text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10';

const UserReserveEquipment = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preId = Number(searchParams.get('equipment_id') || 0);

  const [equipment, setEquipment] = useState([]);
  const [selectedId, setSelectedId] = useState(preId);
  const [quantity, setQuantity] = useState(1);
  const [startDatetime, setStartDatetime] = useState('');
  const [endDatetime, setEndDatetime] = useState('');
  const [stakeholderType, setStakeholderType] = useState('');
  const [members, setMembers] = useState([{ name: '' }]);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [reservationId, setReservationId] = useState(0);

  const [tempId] = useState(() => `EQ-TMP-${Math.floor(100000 + Math.random() * 900000)}`);

  useEffect(() => {
    supabase
      .from('equipment')
      .select('*, laboratories(lab_name, lab_code)')
      .in('status', ['available', 'maintenance'])
      .order('name')
      .then(({ data }) => setEquipment(data || []));
  }, []);

  const triggerError = (msg) => {
    setError(msg);
    setLoading(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selected = equipment.find((e) => e.id === selectedId);

  const addMember = () => setMembers([...members, { name: '' }]);
  const removeMember = (idx) => setMembers(members.filter((_, i) => i !== idx));
  const updateMember = (idx, value) => {
    const updated = [...members];
    updated[idx] = { name: value };
    setMembers(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const form = new FormData(e.currentTarget);
    const adviserName = form.get('adviser_name');
    const studentId = form.get('student_id');

    if (!studentId || !studentId.toString().trim()) {
      triggerError('Please fill in the Student Number / ID Number field.');
      return;
    }

    if (!adviserName || !adviserName.toString().trim()) {
      triggerError('Please fill in the Adviser / Supervisor / Project Leader field.');
      return;
    }

    if (!selectedId) {
      triggerError('Please select an equipment.');
      return;
    }

    const selectedEquipment = equipment.find((e) => e.id === selectedId);
    if (selectedEquipment?.status === 'maintenance') {
      triggerError(`"${selectedEquipment.name}" is currently under maintenance and cannot be reserved.`);
      return;
    }

    const dtError = validateDateTime(startDatetime, endDatetime);
    if (dtError) {
      triggerError(dtError);
      return;
    }

    if (!stakeholderType) {
      triggerError('Please select a stakeholder type.');
      return;
    }

    const rawFields = {
      researcher_name: form.get('researcher_name'),
      email: form.get('email') || '',
      phone: form.get('phone') || '',
      study_title: form.get('study_title') || '',
      research_purpose: form.get('purpose'),
    };
    const fieldErr = validateReservationFields(rawFields);
    if (fieldErr) {
      triggerError(fieldErr);
      return;
    }

    const { data, error: err } = await supabase
      .from('equipment_reservations')
      .insert({
        user_id: user.id,
        equipment_id: selectedId,
        researcher_name: sanitizeText(rawFields.researcher_name, { maxLength: 150 }),
        email: rawFields.email.trim(),
        phone: rawFields.phone ? rawFields.phone.trim() : null,
        purpose: sanitizeText(rawFields.research_purpose, { maxLength: 1000 }),
        quantity_reserved: quantity,
        start_datetime: startDatetime,
        end_datetime: endDatetime,
        special_requirements: sanitizeText(form.get('special_requirements'), { maxLength: 500 }),
        adviser_name: sanitizeText(adviserName, { maxLength: 150 }),
        study_title: sanitizeText(rawFields.study_title, { maxLength: 300 }),
        unit_college: sanitizeText(form.get('unit_college'), { maxLength: 150 }),
        stakeholder_type: stakeholderType,
        status: 'pending',
      })
      .select('id')
      .single();

    if (err) {
      triggerError(err.message);
    } else {
      setReservationId(data.id);
      setSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setLoading(false);
  };

  const resetForm = () => {
    setSuccess(false);
    setReservationId(0);
    setSelectedId(0);
    setQuantity(1);
    setStartDatetime('');
    setEndDatetime('');
    setStakeholderType('');
    setMembers([{ name: '' }]);
    setError('');
  };

  if (success) {
    return (
      <div className="max-w-[560px] mx-auto">
        <button
          onClick={() => window.history.back()}
          className="bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer mb-4 inline-flex items-center gap-1 text-sm p-0"
        >
          ← Back
        </button>
        <div className="bg-card rounded-2xl shadow-lg p-10 sm:p-14 text-center animate-fade-up">
          <div className="w-20 h-20 rounded-2xl bg-success/15 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>
          <h2 className="font-heading text-2xl text-primary mb-3 font-bold">Request submitted!</h2>
          <p className="text-muted-foreground text-sm mb-1 max-w-[380px] mx-auto leading-relaxed">
            Thank you for inquiring, please wait while the administrators review your request.
          </p>
          <p className="text-xs text-muted-foreground mb-8">
            Reference: <strong>#EQ{String(reservationId).padStart(5, '0')}</strong>
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              to="/user/dashboard"
              className="gradient-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold no-underline hover:-translate-y-0.5 transition-all"
            >
              Go to Dashboard
            </Link>
            <button
              onClick={resetForm}
              className="bg-transparent text-muted-foreground border-2 border-border px-6 py-3 rounded-xl font-semibold cursor-pointer hover:border-primary hover:text-primary transition-colors"
            >
              New Reservation
            </button>
          </div>
        </div>
      </div>
    );
  }

  const stakeholderOptions = [
    { value: 'student', label: 'Student' },
    { value: 'faculty_staff', label: 'Faculty/Staff' },
    { value: 'non_cvsu', label: 'Non-CvSU Stakeholder' },
  ];

  return (
    <div className="max-w-[960px] mx-auto">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-xs text-muted-foreground font-semibold tracking-widest uppercase">
            UREC-QF-32
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">
            <Hash className="w-3 h-3" /> Form Ref: {tempId}
          </span>
        </div>
        <h1 className="font-heading text-2xl text-primary font-bold mb-1">
          Request to Use Equipment
        </h1>
        <p className="text-muted-foreground text-sm">
          Research Center — Technical Services Division
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card rounded-2xl shadow-lg p-8 md:p-10 animate-fade-up space-y-8">
        {error && (
          <div className="bg-destructive/10 border-2 border-destructive/30 text-destructive rounded-xl p-4 text-sm font-semibold flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {/* STAKEHOLDER INFORMATION */}
        <div>
          <h3 className="font-heading text-sm font-bold text-primary uppercase tracking-wider border-b-2 border-primary/20 pb-2 mb-5">
            Stakeholder Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block mb-1.5 font-semibold text-sm text-foreground">
                Name(s) <span className="text-destructive">*</span>
              </label>
              <input
                name="researcher_name"
                required
                defaultValue={user?.user_metadata?.full_name || ''}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block mb-1.5 font-semibold text-sm text-foreground">
                Student Number / ID Number <span className="text-destructive">*</span>
              </label>
              <input
                name="student_id"
                required
                placeholder="e.g. 202302603"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block mb-1.5 font-semibold text-sm text-foreground">
                Contact Number <span className="text-destructive">*</span>
              </label>
              <input name="phone" type="tel" placeholder="09XXXXXXXXX" required className={inputClass} />
            </div>
            <div>
              <label className="block mb-1.5 font-semibold text-sm text-foreground">
                Email Address <span className="text-destructive">*</span>
              </label>
              <input
                name="email"
                type="email"
                required
                defaultValue={user?.email || ''}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block mb-1.5 font-semibold text-sm text-foreground">
                Stakeholder Type <span className="text-destructive">*</span>
              </label>
              <div className="flex flex-wrap gap-3 mt-2">
                {stakeholderOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className={
                      'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer text-sm font-medium transition-all ' +
                      (stakeholderType === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/50')
                    }
                  >
                    <input
                      type="radio"
                      name="stakeholder_type_radio"
                      value={opt.value}
                      checked={stakeholderType === opt.value}
                      onChange={() => setStakeholderType(opt.value)}
                      className="sr-only"
                    />
                    <span
                      className={
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center ' +
                        (stakeholderType === opt.value
                          ? 'border-primary'
                          : 'border-muted-foreground/40')
                      }
                    >
                      {stakeholderType === opt.value && (
                        <span className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </span>
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block mb-1.5 font-semibold text-sm text-foreground">
                Unit / College / Agency <span className="text-destructive">*</span>
              </label>
              <input name="unit_college" required className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <label className="block mb-1.5 font-semibold text-sm text-foreground">
                Adviser / Supervisor / Project Leader <span className="text-destructive">*</span>
              </label>
              <input name="adviser_name" required placeholder="Enter Adviser / Supervisor name" className={inputClass} />
            </div>
          </div>
        </div>

        {/* REQUEST DETAILS */}
        <div>
          <h3 className="font-heading text-sm font-bold text-primary uppercase tracking-wider border-b-2 border-primary/20 pb-2 mb-5">
            Request Details
          </h3>

          <div className="mb-6">
            <label className="block mb-1.5 font-semibold text-sm text-foreground">
              Title of the Study
            </label>
            <input name="study_title" className={inputClass} />
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" />
                List of Members / Users
                <span className="text-xs font-normal text-muted-foreground normal-case ml-1">(those who will use the equipment)</span>
              </label>
              <button
                type="button"
                onClick={addMember}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-primary/30 text-primary text-xs font-semibold hover:border-primary hover:bg-primary/5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Member
              </button>
            </div>
            <div className="rounded-xl border-2 border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 border-b-2 border-border">
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase w-12">#</th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase">Full Name</th>
                    <th className="px-4 py-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member, idx) => (
                    <tr key={idx} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 text-xs font-bold text-muted-foreground">{idx + 1}</td>
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={member.name}
                          onChange={(e) => updateMember(idx, e.target.value)}
                          placeholder="Enter full name…"
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {members.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeMember(idx)}
                            className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-5 space-y-4">
            <div className="flex gap-2 items-center">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full text-primary bg-primary/15 whitespace-nowrap">
                Equipment
              </span>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(Number(e.target.value))}
                className={inputClass + ' flex-1'}
                required
              >
                <option value={0}>Select equipment…</option>
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.id} disabled={eq.status === 'maintenance'}>
                    {eq.name} — {eq.laboratories?.lab_name} ({eq.laboratories?.lab_code}){eq.status === 'maintenance' ? ' — Under Maintenance' : ''}
                  </option>
                ))}
              </select>
            </div>

            {selected && (
              <div className={`border rounded-xl p-4 text-sm flex items-start gap-3 ${selected.status === 'maintenance' ? 'bg-destructive/5 border-destructive/25' : 'bg-card border-primary/15'}`}>
                <Info className={`w-5 h-5 flex-shrink-0 mt-0.5 ${selected.status === 'maintenance' ? 'text-destructive' : 'text-primary'}`} />
                <div>
                  <p className={`font-semibold mb-1 ${selected.status === 'maintenance' ? 'text-destructive' : 'text-primary'}`}>
                    {selected.name}
                    {selected.status === 'maintenance' && (
                      <span className="ml-2 text-xs font-bold bg-destructive/15 text-destructive px-2 py-0.5 rounded-full">Under Maintenance</span>
                    )}
                  </p>
                  {selected.status === 'maintenance' ? (
                    <p className="text-destructive/80 text-xs">This equipment is currently under maintenance and cannot be reserved.</p>
                  ) : (
                    <>
                      {selected.brand && (
                        <p className="text-muted-foreground mb-1">
                          {selected.brand}{selected.model ? ` · ${selected.model}` : ''}
                        </p>
                      )}
                      <p className="text-muted-foreground">
                        <strong>Location:</strong> {selected.laboratories?.lab_name} ({selected.laboratories?.lab_code})
                      </p>
                      {selected.description && (
                        <p className="text-muted-foreground mt-1">{selected.description}</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="max-w-[180px]">
              <label className="block mb-1.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                Quantity <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                required
                className={inputClass}
              />
            </div>

            <div>
              <p className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <Clock className="w-3.5 h-3.5 text-primary" /> Schedule
                <span className="text-destructive">*</span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1.5 font-semibold text-xs text-muted-foreground">
                    Start Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={startDatetime}
                    onChange={(e) => setStartDatetime(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block mb-1.5 font-semibold text-xs text-muted-foreground">
                    End Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={endDatetime}
                    onChange={(e) => setEndDatetime(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PURPOSE & SPECIAL REQUIREMENTS */}
        <div>
          <h3 className="font-heading text-sm font-bold text-primary uppercase tracking-wider border-b-2 border-primary/20 pb-2 mb-5">
            Purpose & Requirements
          </h3>
          <div className="space-y-6">
            <div>
              <label className="block mb-1.5 font-semibold text-sm text-foreground">
                Purpose <span className="text-destructive">*</span>
              </label>
              <textarea name="purpose" required rows={3} className={inputClass + ' resize-y'} />
            </div>
            <div>
              <label className="block mb-1.5 font-semibold text-sm text-foreground">
                Special Requirements
              </label>
              <textarea
                name="special_requirements"
                rows={2}
                className={inputClass + ' resize-y'}
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-6 border-t border-border">
          <button
            type="submit"
            disabled={loading}
            className="gradient-primary text-primary-foreground px-8 py-3 rounded-xl font-bold text-base border-none cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UserReserveEquipment;