export const money = (n, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: n % 1 ? 2 : 0 }).format(n ?? 0);

export const compact = (n) => {
  if (n == null) return '0';
  if (n < 1000) return String(n);
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
};

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** 384 -> "6h 24m", 47 -> "47m" */
export const duration = (minutes) => {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};

/** 384 -> "6.4 hours" for the long form used in course meta */
export const hours = (minutes) => `${(minutes / 60).toFixed(1).replace(/\.0$/, '')} hours`;

export const dateLong = (value) =>
  value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

export const dateShort = (value) =>
  value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export const monthsAgo = (n) => {
  if (!n || n < 1) return 'this month';
  if (n === 1) return 'a month ago';
  if (n < 12) return `${n} months ago`;
  const y = Math.round(n / 12);
  return y === 1 ? 'a year ago' : `${y} years ago`;
};

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
