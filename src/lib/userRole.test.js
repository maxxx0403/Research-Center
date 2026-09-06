import { describe, it, expect } from 'vitest';
import { resolveRoleFromUser } from './userRole';

describe('resolveRoleFromUser', () => {
  it('returns the role from user metadata when available', () => {
    expect(resolveRoleFromUser({ user_metadata: { role: 'admin' } })).toBe('admin');
  });

  it('falls back to app metadata when user metadata is missing', () => {
    expect(resolveRoleFromUser({ app_metadata: { role: 'user' } })).toBe('user');
  });

  it('defaults to user when no role is provided', () => {
    expect(resolveRoleFromUser({ id: 'user-123' })).toBe('user');
  });
});
