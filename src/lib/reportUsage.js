// Reports only record what was actually USED.
// A reservation counts as "used" once staff marked it as in use or completed.
// Pending, reserved (approved but not started), cancelled and rejected ones are not recorded.
export const USED_STATUSES = ['in_use', 'completed'];