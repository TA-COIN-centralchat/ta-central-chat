export const shortId = (id) => {
  if (!id) return 'N/A';
  const str = String(id);
  return str.length > 12 ? `${str.slice(0, 8)}...` : str;
};

export const formatMessageTime = (value, fallback = '-') => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};
