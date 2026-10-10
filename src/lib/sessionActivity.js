// Remembers when the user was last active, so a session that was left
// unused (browser closed, laptop asleep, tab forgotten) can be ended
// the next time the app opens instead of silently staying logged in.
const KEY = 'cvsurc:last-activity';

export const markActivity = () => {
  try { localStorage.setItem(KEY, String(Date.now())); } catch { /* storage unavailable */ }
};

export const clearActivity = () => {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
};

// True when there is no activity record, or the last activity is older than `limitMs`.
export const isSessionStale = (limitMs) => {
  try {
    const last = Number(localStorage.getItem(KEY));
    return !last || Date.now() - last > limitMs;
  } catch {
    return false;
  }
};