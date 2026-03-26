const GUEST_NICKNAME_KEY = 'hikepal_guest_nickname';

const buildGuestCode = (len: number = 4) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
};

export const getOrCreateGuestNickname = (): string => {
  if (typeof window === 'undefined') return 'Guest';

  const existing =
    localStorage.getItem(GUEST_NICKNAME_KEY) ||
    localStorage.getItem('hikepal_nickname') ||
    localStorage.getItem('hikepal_solo_nickname') ||
    localStorage.getItem('hikepal_group_nickname');

  if (existing && existing.trim()) return existing.trim();

  const generated = `Guest-${buildGuestCode(4)}`;
  localStorage.setItem(GUEST_NICKNAME_KEY, generated);
  if (!localStorage.getItem('hikepal_nickname')) localStorage.setItem('hikepal_nickname', generated);
  if (!localStorage.getItem('hikepal_solo_nickname')) localStorage.setItem('hikepal_solo_nickname', generated);
  if (!localStorage.getItem('hikepal_group_nickname')) localStorage.setItem('hikepal_group_nickname', generated);
  return generated;
};

export const isGuestLikeUserId = (userId?: string | null): boolean => {
  if (!userId) return false;
  return userId === 'guest_user' || userId.startsWith('guest_') || userId.startsWith('mock_');
};
