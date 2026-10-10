import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Package, CheckCircle2, Info, Clock, Users, Plus, X, AlertCircle, Hash } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import BookingDateTimeInput from '@/components/BookingDateTimeInput';
import FormSelect from '@/components/FormSelect';
import { validateReservationFields, sanitizeText } from '@/lib/validation';
import { earliestBookableInput, earliestBookableLabel, manilaInputToISO, validateBookingDateTime, spansNonOfficialDay, MIN_ADVANCE_DAYS } from '@/lib/timezone';

// `min` for datetime-local inputs: today + 7 days (Philippine Time).
const getMinDatetimeLocal = () => earliestBookableInput();

const validateDateTime = (start, end, allowNonOfficial = false) => validateBookingDateTime(start, end, { allowNonOfficial });

const inputClass =
  'w-full px-4 py-3 border-2 border-border rounded-xl text-base bg-card text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10';

const emptyItem = (equipmentId = 0) => ({ equipmentId, quantity: 1 });

const UserReserveEquipment = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preId = Number(searchParams.get('equipment_id') || 0);

  const [equipment, setEquipment] = useState([]);
  const [items, setItems] = useState([emptyItem(preId)]);
  const [startDatetime, setStartDatetime] = useState('');
  const [endDatetime, setEndDatetime] = useState('');
  const [stakeholderType, setStakeholderType] = useState('');
  const [members, setMembers] = useState([{ name: '', studentNumber: '' }]);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [reservationIds, setReservationIds] = useState([]);

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

  const digitsOnly = (v) => (v || '').replace(/\D/g, '');

  const addMember = () => setMembers([...members, { name: '', studentNumber: '' }]);
  const removeMember = (idx) => setMembers(members.filter((_, i) => i !== idx));
  const updateMember = (idx, field, value) => {
    const updated = [...members];
    if (field === 'studentNumber') value = digitsOnly(value);
    updated[idx] = { ...updated[idx], [field]: value };
    setMembers(updated);
  };

  // ---- Multiple equipment items -----------------------------------------
  const addItem = () => setItems([...items, emptyItem()]);
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));
  const updateItemEquipment = (idx, equipmentId) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], equipmentId };
    setItems(updated);
  };
  const updateItemQuantity = (idx, quantity) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], quantity: Math.max(1, Number(quantity) || 1) };
    setItems(updated);
  };
  // An equipment already picked in one row shouldn't be selectable again in another.
  const equipmentIdsInUse = items.map((it) => it.equipmentId).filter(Boolean);
  const equipmentOptionsFor = (idx) =>
    equipment.filter((eq) => eq.id === items[idx].equipmentId || !equipmentIdsInUse.includes(eq.id));

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

    if (!/^\d+$/.test(studentId.toString().trim())) {
      triggerError('Student Number / ID Number must contain numbers only.');
      return;
    }

    if (!adviserName || !adviserName.toString().trim()) {
      triggerError('Please fill in the Adviser / Supervisor / Project Leader field.');
      return;
    }

    if (!items.length || items.some((it) => !it.equipmentId)) {
      triggerError('Please select an equipment for every row (or remove the empty row).');
      return;
    }

    const equipmentIds = items.map((it) => it.equipmentId);
    const hasDuplicates = new Set(equipmentIds).size !== equipmentIds.length;
    if (hasDuplicates) {
      triggerError('Each equipment can only be added once — adjust the quantity instead of adding it twice.');
      return;
    }

    for (const it of items) {
      const eq = equipment.find((e) => e.id === it.equipmentId);
      if (eq?.status === 'maintenance') {
        triggerError(`"${eq.name}" is currently under maintenance and cannot be reserved.`);
        return;
      }
    }

    // Friday-Sunday is decided per equipment (each item has its own ON/OFF switch).
    for (const it of items) {
      const eq = equipment.find((e) => e.id === it.equipmentId);
      if (!eq?.allow_non_official_hours && spansNonOfficialDay(startDatetime, endDatetime)) {
        triggerError(`"${eq?.name || 'This equipment'}" is not accepting reservations on Fridays to Sundays (non-official hours). Please select Monday to Thursday.`);
        return;
      }
    }

    const dtError = validateDateTime(startDatetime, endDatetime, true);
    if (dtError) {
      triggerError(dtError);
      return;
    }

    if (!stakeholderType) {
      triggerError('Please select a stakeholder type.');
      return;
    }

    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      const hasName = m.name && m.name.trim();
      const hasSN = m.studentNumber && m.studentNumber.trim();
      if (hasName && !hasSN) {
        triggerError(`Please provide the Student Number for "${m.name.trim()}" in the members list.`);
        return;
      }
      if (hasSN && !hasName) {
        triggerError(`Please provide the full name for the member with Student Number "${m.studentNumber.trim()}".`);
        return;
      }
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

    const batchId = items.length > 1 && crypto?.randomUUID ? crypto.randomUUID() : null;

    const sharedFields = {
      user_id: user.id,
      researcher_name: sanitizeText(rawFields.researcher_name, { maxLength: 150 }),
      email: rawFields.email.trim(),
      phone: rawFields.phone ? rawFields.phone.trim() : null,
      purpose: sanitizeText(rawFields.research_purpose, { maxLength: 1000 }),
      start_datetime: manilaInputToISO(startDatetime),
      end_datetime: manilaInputToISO(endDatetime),
      special_requirements: sanitizeText(form.get('special_requirements'), { maxLength: 500 }),
      adviser_name: sanitizeText(adviserName, { maxLength: 150 }),
      study_title: sanitizeText(rawFields.study_title, { maxLength: 300 }),
      unit_college: sanitizeText(form.get('unit_college'), { maxLength: 150 }),
      stakeholder_type: stakeholderType,
      status: 'pending',
      batch_id: batchId,
      members_list: members
        .filter((m) => m.name && m.name.trim())
        .map((m) => `${sanitizeText(m.name, { maxLength: 150 })} — Student No. ${sanitizeText(m.studentNumber, { maxLength: 50 })}`),
    };

    const rows = items.map((it) => ({
      ...sharedFields,
      equipment_id: it.equipmentId,
      quantity_reserved: it.quantity,
    }));

    const { data, error: err } = await supabase
      .from('equipment_reservations')
      .insert(rows)
      .select('id');

    if (err) {
      triggerError(err.message);
    } else {
      setReservationIds((data || []).map((r) => r.id));
      setSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setLoading(false);
  };

  const resetForm = () => {
    setSuccess(false);
    setReservationIds([]);
    setItems([emptyItem()]);
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
            {reservationIds.length > 1 ? (
              <>
                References:{' '}
                <strong>
                  {reservationIds.map((id) => `#EQ${String(id).padStart(5, '0')}`).join(', ')}
                </strong>
              </>
            ) : (
              <>
                Reference: <strong>#EQ{String(reservationIds[0] || 0).padStart(5, '0')}</strong>
              </>
            )}
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
          <h3 className="font-heading text-sm font-bold text-primary uppercase tracking-wider border-b-2 border-foreground/10 pb-2 mb-5">
            Stakeholder Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block mb-1.5 font-semibold text-sm text-foreground">
                Full Name <span className="text-destructive">*</span>
              </label>
              <input
                name="researcher_name"
                required
                placeholder="e.g. Juan Dela Cruz"
                value={user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''}
                readOnly
                className={`${inputClass} bg-muted/50 cursor-not-allowed`}
              />
            </div>
            <div>
              <label className="block mb-1.5 font-semibold text-sm text-foreground">
                Student Number / ID Number <span className="text-destructive">*</span>
              </label>
              <input
                name="student_id"
                required
                inputMode="numeric"
                pattern="[0-9]*"
                onInput={(e) => { e.target.value = e.target.value.replace(/\D/g, ''); }}
                placeholder="e.g. 202302603"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block mb-1.5 font-semibold text-sm text-foreground">
                Contact Number <span className="text-destructive">*</span>
              </label>
              <input
                name="phone"
                type="tel"
                inputMode="numeric"
                maxLength={11}
                pattern="[0-9]{1,11}"
                onInput={(e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 11); }}
                placeholder="e.g. 09171234567"
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="block mb-1.5 font-semibold text-sm text-foreground">
                Email Address <span className="text-destructive">*</span>
              </label>
              <input
                name="email"
                type="email"
                required
                placeholder="e.g. juandelacruz@cvsu.edu.ph"
                value={user?.email || ''}
                readOnly
                className={`${inputClass} bg-muted/50 cursor-not-allowed`}
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
                        ? '!border-[color:var(--field-border)] bg-primary/10 text-primary'
                        : '!border-[color:var(--field-border)] bg-card text-muted-foreground')
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
              <input name="unit_college" required placeholder="e.g. College of Engineering and Information Technology" className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <label className="block mb-1.5 font-semibold text-sm text-foreground">
                Adviser / Supervisor / Project Leader <span className="text-destructive">*</span>
              </label>
              <input name="adviser_name" required placeholder="e.g. Dr. Maria Santos" className={inputClass} />
            </div>
          </div>
        </div>

        {/* REQUEST DETAILS */}
        <div>
          <h3 className="font-heading text-sm font-bold text-primary uppercase tracking-wider border-b-2 border-foreground/10 pb-2 mb-5">
            Request Details
          </h3>

          <div className="mb-6">
            <label className="block mb-1.5 font-semibold text-sm text-foreground">
              Title of the Study <span className="text-destructive">*</span>
            </label>
            <input name="study_title" placeholder="e.g. Effect of Temperature on Microbial Growth in Soil Samples" className={inputClass} required />
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
            <div className="rounded-xl border-2 !border-[color:var(--field-border)] overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="bg-muted/60 border-b-2 !border-[color:var(--field-border)]">
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase w-12">#</th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase">Full Name</th>
                    <th className="px-4 py-2.5 text-left text-xs font-bold text-muted-foreground uppercase">Student Number</th>
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
                          onChange={(e) => updateMember(idx, 'name', e.target.value)}
                          placeholder="e.g. Maria Santos"
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={member.studentNumber}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          onChange={(e) => updateMember(idx, 'studentNumber', e.target.value)}
                          placeholder="e.g. 202302604"
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

          <div className="rounded-2xl border-2 !border-[color:var(--field-border)] bg-white/30 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                <Package className="w-4 h-4 text-primary" />
                Equipment to Reserve <span className="text-destructive">*</span>
              </label>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-primary/30 text-primary text-xs font-semibold hover:border-primary hover:bg-primary/5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Equipment
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => {
                const eq = equipment.find((e) => e.id === item.equipmentId);
                return (
                  <div key={idx} className="rounded-xl border-2 !border-[color:var(--field-border)] bg-card p-4 space-y-3">
                    <div className="flex gap-2 items-start">
                      <FormSelect
                        value={item.equipmentId}
                        onChange={(v) => updateItemEquipment(idx, Number(v))}
                        placeholder="Select equipment…"
                        className={inputClass + ' flex-1'}
                        options={equipmentOptionsFor(idx).map((option) => ({
                          value: option.id,
                          label: `${option.name} — ${option.laboratories?.lab_name} (${option.laboratories?.lab_code})${option.status === 'maintenance' ? ' — Under Maintenance' : ''}`,
                          disabled: option.status === 'maintenance',
                        }))}
                      />
                      <div className="w-28">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(ev) => updateItemQuantity(idx, ev.target.value)}
                          required
                          placeholder="Qty"
                          className={inputClass}
                        />
                      </div>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="p-3 hover:bg-destructive/10 text-destructive rounded-xl transition-colors cursor-pointer flex-shrink-0"
                          title="Remove this equipment"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {eq && (
                      <div className={`border rounded-xl p-4 text-sm flex items-start gap-3 ${eq.status === 'maintenance' ? 'bg-destructive/5 border-destructive/25' : 'bg-white/30 !border-[color:var(--field-border)]'}`}>
                        <Info className={`w-5 h-5 flex-shrink-0 mt-0.5 ${eq.status === 'maintenance' ? 'text-destructive' : 'text-primary'}`} />
                        <div>
                          <p className={`font-semibold mb-1 ${eq.status === 'maintenance' ? 'text-destructive' : 'text-primary'}`}>
                            {eq.name}
                            {eq.status === 'maintenance' && (
                              <span className="ml-2 text-xs font-bold bg-destructive/15 text-destructive px-2 py-0.5 rounded-full">Under Maintenance</span>
                            )}
                          </p>
                          {eq.status === 'maintenance' ? (
                            <p className="text-destructive/80 text-xs">This equipment is currently under maintenance and cannot be reserved.</p>
                          ) : (
                            <>
                              {eq.brand && (
                                <p className="text-muted-foreground mb-1">
                                  {eq.brand}{eq.model ? ` · ${eq.model}` : ''}
                                </p>
                              )}
                              <p className="text-muted-foreground">
                                <strong>Location:</strong> {eq.laboratories?.lab_name} ({eq.laboratories?.lab_code})
                              </p>
                              {eq.description && (
                                <p className="text-muted-foreground mt-1">{eq.description}</p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div>
              <p className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <Clock className="w-3.5 h-3.5 text-primary" /> Schedule
                <span className="text-destructive">*</span>
              </p>
              <div className="mb-3 flex items-start gap-2 rounded-xl border-2 !border-[color:var(--field-border)] bg-white/30 px-3 py-2.5 text-xs text-foreground">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                <p>
                  <span className="font-bold">Note:</span> Reservations must be made at least{' '}
                  <span className="font-bold">1 week ({MIN_ADVANCE_DAYS} days) in advance</span>. You cannot reserve
                  for today, this week, or past dates. Earliest available date:{' '}
                  <span className="font-bold">{earliestBookableLabel()}</span>.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1.5 font-semibold text-xs text-muted-foreground">
                    Start Date & Time
                  </label>
                  <BookingDateTimeInput value={startDatetime} onChange={(v) => setStartDatetime(v)} min={getMinDatetimeLocal()}
                          required
                          className={inputClass}
                        />
                </div>
                <div>
                  <label className="block mb-1.5 font-semibold text-xs text-muted-foreground">
                    End Date & Time
                  </label>
                  <BookingDateTimeInput value={endDatetime} onChange={(v) => setEndDatetime(v)} min={startDatetime || getMinDatetimeLocal()}
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
          <h3 className="font-heading text-sm font-bold text-primary uppercase tracking-wider border-b-2 border-foreground/10 pb-2 mb-5">
            Purpose & Requirements
          </h3>
          <div className="space-y-6">
            <div>
              <label className="block mb-1.5 font-semibold text-sm text-foreground">
                Purpose <span className="text-destructive">*</span>
              </label>
              <textarea name="purpose" required rows={3} placeholder="e.g. To conduct experiments for our thesis on water quality testing." className={inputClass + ' resize-y'} />
            </div>
            <div>
              <label className="block mb-1.5 font-semibold text-sm text-foreground">
                Special Requirements
              </label>
              <textarea
                name="special_requirements"
                rows={2}
                placeholder="e.g. Need extension cords and a fume hood (leave blank if none)"
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