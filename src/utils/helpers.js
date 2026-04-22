import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge class names; tailwind-merge resolves conflicting utilities last-wins. */
export const cn = (...inputs) => twMerge(clsx(inputs));

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export const copyToClipboard = async (text) => {
  await navigator.clipboard.writeText(text);
};

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const debounce = (fn, delay = 500) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

export const groupBy = (arr, key) =>
  arr.reduce((acc, item) => {
    (acc[item[key]] = acc[item[key]] || []).push(item);
    return acc;
  }, {});