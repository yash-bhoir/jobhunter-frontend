import { format, formatDistanceToNow, isValid } from 'date-fns';

export const fDate     = (d) => isValid(new Date(d)) ? format(new Date(d), 'dd MMM yyyy') : '-';
export const fDateTime = (d) => isValid(new Date(d)) ? format(new Date(d), 'dd MMM yyyy, hh:mm a') : '-';
export const fAgo      = (d) => isValid(new Date(d)) ? formatDistanceToNow(new Date(d), { addSuffix: true }) : '-';

export const fCurrency = (n, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n || 0);

export const fNumber   = (n) => new Intl.NumberFormat('en-IN').format(n || 0);
export const truncate  = (s, n = 120) => s?.length > n ? s.slice(0, n) + '...' : (s || '');
export const initials  = (name) => (name || '').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?';
export const matchColor = (score) => score >= 75 ? 'green' : score >= 50 ? 'amber' : 'red';
export const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';