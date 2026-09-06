export const resolveRoleFromUser = (user) => {
  if (!user) return 'user';

  const userMetadataRole = user?.user_metadata?.role;
  const appMetadataRole = user?.app_metadata?.role;
  const role = userMetadataRole || appMetadataRole || 'user';

  return role === 'admin' ? 'admin' : 'user';
};
