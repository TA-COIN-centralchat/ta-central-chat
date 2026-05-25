export const DEFAULT_ROLE = null;

export const getCurrentUserRole = () => {
  return localStorage.getItem('currentUserRole') || DEFAULT_ROLE;
};

export const getCurrentUserName = () => {
  return localStorage.getItem('currentUserName') || 'Unknown User';
};

export const getCurrentAgentId = () => {
  return localStorage.getItem('currentAgentId') || null;
};

export const getCurrentUserEmail = () => {
  return localStorage.getItem('currentUserEmail') || null;
};

export const clearCurrentUser = () => {
  localStorage.removeItem('currentUserRole');
  localStorage.removeItem('currentUserName');
  localStorage.removeItem('currentAgentId');
  localStorage.removeItem('currentUserEmail');
};