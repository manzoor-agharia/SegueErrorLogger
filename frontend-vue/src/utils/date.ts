/**
 * Stand-ins for the Angular `DatePipe` formats the templates used. Angular's pipe isn't
 * available outside Angular, so these reproduce 'short', 'medium' and 'mediumDate' with Intl.
 */
const SHORT = new Intl.DateTimeFormat(undefined, {
  month: 'numeric',
  day: 'numeric',
  year: '2-digit',
  hour: 'numeric',
  minute: '2-digit',
});

const MEDIUM = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
});

const MEDIUM_DATE = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export type DateFormat = 'short' | 'medium' | 'mediumDate';

export function formatDate(value: string | null | undefined, format: DateFormat = 'short'): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  if (format === 'medium') return MEDIUM.format(date);
  if (format === 'mediumDate') return MEDIUM_DATE.format(date);
  return SHORT.format(date);
}
