import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { FlaskConical, Info, CheckCircle2, Package, X, Plus, Trash2, Clock, Users, AlertCircle, Hash } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  checkLabReservationConflict,
  checkEquipmentAvailability,
} from '@/lib/reservationUtils';
import { validateReservationFields, sanitizeText } from '@/lib/validation';

const isClosedDay = (dateStr) => {
  const day = new Date(dateStr).getDay();
  return day === 0;
};

const isOutsideHours = (dateStr) => {
  const hours = new Date(dateStr).getHours();
  const minutes = new Date(dateStr).getMinutes();
  return hours < 7 || hours > 18 || (hours === 18 && minutes > 0);
};

const validateDateTime = (start, end) => {
  if (!start || !end) return 'Please fill in both start and end date/time.';
  if (isClosedDay(start) || isClosedDay(end))
    return 'Closed on Sundays. Please select Monday to Saturday only.';
  if (isOutsideHours(start) || isOutsideHours(end))
    return 'Operating hours are 7:00 AM to 6:00 PM only.';
  if (new Date(end) <= new Date(start))
    return 'End date/time must be after start date/time.';
  return null;
};

const inputClass =
  'w-full px-4 py-3 border-2 border-border rounded-xl text-base bg-card text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10';

const UserReserve = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preLabId = Number(searchParams.get('lab_id') || 0);

  const [labs, setLabs] = useState([]);
  const [equipment, setEquipment] = useState([]);

  const [tempId] = useState(() => `RC-TMP-${Math.floor(100000 + Math.random() * 900000)}`);

  const [selectedLabs, setSelectedLabs] = useState([
    { labId: preLabId || 0, startDatetime: '', endDatetime: '' },
  ]);
  const [selectedEquipments, setSelectedEquipments] = useState([]);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [reservationId, setReservationId] = useState(0);
  const [stakeholderType, setStakeholderType] = useState('');
  const [members, setMembers] = useState([{ name: '' }]);

  useEffect(() => {
    Promise.all([
      supabase.from('laboratories').select('*').in('status', ['available', 'occupied', 'maintenance']).order('id'),
      supabase
        .from('equipment')
        .select('*, laboratories(lab_name, lab_code)')
        .in('status', ['available', 'maintenance'])
        .order('name'),
    ]).then(([labRes, eqRes]) => {
      setLabs(labRes.data || []);
      setEquipment(eqRes.data || []);
    });
  }, []);

  const triggerError = (msg) => {
    setError(msg);
    setLoading(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addLab = () => {
    setSelectedLabs([...selectedLabs, { labId: 0, startDatetime: '', endDatetime: '' }]);
  };

  const removeLab = (idx) => {
    setSelectedLabs(selectedLabs.filter((_, i) => i !== idx));
  };

  const updateLabField = (idx, field, value) => {
    const updated = [...selectedLabs];
    updated[idx] = { ...updated[idx], [field]: value };
    setSelectedLabs(updated);
  };

  const addEquipment = (eqId) => {
    if (!selectedEquipments.find((e) => e.equipmentId === eqId)) {
      setSelectedEquipments([...selectedEquipments, { equipmentId: eqId, quantity: 1, labIdx: 0 }]);
    }
  };

  const removeEquipment = (eqId) => {
    setSelectedEquipments(selectedEquipments.filter((e) => e.equipmentId !== eqId));
  };

  const updateEquipmentQuantity = (eqId, quantity) => {
    setSelectedEquipments(
      selectedEquipments.map((e) =>
        e.equipmentId === eqId ? { ...e, quantity: Math.max(1, quantity) } : e
      )
    );
  };

  const updateEquipmentLabIdx = (eqId, labIdx) => {
    setSelectedEquipments(
      selectedEquipments.map((e) =>
        e.equipmentId === eqId ? { ...e, labIdx } : e
      )
    );
  };

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

    if (!stakeholderType) {
      triggerError('Please select a Stakeholder Type.');
      return;
    }

    if (!selectedLabs[0]?.labId || selectedLabs[0].labId === 0) {
      triggerError('Please select at least one laboratory/facility.');
      return;
    }

    for (const entry of selectedLabs) {
      if (!entry.labId || entry.labId === 0) continue;
      const lab = labs.find((l) => l.id === entry.labId);
      if (lab?.status === 'maintenance') {
        triggerError(`"${lab.lab_name}" is currently under maintenance and cannot be reserved.`);
        return;
      }
    }

    for (const eq of selectedEquipments) {
      const eqData = equipment.find((e) => e.id === eq.equipmentId);
      if (eqData?.status === 'maintenance') {
        triggerError(`"${eqData.name}" is currently under maintenance and cannot be reserved.`);
        return;
      }
    }

    for (let i = 0; i < selectedLabs.length; i++) {
      const entry = selectedLabs[i];
      if (!entry.labId || entry.labId === 0) continue;
      const labName = labs.find((l) => l.id === entry.labId)?.lab_name || `Lab #${i + 1}`;
      const dtError = validateDateTime(entry.startDatetime, entry.endDatetime);
      if (dtError) {
        triggerError(`${labName}: ${dtError}`);
        return;
      }
    }

    const validLabs = selectedLabs.filter((e) => e.labId > 0);

    for (const entry of validLabs) {
      const { hasConflict, conflicts } = await checkLabReservationConflict(
        entry.labId,
        entry.startDatetime,
        entry.endDatetime
      );
      if (hasConflict) {
        const labName = labs.find((l) => l.id === entry.labId)?.lab_name || `Lab #${entry.labId}`;
        triggerError(
          `Conflict detected for ${labName}! ${conflicts.length} existing reservation(s) overlap with your requested time.`
        );
        return;
      }
    }

    for (const eq of selectedEquipments) {
      const eqData = equipment.find((e) => e.id === eq.equipmentId);
      const eqName = eqData?.name || `Equipment #${eq.equipmentId}`;
      const assignedLab = validLabs[eq.labIdx];
      if (!assignedLab) {
        triggerError(`Please select which lab will use "${eqName}".`);
        return;
      }
      const { hasConflict: eqConflict } = await checkEquipmentAvailability(
        [eq],
        assignedLab.startDatetime,
        assignedLab.endDatetime
      );
      if (eqConflict) {
        triggerError(`"${eqName}" is not available during the selected lab schedule. Please choose a different equipment or time.`);
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

    const commonFields = {
      user_id: user.id,
      researcher_name: sanitizeText(rawFields.researcher_name, { maxLength: 150 }),
      email: rawFields.email.trim(),
      phone: rawFields.phone ? Number(rawFields.phone.replace(/\D/g, '')) : null,
      stakeholder_type: stakeholderType,
      unit_college: sanitizeText(form.get('unit_college'), { maxLength: 150 }),
      adviser_name: sanitizeText(adviserName, { maxLength: 150 }),
      study_title: sanitizeText(rawFields.study_title, { maxLength: 300 }),
      special_requirements: sanitizeText(form.get('special_requirements'), { maxLength: 500 }),
      research_purpose: sanitizeText(rawFields.research_purpose, { maxLength: 1000 }),
      members_list: members.map((m) => sanitizeText(m.name, { maxLength: 150 })).filter(Boolean),
      status: 'pending',
    };

    let lastId = 0;
    const labReservationIds = {};

    for (let i = 0; i < validLabs.length; i++) {
      const entry = validLabs[i];
      const { data, error: err } = await supabase
        .from('reservations')
        .insert({
          ...commonFields,
          laboratory_id: entry.labId,
          start_datetime: entry.startDatetime,
          end_datetime: entry.endDatetime,
        })
        .select('id')
        .single();

      if (err) {
        triggerError(err.message);
        return;
      }

      labReservationIds[i] = data.id;
      lastId = data.id;
    }

    for (const eq of selectedEquipments) {
      const labIdx = eq.labIdx ?? 0;
      const reservationId = labReservationIds[labIdx] ?? labReservationIds[0];
      if (!reservationId) continue;

      const { error: eqResErr } = await supabase.from('reservation_equipment').insert({
        reservation_id: reservationId,
        equipment_id: eq.equipmentId,
        quantity_reserved: eq.quantity,
      });

      if (eqResErr) {
        triggerError('Reservation saved but failed to link equipment: ' + eqResErr.message);
        return;
      }
    }

    setReservationId(lastId);
    setSuccess(true);
    setLoading(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validLabs = selectedLabs.filter((e) => e.labId > 0);

  const resetForm = () => {
    setSuccess(false);
    setReservationId(0);
    setSelectedEquipments([]);
    setSelectedLabs([{ labId: 0, startDatetime: '', endDatetime: '' }]);
    setStakeholderType('');
    setMembers([{ name: '' }]);
    setError('');
  };

  if (success) {
    const labCount = selectedLabs.filter((e) => e.labId > 0).length;
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
          <p className="text-xs text-muted-foreground mb-1">
            Reference: <strong>#RC{String(reservationId).padStart(5, '0')}</strong>
          </p>
          {labCount > 1 && (
            <p className="text-xs text-muted-foreground mb-8">
              {labCount} laboratory reservations were submitted.
            </p>
          )}
          <div className={`flex gap-4 justify-center flex-wrap ${labCount > 1 ? '' : 'mt-8'}`}>
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
          Request to Use Facility/Equipment
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
                Full Name <span className="text-destructive">*</span>
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
              Title of the Study <span className="text-destructive">*</span>
            </label>
            <input name="study_title" className={inputClass} required />
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" />
                List of Members / Users
                <span className="text-xs font-normal text-muted-foreground normal-case ml-1">(those who will use the laboratory)</span>
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

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                <FlaskConical className="w-4 h-4 text-primary" />
                Laboratory / Facility Requested
                <span className="text-destructive">*</span>
              </label>
              <button
                type="button"
                onClick={addLab}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-primary/30 text-primary text-xs font-semibold hover:border-primary hover:bg-primary/5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Laboratory
              </button>
            </div>

            {selectedLabs.map((entry, idx) => {
              const lab = labs.find((l) => l.id === entry.labId);
              const isFirst = idx === 0;
              return (
                <div
                  key={idx}
                  className={
                    'rounded-2xl border-2 p-5 space-y-4 ' +
                    (isFirst ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20')
                  }
                >
                  <div className="flex gap-2 items-center">
                    <span
                      className={
                        'text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ' +
                        (isFirst
                          ? 'text-primary bg-primary/15'
                          : 'text-muted-foreground bg-muted')
                      }
                    >
                      {isFirst ? 'Primary' : `Lab #${idx + 1}`}
                    </span>
                    <select
                      value={entry.labId}
                      onChange={(e) => updateLabField(idx, 'labId', Number(e.target.value))}
                      className={inputClass + ' flex-1'}
                      required={isFirst}
                    >
                      <option value={0}>Select a laboratory…</option>
                      {labs.map((l) => (
                        <option
                          key={l.id}
                          value={l.id}
                          disabled={
                            selectedLabs.some((s, si) => si !== idx && s.labId === l.id) ||
                            l.status === 'maintenance'
                          }
                        >
                          {l.lab_name} ({l.lab_code}){l.status === 'maintenance' ? ' — Under Maintenance' : ''}
                        </option>
                      ))}
                    </select>
                    {!isFirst && (
                      <button
                        type="button"
                        onClick={() => removeLab(idx)}
                        className="p-2.5 hover:bg-destructive/10 text-destructive rounded-xl transition-colors border border-destructive/20 cursor-pointer flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {lab && (
                    <div className={`border rounded-xl p-4 text-sm flex items-start gap-3 ${lab.status === 'maintenance' ? 'bg-destructive/5 border-destructive/25' : 'bg-card border-primary/15'}`}>
                      <Info className={`w-5 h-5 flex-shrink-0 mt-0.5 ${lab.status === 'maintenance' ? 'text-destructive' : 'text-primary'}`} />
                      <div>
                        <p className={`font-semibold mb-1 ${lab.status === 'maintenance' ? 'text-destructive' : 'text-primary'}`}>
                          {lab.lab_name}
                          {lab.status === 'maintenance' && (
                            <span className="ml-2 text-xs font-bold bg-destructive/15 text-destructive px-2 py-0.5 rounded-full">Under Maintenance</span>
                          )}
                        </p>
                        {lab.status === 'maintenance' ? (
                          <p className="text-destructive/80 text-xs">This laboratory is currently under maintenance and cannot be reserved.</p>
                        ) : (
                          <>
                            <p className="text-muted-foreground mb-2">{lab.description}</p>
                            <p className="text-muted-foreground">
                              <strong>Equipment:</strong> {lab.equipment_list}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  )}

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
                          value={entry.startDatetime}
                          onChange={(e) => updateLabField(idx, 'startDatetime', e.target.value)}
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
                          value={entry.endDatetime}
                          onChange={(e) => updateLabField(idx, 'endDatetime', e.target.value)}
                          required
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6">
            <h4 className="font-heading text-sm font-bold text-primary uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Package className="w-4 h-4" />
              Additional Equipment
              <span className="text-xs font-normal text-muted-foreground normal-case">(optional)</span>
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              Optionally include specific equipment alongside your laboratory reservation.
            </p>

            <select
              value={0}
              onChange={(e) => {
                if (Number(e.target.value) > 0) {
                  addEquipment(Number(e.target.value));
                  e.target.value = '0';
                }
              }}
              className={inputClass}
            >
              <option value={0}>Select equipment to add…</option>
              {equipment
                .filter((eq) => !selectedEquipments.find((se) => se.equipmentId === eq.id))
                .map((eq) => (
                  <option key={eq.id} value={eq.id} disabled={eq.status === 'maintenance'}>
                    {eq.name} — {eq.laboratories?.lab_name}{eq.status === 'maintenance' ? ' (Under Maintenance)' : ''}
                  </option>
                ))}
            </select>

            {selectedEquipments.length > 0 && (
              <div className="space-y-2 mt-3">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Selected Equipment
                </label>
                <div className="space-y-2">
                  {selectedEquipments.map((eq) => {
                    const eqData = equipment.find((e) => e.id === eq.equipmentId);
                    return (
                      <div
                        key={eq.equipmentId}
                        className="rounded-xl border-2 border-border bg-secondary/30 p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-semibold text-sm text-foreground">{eqData?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {eqData?.brand} {eqData?.model} · {eqData?.laboratories?.lab_name}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="flex items-center gap-1">
                              <label className="text-xs text-muted-foreground font-medium">Qty</label>
                              <input
                                type="number"
                                min={1}
                                value={eq.quantity}
                                onChange={(e) =>
                                  updateEquipmentQuantity(eq.equipmentId, Number(e.target.value))
                                }
                                className="w-16 px-2 py-1 border border-border rounded text-sm text-center bg-card"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeEquipment(eq.equipmentId)}
                              className="p-1.5 hover:bg-destructive/10 text-destructive rounded transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                            <FlaskConical className="w-3.5 h-3.5 text-primary" /> Used in which lab?
                            <span className="text-destructive">*</span>
                          </label>
                          <select
                            value={eq.labIdx}
                            onChange={(e) => updateEquipmentLabIdx(eq.equipmentId, Number(e.target.value))}
                            className="w-full px-3 py-2 border-2 border-border rounded-xl text-sm bg-card text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                            required
                          >
                            {validLabs.length === 0 && <option value={0}>Select a lab first…</option>}
                            {validLabs.map((entry, idx) => {
                              const lab = labs.find((l) => l.id === entry.labId);
                              return (
                                <option key={idx} value={idx}>
                                  {lab?.lab_name || `Lab #${idx + 1}`}
                                  {entry.startDatetime ? ` — ${new Date(entry.startDatetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${new Date(entry.startDatetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}
                                </option>
                              );
                            })}
                          </select>
                          {(() => {
                            const assignedLab = validLabs[eq.labIdx];
                            if (!assignedLab) return null;
                            return (
                              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Schedule will follow: {assignedLab.startDatetime ? `${new Date(assignedLab.startDatetime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} – ${new Date(assignedLab.endDatetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : 'set the lab schedule above'}
                              </p>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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

export default UserReserve;