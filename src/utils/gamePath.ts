export interface BuildGamePathOptions {
  contestId?: string | null;
  inviteCode?: string | null;
  entry?: string | null;
  quickPlayReason?: string | null;
}

export const buildGamePath = (tableId?: string | null, options: BuildGamePathOptions = {}) => {
  if (!tableId) {
    return '/tables';
  }

  const params = new URLSearchParams();
  if (options.contestId) {
    params.set('contestId', options.contestId);
  }
  if (options.inviteCode) {
    params.set('inviteCode', options.inviteCode);
  }
  if (options.entry) {
    params.set('entry', options.entry);
  }
  if (options.quickPlayReason) {
    params.set('quickPlayReason', options.quickPlayReason);
  }

  const search = params.toString();
  return `/game/${tableId}${search ? `?${search}` : ''}`;
};
