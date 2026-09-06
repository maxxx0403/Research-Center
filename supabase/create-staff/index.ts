// supabase/functions/create-staff/index.ts
//
// Handles two actions:
//   1. Create staff account  -> { email, password, full_name, room_ids: number[] }
//   2. Delete staff account  -> { action: 'delete', user_id: string }
//
// NOTE: this replaces the old version that required { email, password, floor }.
// The frontend (Settings.jsx) now sends room_ids (an array of laboratory ids)
// instead of a single floor string, so the validation + insert logic below
// was updated to match the staff_room_assignments table.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();

    // ── Delete staff ──
    if (body.action === 'delete') {
      const { user_id } = body;
      if (!user_id) return json({ error: 'user_id is required.' }, 400);

      // staff_room_assignments rows are removed via ON DELETE CASCADE when the
      // user is deleted; if your FK isn't cascading, delete them explicitly first:
      await supabaseAdmin.from('staff_room_assignments').delete().eq('user_id', user_id);
      await supabaseAdmin.from('user_roles').delete().eq('user_id', user_id);

      const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (delError) return json({ error: delError.message }, 400);

      return json({ success: true });
    }

    // ── Create staff ──
    const { email, password, full_name, room_ids } = body;

    if (!email || !password || !Array.isArray(room_ids) || room_ids.length === 0) {
      return json({ error: 'Email, password, and at least one room are required.' }, 400);
    }
    if (password.length < 6) {
      return json({ error: 'Password must be at least 6 characters.' }, 400);
    }

    // 1. Create the auth user
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: full_name ? { full_name } : undefined,
    });

    if (createError) return json({ error: createError.message }, 400);

    const userId = created.user.id;

    // 2. Assign the staff role (must_change_password defaults to true so the
    // staff member is prompted to set their own password on first login)
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userId, role: 'staff', must_change_password: true });

    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(userId); // rollback
      return json({ error: roleError.message }, 400);
    }

    // 3. Assign the selected rooms
    const assignments = room_ids.map((laboratory_id: number) => ({
      user_id: userId,
      laboratory_id,
    }));

    const { error: roomsError } = await supabaseAdmin
      .from('staff_room_assignments')
      .insert(assignments);

    if (roomsError) {
      await supabaseAdmin.from('user_roles').delete().eq('user_id', userId); // rollback
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return json({ error: roomsError.message }, 400);
    }

    return json({ success: true, user_id: userId });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500);
  }
});