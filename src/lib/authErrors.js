export const getAuthErrorMessage = (error) => {
  if (!error) return '';

  const message = typeof error === 'string' ? error : error.message || '';
  const normalized = message.toLowerCase();

  if (normalized.includes('failed to fetch') || normalized.includes('fetch failed') || normalized.includes('network request failed')) {
    return 'Unable to reach the authentication service. Please check your internet connection and Supabase configuration.';
  }

  if (normalized.includes('invalid login credentials') || normalized.includes('invalid email or password')) {
    return 'Invalid email or password.';
  }

  return message || 'An unexpected error occurred. Please try again.';
};
