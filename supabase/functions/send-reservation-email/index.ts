// supabase/functions/send-reservation-email/index.ts
//
// Sends Gmail notifications for reservations:
//   event: 'new'      -> email to ADMIN(s) + STAFF assigned to the lab(s)
//                        (+ a "we received your request" email to the user)
//   event: 'approved' -> email to the user who reserved
//   event: 'rejected' -> email to the user who reserved (with the reason)
//
// Recipients are NEVER taken from the request body. The function looks up the
// reservation rows itself, so a caller cannot make it email arbitrary people.
//
// Secrets (set once, see setup steps):
//   GMAIL_USER          e.g. yourlab.system@gmail.com
//   GMAIL_APP_PASSWORD  16-char Google "App password" (NOT your normal password)
//   APP_URL             e.g. https://your-site.vercel.app  (optional, for links)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });

const layout = (title: string, color: string, body: string, appUrl?: string) => `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:${color};color:#fff;padding:14px 20px;font-size:18px;font-weight:bold">${esc(title)}</div>
  <div style="padding:20px;color:#111827;font-size:14px;line-height:1.6">${body}
    ${appUrl ? `<p style="margin-top:20px"><a href="${esc(appUrl)}" style="background:${color};color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open the system</a></p>` : ''}
  </div>
  <div style="background:#f9fafb;padding:10px 20px;font-size:12px;color:#6b7280">Automated message from the Reservation System. Please do not reply.</div>
</div>`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const gmailUser = Deno.env.get('GMAIL_USER');
    const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD');
    const appUrl = Deno.env.get('APP_URL') ?? undefined;
    if (!gmailUser || !gmailPass) return json({ error: 'Gmail secrets are not configured.' }, 500);

    const admin = createClient(url, serviceKey);

    // ── Who is calling? ──
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: caller, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !caller?.user) return json({ error: 'Unauthorized.' }, 401);
    const callerId = caller.user.id;

    const { data: roleRows } = await admin.from('user_roles').select('role').eq('user_id', callerId);
    const callerIsStaffOrAdmin = (roleRows ?? []).some((r) => r.role === 'admin' || r.role === 'staff');

    // ── Input ──
    const { event, reservationType, ids } = await req.json();
    if (!['new', 'approved', 'rejected'].includes(event)) return json({ error: 'Invalid event.' }, 400);
    if (!['lab', 'equipment'].includes(reservationType)) return json({ error: 'Invalid reservationType.' }, 400);
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) return json({ error: 'Invalid ids.' }, 400);

    // ── Load the reservation rows (source of truth) ──
    const isLab = reservationType === 'lab';
    const table = isLab ? 'reservations' : 'equipment_reservations';
    const select = isLab
      ? '*, laboratories(id, lab_name, lab_code)'
      : '*, equipment(id, name, laboratory_id, laboratories(id, lab_name, lab_code))';
    const { data: rows, error: rowErr } = await admin.from(table).select(select).in('id', ids);
    if (rowErr || !rows?.length) return json({ error: 'Reservation not found.' }, 404);

    const owner = rows[0];
    // All rows of one submission must belong to the same user.
    if (rows.some((r: any) => r.user_id !== owner.user_id)) return json({ error: 'Mixed owners.' }, 400);

    // ── Authorization ──
    if (event === 'new') {
      if (owner.user_id !== callerId) return json({ error: 'Forbidden.' }, 403);
      if (rows.some((r: any) => r.status !== 'pending')) return json({ error: 'Not pending.' }, 400);
    } else {
      if (!callerIsStaffOrAdmin) return json({ error: 'Forbidden.' }, 403);
      const expected = event === 'approved' ? 'reserved' : 'rejected';
      if (rows.some((r: any) => r.status !== expected)) return json({ error: `Status is not ${expected}.` }, 400);
    }

    // ── Helpers ──
    const emailOfUser = async (uid: string): Promise<string | null> => {
      const { data } = await admin.auth.admin.getUserById(uid);
      return data?.user?.email ?? null;
    };

    const labIds: number[] = [
      ...new Set(
        rows
          .map((r: any) => (isLab ? r.laboratory_id : r.equipment?.laboratory_id))
          .filter((v: unknown) => v != null),
      ),
    ] as number[];

    const userEmail: string | null = owner.email || (await emailOfUser(owner.user_id));
    const prefix = isLab ? 'RC' : 'EQ';
    const refNo = `#${prefix}${String(Math.min(...ids.map(Number))).padStart(5, '0')}`;
    const kind = isLab ? 'Laboratory reservation' : 'Equipment request';

    const items = rows
      .map((r: any) =>
        isLab
          ? `${esc(r.laboratories?.lab_name ?? 'Laboratory')} (${esc(r.laboratories?.lab_code ?? '')})`
          : `${esc(r.equipment?.name ?? 'Equipment')} × ${esc(r.quantity_reserved)}`,
      )
      .join('<br>');
    const when = `${fmt(owner.start_datetime)} – ${fmt(owner.end_datetime)}`;
    const summary = `
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:4px 0;color:#6b7280;width:130px">Reference</td><td><b>${esc(refNo)}</b></td></tr>
        <tr><td style="padding:4px 0;color:#6b7280">Type</td><td>${kind}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;vertical-align:top">${isLab ? 'Laboratory' : 'Equipment'}</td><td>${items}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280">Schedule</td><td>${esc(when)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280">Requested by</td><td>${esc(owner.researcher_name)}</td></tr>
      </table>`;

    const mails: { to: string; subject: string; html: string }[] = [];

    if (event === 'new') {
      // Admins
      const { data: admins } = await admin.from('user_roles').select('user_id').eq('role', 'admin');
      // Staff assigned to the lab(s) involved
      let staffIds: string[] = [];
      if (labIds.length) {
        const { data: sra } = await admin.from('staff_room_assignments').select('user_id').in('laboratory_id', labIds);
        staffIds = (sra ?? []).map((s) => s.user_id);
      }
      const recipientIds = [...new Set([...(admins ?? []).map((a) => a.user_id), ...staffIds])];
      const recipients = (await Promise.all(recipientIds.map(emailOfUser))).filter(Boolean) as string[];

      for (const to of [...new Set(recipients)]) {
        mails.push({
          to,
          subject: `New ${kind.toLowerCase()} ${refNo} — action needed`,
          html: layout('New reservation request', '#b45309',
            `<p>A new request is waiting for your approval.</p>${summary}
             <p><b>Purpose:</b> ${esc(isLab ? owner.research_purpose : owner.purpose)}</p>`, appUrl),
        });
      }
      if (userEmail) {
        mails.push({
          to: userEmail,
          subject: `We received your ${kind.toLowerCase()} ${refNo}`,
          html: layout('Request received', '#1d4ed8',
            `<p>Hi ${esc(owner.researcher_name)}, your request was submitted and is now <b>pending</b>. You will get another email once it is approved or rejected.</p>${summary}`, appUrl),
        });
      }
    } else if (userEmail) {
      if (event === 'approved') {
        mails.push({
          to: userEmail,
          subject: `Approved: ${kind} ${refNo}`,
          html: layout('Reservation approved ✔', '#15803d',
            `<p>Hi ${esc(owner.researcher_name)}, good news — your request has been <b>approved</b>.</p>${summary}`, appUrl),
        });
      } else {
        const reason = owner.rejection_reason;
        mails.push({
          to: userEmail,
          subject: `Rejected: ${kind} ${refNo}`,
          html: layout('Reservation rejected', '#b91c1c',
            `<p>Hi ${esc(owner.researcher_name)}, unfortunately your request has been <b>rejected</b>.</p>${summary}
             <p><b>Reason:</b> ${reason ? esc(reason) : 'No reason was given. Please contact the laboratory.'}</p>`, appUrl),
        });
      }
    }

    if (!mails.length) return json({ success: true, sent: 0 });

    // ── Send via Gmail SMTP ──
    const client = new SMTPClient({
      connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: gmailUser, password: gmailPass } },
    });
    let sent = 0;
    const failed: string[] = [];
    for (const m of mails) {
      try {
        await client.send({ from: `Reservation System <${gmailUser}>`, to: m.to, subject: m.subject, html: m.html, content: 'auto' });
        sent++;
      } catch (e) {
        console.error('send failed for', m.to, e);
        failed.push(m.to);
      }
    }
    await client.close();
    return json({ success: failed.length === 0, sent, failed });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
