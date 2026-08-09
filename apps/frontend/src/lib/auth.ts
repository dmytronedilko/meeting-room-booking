import type { UserDto } from '@office/shared';

/**
 * JWT storage decision: an HttpOnly cookie set by the backend — JS never sees
 * the token (XSS cannot exfiltrate it), the browser attaches it automatically.
 * localStorage keeps only the non-sensitive user profile, used for the header
 * greeting and as the "probably logged in" hint for the client-side guard;
 * the real authority is always the API's 401.
 */
const USER_KEY = 'mrb.user';

export function saveUser(user: UserDto): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearUser(): void {
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): UserDto | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as UserDto;
  } catch {
    return null;
  }
}
