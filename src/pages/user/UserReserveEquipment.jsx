import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Package, CheckCircle2, Info, Clock, Users, Plus, X, AlertCircle, Hash } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { sendReservationEmail } from '@/lib/reservationEmail';
import { useAuth } from '@/contexts/AuthContext';
import BookingDateTimeInput from '@/components/BookingDateTimeInput';
import FormSelect, { SectionListInput } from '@/components/FormSelect';
import { getStakeholderConfig, isCvsuEmail, accountUnitCollege } from '@/lib/stakeholder';
import { fetchEquipmentAvailability, isOutOfService, equipmentStatusLabel } from '@/lib/equipmentAvailability';
import { CVSU_COLLEGES } from '@/lib/cvsuColleges';
import { validateReservationFields, sanitizeText, parseClassList, sectionMemberEntries } from '@/lib/validation';
import { toManilaInputValue, earliestBookableInput, earliestBookableLabel, manilaInputToISO, validateBookingDateTime, spansNonOfficialDay, MIN_ADVANCE_DAYS } from '@/lib/timezone';
import PendingReservationDateNotice from '@/components/PendingReservationDateNotice';
import DailySchedule from '@/components/DailySchedule';
import { categoryOf, summarizeCategories } from '@/lib/equipmentCategories';
import { emptySchedule, buildSlots, validateSlots, isRangeTooLong, labelDate, MAX_BOOKING_DAYS } from '@/lib/dailySchedule';
import {
  fetchPendingReservationCounts,
  getFullPendingReservationDate,
  getPendingReservationLimitMessage,
  PENDING_RESERVATION_LIMIT_ERROR,
} from '@/lib/pendingReservationLimit';

// `min` for datetime-local inputs: today + 7 days (Philippine Time).
const getMinDatetimeLocal = () => earliestBookableInput();

const validateDateTime = (start, end, allowNonOfficial = false) => validateBookingDateTime(start, end, { allowNonOfficial });

const inputClass =
  'w-full px-4 py-3 border-2 border-border rounded-xl text-base bg-card text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10';

// laboratory = the laboratory filter chosen for this row ('' = all laboratories). It is only a filter for the picker.
const ALL_LABS = '__all';
const NO_LAB = '__none';
const emptyItem = (equipmentId = 0) => ({ equipmentId, quantity: 1, laboratory: '' });

// "LAB 302 - Biological Laboratory": lab code first, then the full name.
const labDisplay = (lab) => {
  if (!lab?.lab_name && !lab?.lab_code) return '';
  return [lab.lab_code, lab.lab_name].filter(Boolean).join(' - ');
};

// Which laboratory an equipment belongs to (value used by the dropdown).
const ALL_CATEGORIES = '__all_categories';
const labValueOf = (eq) => (eq?.laboratory_id ? String(eq.laboratory_id) : NO_LAB);
const labLabelOf = (eq) => labDisplay(eq?.laboratories) || 'No laboratory assigned';

const UserReserveEquipment = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preId = Number(searchParams.get('equipment_id') || 0);

  const [equipment, setEquipment] = useState([]);
  const [items, setItems] = useState([emptyItem(preId)]);
  // Dates are chosen once; every date gets its own start and end time.
  const [schedule, setSchedule] = useState(emptySchedule());
  const [stakeholderChoice, setStakeholderChoice] = useState('');
  const { options: stakeholderOptions, autoValue: autoStakeholder } = getStakeholderConfig(user?.email, user?.user_metadata?.stakeholder_type);
  // Non-CvSU emails (e.g. gmail.com) are auto-set; CvSU emails choose Student / Faculty.
  const stakeholderType = autoStakeholder || stakeholderChoice;
  // Instructors list the sections that come with them instead of an adviser.
  const isInstructor = stakeholderType === 'faculty_staff';
  // CvSU stakeholders (Student / Faculty-Staff) pick their college from a list;
  // outsiders type their own agency.
  const isCvsuStakeholder = stakeholderType ? stakeholderType !== 'non_cvsu' : isCvsuEmail(user?.email);
  const [unitCollege, setUnitCollege] = useState('');
  // College / school saved on the account at registration: filled in and locked.
  const lockedUnitCollege = accountUnitCollege(user, isCvsuStakeholder, CVSU_COLLEGES);
  useEffect(() => {
    if (lockedUnitCollege) setUnitCollege(lockedUnitCollege);
  }, [lockedUnitCollege]);
  const [members, setMembers] = useState([{ name: '', studentNumber: '' }]);
  // Whole sections submitted as a class list instead of one member at a time: [{ name, text }]
  const [sections, setSections] = useState([]);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [reservationIds, setReservationIds] = useState([]);

  const [tempId] = useState(() => `EQ-TMP-${Math.floor(100000 + Math.random() * 900000)}`);

  useEffect(() => {
    supabase
      .from('equipment')
      .select('*, laboratories(lab_name, lab_code)')
      .in('status', ['available', 'under_repair', 'maintenance'])
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
  const updateItemLaboratory = (idx, value) => {
    const laboratory = value === ALL_LABS ? '' : value;
    const updated = [...items];
    const picked = equipment.find((e) => e.id === updated[idx].equipmentId);
    // Changing the laboratory clears an equipment that does not belong to the new one.
    const keep = !laboratory || !picked || labValueOf(picked) === laboratory;
    updated[idx] = { ...updated[idx], laboratory, equipmentId: keep ? updated[idx].equipmentId : 0 };
    setItems(updated);
  };
  const updateItemQuantity = (idx, quantity) => {
    const updated = [...items];
    const max = updated[idx].equipmentId ? maxQuantityOf(updated[idx].equipmentId) : 0;
    let qty = Math.max(1, Number(quantity) || 1);
    if (max >= 1) qty = Math.min(qty, max);
    updated[idx] = { ...updated[idx], quantity: qty };
    setItems(updated);
  };
  // An equipment already picked in one row shouldn't be selectable again in another.
  const equipmentIdsInUse = items.map((it) => it.equipmentId).filter(Boolean);
  const equipmentOptionsFor = (idx) =>
    equipment
      .filter((eq) => eq.id === items[idx].equipmentId || !equipmentIdsInUse.includes(eq.id))
      .filter((eq) => !items[idx].laboratory || labValueOf(eq) === items[idx].laboratory)
      // Category / "Available only" filters (the equipment already picked always stays in its list)
      .filter((eq) => eq.id === items[idx].equipmentId || categoryFilter === ALL_CATEGORIES || categoryOf(eq) === categoryFilter)
      .filter((eq) => eq.id === items[idx].equipmentId || !availableOnly || isOpenForBooking(eq))
      .sort((a, b) => labLabelOf(a).localeCompare(labLabelOf(b), undefined, { numeric: true }) || a.name.localeCompare(b.name));
  // Laboratory dropdown: "All laboratories" + every laboratory that has equipment (with counts).
  const laboratoryOptions = (() => {
    const labs = new Map();
    equipment.forEach((eq) => {
      const value = labValueOf(eq);
      const entry = labs.get(value) || { value, label: labLabelOf(eq), count: 0 };
      entry.count += 1;
      labs.set(value, entry);
    });
    return [
      { value: ALL_LABS, label: `All laboratories (${equipment.length})` },
      ...[...labs.values()]
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
        .map(({ value, label, count }) => ({ value, label: `${label} (${count})` })),
    ];
  })();

  // Fri-Sun dates are only bookable when every selected equipment allows non-official hours.
  const allowNonOfficial =
    items.length > 0 &&
    items.every((it) => !!equipment.find((e) => e.id === it.equipmentId)?.allow_non_official_hours);
  const slotsForSchedule = () => buildSlots(schedule, { allowNonOfficial });
  const blockingEquipment = items
    .map((it) => equipment.find((e) => e.id === it.equipmentId))
    .filter((eq) => eq && !eq.allow_non_official_hours)
    .map((eq) => eq.name);

  // ---- Quantity limit: never more than the units still free -------------
  // Before dates are picked: the total units. After: the units free on EVERY chosen date/time.
  const timedSlots = slotsForSchedule().filter((slot) => slot.startDatetime && slot.endDatetime);
  const pickedIds = [...new Set(items.map((it) => it.equipmentId).filter(Boolean))];
  const availabilityKey = JSON.stringify({ ids: pickedIds, slots: timedSlots.map((sl) => [sl.startDatetime, sl.endDatetime]) });
  const [freeUnits, setFreeUnits] = useState({}); // { [equipmentId]: units free on the chosen schedule }
  const [checkingUnits, setCheckingUnits] = useState(false);

  const loadFreeUnits = async (ids, slots) => {
    const results = await Promise.all(slots.map((slot) =>
      fetchEquipmentAvailability(ids.map((equipmentId) => ({ equipmentId, startDatetime: slot.startDatetime, endDatetime: slot.endDatetime })))));
    const free = {};
    results.forEach((availability) => {
      ids.forEach((id) => {
        const units = availability[id]?.available;
        if (units == null) return;
        free[id] = free[id] == null ? units : Math.min(free[id], units);
      });
    });
    return free;
  };

  useEffect(() => {
    const { ids, slots } = JSON.parse(availabilityKey);
    let active = true;
    if (!ids.length || !slots.length) { setFreeUnits({}); return undefined; }
    setCheckingUnits(true);
    const refresh = () => loadFreeUnits(ids, slots.map(([startDatetime, endDatetime]) => ({ startDatetime, endDatetime })))
      .then((free) => { if (active) setFreeUnits(free); })
      .catch((err) => console.error('Could not check equipment availability:', err))
      .finally(() => { if (active) setCheckingUnits(false); });
    refresh();
    const intervalId = window.setInterval(refresh, 30000);
    return () => { active = false; window.clearInterval(intervalId); };
  }, [availabilityKey]);

  // ---- Filters: category and "available only" -----------------------------
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [openUnits, setOpenUnits] = useState({}); // { [equipmentId]: units free (on the chosen schedule, or right now) }
  const allIdsKey = equipment.map((e) => e.id).join(',');
  const windowKey = JSON.stringify(timedSlots.map((sl) => [sl.startDatetime, sl.endDatetime]));
  useEffect(() => {
    if (!availableOnly || !allIdsKey) return undefined;
    let active = true;
    const ids = allIdsKey.split(',').map(Number);
    const windows = JSON.parse(windowKey);
    const slots = windows.length
      ? windows.map(([startDatetime, endDatetime]) => ({ startDatetime, endDatetime }))
      : [{ startDatetime: toManilaInputValue(new Date()), endDatetime: toManilaInputValue(new Date(Date.now() + 60000)) }];
    loadFreeUnits(ids, slots)
      .then((free) => { if (active) setOpenUnits(free); })
      .catch((err) => console.error('Could not check equipment availability:', err));
    return () => { active = false; };
  }, [availableOnly, allIdsKey, windowKey]);
  const isOpenForBooking = (eq) => eq.status === 'available' && (openUnits[eq.id] == null || openUnits[eq.id] > 0);
  const categoryOptions = [
    { value: ALL_CATEGORIES, label: `All categories (${equipment.length})` },
    ...summarizeCategories(equipment).map(({ category, count }) => ({ value: category, label: `${category} (${count})` })),
  ];

  const totalUnitsOf = (equipmentId) => Number(equipment.find((e) => e.id === equipmentId)?.quantity) || 0;
  // Highest quantity that can be requested for this equipment right now.
  const maxQuantityOf = (equipmentId) => {
    const total = totalUnitsOf(equipmentId);
    const free = freeUnits[equipmentId];
    return free == null ? total : Math.max(0, Math.min(total, free));
  };

  // When the free units drop (dates changed / someone else reserved), lower the quantity to fit.
  useEffect(() => {
    setItems((prev) => {
      let changed = false;
      const next = prev.map((it) => {
        if (!it.equipmentId) return it;
        const max = maxQuantityOf(it.equipmentId);
        if (max >= 1 && it.quantity > max) { changed = true; return { ...it, quantity: max }; }
        return it;
      });
      return changed ? next : prev;
    });
  }, [freeUnits, equipment]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateScheduleDate = (field, value) => {
    setSchedule((prev) => {
      const next = { ...prev, [field]: value };
      if (next.startDate && next.endDate && next.endDate < next.startDate) next.endDate = '';
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const form = new FormData(e.currentTarget);
    const adviserName = isInstructor ? String(form.get('section_list') || '').trim() : form.get('adviser_name');
    const studentId = user?.user_metadata?.student_id || form.get('student_id');

    if (!studentId || !studentId.toString().trim()) {
      triggerError('Please fill in the Student Number / ID Number field.');
      return;
    }

    if (!/^\d+$/.test(studentId.toString().trim())) {
      triggerError('Student Number / ID Number must contain numbers only.');
      return;
    }

    if (!isInstructor && (!adviserName || !adviserName.toString().trim())) {
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
      if (isOutOfService(eq)) {
        triggerError(`"${eq.name}" is currently ${equipmentStatusLabel(eq.status).toLowerCase()} and cannot be reserved.`);
        return;
      }
    }

    // Friday-Sunday is decided per equipment (each item has its own ON/OFF switch).
    // A Fri-Sun date is only bookable when EVERY selected equipment allows it;
    // otherwise it is shown as "not available" and left out of the booking.
    if (isRangeTooLong(schedule)) {
      triggerError(`You can book at most ${MAX_BOOKING_DAYS} dates in one reservation.`);
      return;
    }
    const slots = slotsForSchedule();
    const dtError = validateSlots(slots, { subject: 'This equipment' });
    if (dtError) {
      triggerError(dtError);
      return;
    }

    if (!stakeholderType) {
      triggerError('Please select a stakeholder type.');
      return;
    }

    if (isCvsuStakeholder && !unitCollege) {
      triggerError('Please select your College / Unit.');
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

    for (const section of sections) {
      if (!section.name.trim()) {
        triggerError('Please enter the Section name of the class list (e.g. BSIT 3-1).');
        return;
      }
      if (!parseClassList(section.text).length) {
        triggerError(`Please paste or upload the class list of Section ${section.name.trim()}.`);
        return;
      }
    }

    const rawFields = {
      // Name always comes from the account (the field on screen is locked).
      researcher_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || '',
      email: form.get('email') || '',
      phone: user?.user_metadata?.phone || form.get('phone') || '',
      study_title: form.get('study_title') || '',
      research_purpose: form.get('purpose'),
    };
    const fieldErr = validateReservationFields(rawFields);
    if (fieldErr) {
      triggerError(fieldErr);
      return;
    }

    let pendingCounts;
    try {
      pendingCounts = await fetchPendingReservationCounts([...new Set(slotsForSchedule().map((slot) => slot.date))]);
    } catch (countError) {
      console.error('Error checking pending reservation limit:', countError);
      triggerError('Could not verify pending bookings for the selected date. Please try again.');
      return;
    }

    const fullDate = getFullPendingReservationDate(pendingCounts);
    if (fullDate) {
      triggerError(getPendingReservationLimitMessage(fullDate));
      return;
    }

    // Quantity must fit the units still free on every chosen date (checked again right now).
    try {
      const free = await loadFreeUnits([...new Set(items.map((it) => it.equipmentId))], slotsForSchedule());
      for (const it of items) {
        const eq = equipment.find((e) => e.id === it.equipmentId);
        const units = Math.min(Number(eq?.quantity) || 0, free[it.equipmentId] ?? (Number(eq?.quantity) || 0));
        if (units <= 0) {
          triggerError(`"${eq?.name || 'This equipment'}" has no units left on your selected date/time. Please choose another schedule.`);
          return;
        }
        if (it.quantity > units) {
          triggerError(`Only ${units} unit${units === 1 ? '' : 's'} of "${eq?.name}" ${units === 1 ? 'is' : 'are'} available on your selected date/time. Please lower the quantity.`);
          return;
        }
      }
    } catch (availError) {
      console.error('Error checking equipment availability:', availError);
      triggerError('Could not check equipment availability. Please try again.');
      return;
    }

    // One row per equipment per booked date; several rows share one batch_id (one reference).
    const finalSlots = slotsForSchedule();
    const batchId = items.length * finalSlots.length > 1 && crypto?.randomUUID ? crypto.randomUUID() : null;

    const sharedFields = {
      user_id: user.id,
      researcher_name: sanitizeText(rawFields.researcher_name, { maxLength: 150 }),
      email: rawFields.email.trim(),
      phone: rawFields.phone ? rawFields.phone.trim() : null,
      purpose: sanitizeText(rawFields.research_purpose, { maxLength: 1000 }),
      special_requirements: sanitizeText(form.get('special_requirements'), { maxLength: 500 }),
      adviser_name: sanitizeText(adviserName, { maxLength: isInstructor ? 200 : 150 }),
      study_title: sanitizeText(rawFields.study_title, { maxLength: 300 }),
      unit_college: sanitizeText(unitCollege, { maxLength: 150 }),
      stakeholder_type: stakeholderType,
      status: 'pending',
      batch_id: batchId,
      members_list: members
        .filter((m) => m.name && m.name.trim())
        .map((m) => `${sanitizeText(m.name, { maxLength: 150 })} — Student No. ${sanitizeText(m.studentNumber, { maxLength: 50 })}`)
        .concat(isCvsuStakeholder ? sectionMemberEntries(sections) : []),
    };

    const rows = finalSlots.flatMap((slot) =>
      items.map((it) => ({
        ...sharedFields,
        start_datetime: manilaInputToISO(slot.startDatetime),
        end_datetime: manilaInputToISO(slot.endDatetime),
        equipment_id: it.equipmentId,
        quantity_reserved: it.quantity,
      }))
    );

    const { data, error: err } = await supabase
      .from('equipment_reservations')
      .insert(rows)
      .select('id');

    if (err) {
      triggerError(err.message.includes(PENDING_RESERVATION_LIMIT_ERROR)
        ? getPendingReservationLimitMessage()
        : err.message);
    } else {
      sendReservationEmail({ event: 'new', reservationType: 'equipment', ids: (data || []).map((r) => r.id) });
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
    setSchedule(emptySchedule());
    setStakeholderChoice('');
    setUnitCollege(lockedUnitCollege);
    setMembers([{ name: '' }]);
    setSections([]);
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
        <div className="bg-card rounded-2xl shadow-lg p-6 sm:p-14 text-center animate-fade-up">
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

  return (
    <div className="max-w-[960px] mx-auto">
      <div className="text-center mb-8">
        <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
          <span className="text-xs text-muted-foreground font-semibold tracking-widest uppercase">
            UREC-QF-32
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">
            <Hash className="w-3 h-3" /> Form Ref: {tempId}
          </span>
        </div>
        <h1 className="font-heading text-xl sm:text-2xl text-primary font-bold mb-1">
          Request to Use Equipment
        </h1>
        <p className="text-muted-foreground text-sm">
          Research Center — Technical Services Division
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card rounded-2xl shadow-lg p-4 sm:p-8 md:p-10 animate-fade-up space-y-8">
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
                tabIndex={-1}
                aria-readonly="true"
                title="Taken from your account. It cannot be changed here."
                className={`${inputClass} bg-muted/50 cursor-not-allowed select-none pointer-events-none`}
              />
            </div>
            <div>
              <label className="block mb-1.5 font-semibold text-sm text-foreground">
                Student Number / ID Number <span className="text-destructive">*</span>
              </label>
              <input
                name="student_id"
                key={`sid-${user?.id || ''}`}
                defaultValue={user?.user_metadata?.student_id || ''}
                readOnly={!!user?.user_metadata?.student_id}
                tabIndex={user?.user_metadata?.student_id ? -1 : undefined}
                title={user?.user_metadata?.student_id ? 'Taken from your account. It cannot be changed here.' : undefined}
                required
                inputMode="numeric"
                pattern="[0-9]*"
                onInput={(e) => { e.target.value = e.target.value.replace(/\D/g, ''); }}
                placeholder="e.g. 202302603"
                className={`${inputClass} ${user?.user_metadata?.student_id ? 'bg-muted/50 cursor-not-allowed select-none pointer-events-none' : ''}`}
              />
            </div>
            <div>
              <label className="block mb-1.5 font-semibold text-sm text-foreground">
                Contact Number <span className="text-destructive">*</span>
              </label>
              <input
                name="phone"
                key={`phone-${user?.id || ''}`}
                defaultValue={user?.user_metadata?.phone || ''}
                readOnly={!!user?.user_metadata?.phone}
                tabIndex={user?.user_metadata?.phone ? -1 : undefined}
                title={user?.user_metadata?.phone ? 'Taken from your account. It cannot be changed here.' : undefined}
                type="tel"
                inputMode="numeric"
                maxLength={11}
                pattern="[0-9]{1,11}"
                onInput={(e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 11); }}
                placeholder="e.g. 09171234567"
                required
                className={`${inputClass} ${user?.user_metadata?.phone ? 'bg-muted/50 cursor-not-allowed select-none pointer-events-none' : ''}`}
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
                      onChange={() => { setStakeholderChoice(opt.value); setUnitCollege(''); }}
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
              {lockedUnitCollege ? (
                <input
                  name="unit_college"
                  value={lockedUnitCollege}
                  readOnly
                  tabIndex={-1}
                  title="Taken from your account. It cannot be changed here."
                  className={`${inputClass} bg-muted/50 cursor-not-allowed select-none pointer-events-none`}
                />
              ) : isCvsuStakeholder ? (
                <FormSelect
                  value={unitCollege}
                  onChange={setUnitCollege}
                  placeholder="Select your college…"
                  className={inputClass}
                  options={CVSU_COLLEGES}
                />
              ) : (
                <input
                  name="unit_college"
                  required
                  value={unitCollege}
                  onChange={(e) => setUnitCollege(e.target.value)}
                  placeholder="e.g. Company, school, or agency name"
                  className={inputClass}
                />
              )}
            </div>
            {isInstructor ? (
              <div className="md:col-span-2">
                <label className="block mb-1.5 font-semibold text-sm text-foreground">
                  List of Section(s) <span className="text-xs font-normal text-muted-foreground ml-1">(optional)</span>
                </label>
                <input name="section_list" maxLength={200} placeholder="e.g. BSIT 3-1, BSIT 3-2" className={inputClass} />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Sections who will come with you. Leave blank if none. If a whole section is coming, you don't need to list each student below.
                </p>
              </div>
            ) : (
              <div className="md:col-span-2">
                <label className="block mb-1.5 font-semibold text-sm text-foreground">
                  Adviser / Supervisor / Project Leader <span className="text-destructive">*</span>
                </label>
                <input name="adviser_name" required placeholder="e.g. Dr. Maria Santos" className={inputClass} />
              </div>
            )}
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
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <label className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" />
                List of Members / Users
                <span className="text-xs font-normal text-muted-foreground normal-case ml-1">(those who will use the equipment{isInstructor ? '; optional if a whole section is coming' : ''})</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={addMember}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-primary/30 text-primary text-xs font-semibold hover:border-primary hover:bg-primary/5 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Member
                </button>
                {isCvsuStakeholder && (
                  <button
                    type="button"
                    onClick={() => setSections([...sections, { name: '', text: '' }])}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-primary/30 text-primary text-xs font-semibold hover:border-primary hover:bg-primary/5 transition-all cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" /> Add Section List
                  </button>
                )}
              </div>
            </div>
            <div className="hidden md:block rounded-xl border-2 !border-[color:var(--field-border)] overflow-hidden overflow-x-auto">
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
            <div className="md:hidden space-y-3">
              {members.map((member, idx) => (
                <div key={idx} className="rounded-xl border-2 !border-[color:var(--field-border)] bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Member #{idx + 1}</span>
                    {members.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMember(idx)}
                        aria-label="Remove member"
                        className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={member.name}
                    onChange={(e) => updateMember(idx, 'name', e.target.value)}
                    placeholder="Full name, e.g. Maria Santos"
                    className="w-full px-3 py-2.5 border-2 border-border rounded-lg text-base bg-card text-foreground focus:outline-none focus:border-primary"
                  />
                  <input
                    type="text"
                    value={member.studentNumber}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    onChange={(e) => updateMember(idx, 'studentNumber', e.target.value)}
                    placeholder="Student number, e.g. 202302604"
                    className="w-full px-3 py-2.5 border-2 border-border rounded-lg text-base bg-card text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              ))}
            </div>
            {isCvsuStakeholder && (
              <>
                <SectionListInput sections={sections} onChange={setSections} />
                {!sections.length && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Coming as a whole section? Use <strong>Add Section List</strong> to paste or upload your class list instead of adding each member.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="rounded-2xl border-2 !border-[color:var(--field-border)] bg-white/30 p-3 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
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

            {/* Filters for the equipment lists below */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed !border-[color:var(--field-border)] px-3 py-2.5">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Filter</span>
              <div className="flex-1 min-w-[220px]">
                <FormSelect
                  value={categoryFilter}
                  onChange={(v) => setCategoryFilter(v || ALL_CATEGORIES)}
                  placeholder="All categories"
                  className={inputClass}
                  options={categoryOptions}
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={availableOnly}
                  onChange={(e) => setAvailableOnly(e.target.checked)}
                  className="w-4 h-4 accent-[hsl(var(--primary))] cursor-pointer"
                />
                Available only
                <span className="text-xs font-normal text-muted-foreground">({timedSlots.length ? 'on your selected date/time' : 'right now'})</span>
              </label>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => {
                const eq = equipment.find((e) => e.id === item.equipmentId);
                return (
                  <div key={idx} className="space-y-3">
                    <div className="flex flex-wrap sm:flex-nowrap gap-2 items-start">
                      <div className="basis-full sm:basis-64 sm:flex-none min-w-0">
                        <FormSelect
                          value={item.laboratory || ALL_LABS}
                          onChange={(v) => updateItemLaboratory(idx, v)}
                          placeholder="All laboratories"
                          className={inputClass}
                          options={laboratoryOptions}
                        />
                      </div>
                      <FormSelect
                        searchable
                        value={item.equipmentId}
                        onChange={(v) => updateItemEquipment(idx, Number(v))}
                        placeholder="Select equipment…"
                        wrapperClassName="flex-1 basis-full sm:basis-0 min-w-0"
                        className={inputClass}
                        options={equipmentOptionsFor(idx).map((option) => ({
                          value: option.id,
                          // the laboratory is already the group heading / filter, so only the equipment name is shown
                          label: `${option.name}${option.brand ? ` (${option.brand})` : ''}${isOutOfService(option) ? ` — ${equipmentStatusLabel(option.status)}` : !option.allow_non_official_hours ? ' — Mon–Thu only' : ''}`,
                          disabled: isOutOfService(option),
                          // headings by laboratory while browsing "All laboratories"; searching also matches the lab and equipment type
                          group: item.laboratory ? undefined : labLabelOf(option),
                          keywords: `${labLabelOf(option)} ${categoryOf(option)}`,
                        }))}
                      />
                      <div className="flex-1 sm:flex-none sm:w-28">
                        <input
                          type="number"
                          min={1}
                          max={item.equipmentId && maxQuantityOf(item.equipmentId) >= 1 ? maxQuantityOf(item.equipmentId) : undefined}
                          disabled={!!item.equipmentId && maxQuantityOf(item.equipmentId) < 1}
                          title={item.equipmentId ? `Up to ${maxQuantityOf(item.equipmentId)} available` : undefined}
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
                      <div className={`border rounded-xl p-4 text-sm flex items-start gap-3 ${isOutOfService(eq) ? 'bg-destructive/5 border-destructive/25' : 'bg-white/30 !border-[color:var(--field-border)]'}`}>
                        <Info className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isOutOfService(eq) ? 'text-destructive' : 'text-primary'}`} />
                        <div>
                          <p className={`font-semibold mb-1 ${isOutOfService(eq) ? 'text-destructive' : 'text-primary'}`}>
                            {eq.name}
                            <span className="ml-2 text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary px-2 py-0.5 rounded-full align-middle">{categoryOf(eq)}</span>
                            {isOutOfService(eq) && (
                              <span className="ml-2 text-xs font-bold bg-destructive/15 text-destructive px-2 py-0.5 rounded-full">{equipmentStatusLabel(eq.status)}</span>
                            )}
                          </p>
                          {isOutOfService(eq) ? (
                            <p className="text-destructive/80 text-xs">This equipment is currently {equipmentStatusLabel(eq.status).toLowerCase()} and cannot be reserved.</p>
                          ) : (
                            <>
                              {eq.brand && (
                                <p className="text-muted-foreground mb-1">
                                  {eq.brand}{eq.model ? ` · ${eq.model}` : ''}
                                </p>
                              )}
                              <p className="text-muted-foreground">
                                <strong>Location:</strong> {labLabelOf(eq)}
                              </p>
                              {(() => {
                                const total = totalUnitsOf(eq.id);
                                const max = maxQuantityOf(eq.id);
                                const datesPicked = freeUnits[eq.id] != null;
                                if (datesPicked && max < 1) {
                                  return <p className="mt-1 text-xs font-semibold text-destructive">No units left on your selected date/time — all {total} are already reserved. Please choose another schedule.</p>;
                                }
                                return (
                                  <p className={`mt-1 text-xs font-semibold ${datesPicked && max < total ? 'text-warning' : 'text-success'}`}>
                                    {datesPicked
                                      ? `${max} of ${total} unit${total === 1 ? '' : 's'} available on your selected date/time — you can reserve up to ${max}.`
                                      : `${total} unit${total === 1 ? '' : 's'} in total. Set your date and time to see how many are free.`}
                                    {checkingUnits && <span className="font-normal text-muted-foreground"> (checking…)</span>}
                                  </p>
                                );
                              })()}
                              {eq.description && (
                                <p className="text-muted-foreground mt-1">{eq.description}</p>
                              )}
                              {!eq.allow_non_official_hours && (
                                <p className="mt-2 text-xs font-semibold text-destructive">
                                  Not accepting Friday–Sunday (non-official hours) reservations. Please choose Monday to Thursday.
                                </p>
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
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1.5 font-semibold text-xs text-muted-foreground">
                    Start Date
                  </label>
                  <BookingDateTimeInput dateOnly value={schedule.startDate ? `${schedule.startDate}T00:00` : ''} onChange={(v) => updateScheduleDate('startDate', v.slice(0, 10))} min={getMinDatetimeLocal()}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block mb-1.5 font-semibold text-xs text-muted-foreground">
                    End Date <span className="font-normal">(only if booking more than one day)</span>
                  </label>
                  <BookingDateTimeInput dateOnly value={schedule.endDate ? `${schedule.endDate}T00:00` : ''} onChange={(v) => updateScheduleDate('endDate', v.slice(0, 10))} min={schedule.startDate ? `${schedule.startDate}T00:00` : getMinDatetimeLocal()}
                    className={inputClass}
                  />
                </div>
              </div>
              <DailySchedule
                startDate={schedule.startDate}
                endDate={schedule.endDate}
                dayTimes={schedule.dayTimes}
                skipped={schedule.skipped}
                allowNonOfficial={allowNonOfficial}
                unavailableNote={blockingEquipment.length ? `${blockingEquipment.join(', ')} ${blockingEquipment.length > 1 ? 'are' : 'is'} not accepting reservations on Fridays to Sundays (non-official hours).` : 'Friday to Sunday are non-official hours.'}
                onChange={({ dayTimes, skipped }) => setSchedule((prev) => ({ ...prev, dayTimes, skipped }))}
                selectClass={inputClass}
              />
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
        <div className="flex sm:justify-end pt-6 border-t border-border">
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto gradient-primary text-primary-foreground px-8 py-3 rounded-xl font-bold text-base border-none cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UserReserveEquipment;