const APP_TIME_ZONE = 'Asia/Manila';

const datePartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function dateKey(value: Date) {
  const parts = datePartsFormatter.formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function yearKey(value: Date) {
  return dateKey(value).slice(0, 4);
}

export function formatRelativeDate(value: string, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  const differenceInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (differenceInSeconds >= 0 && differenceInSeconds < 60) return 'Just now';
  if (differenceInSeconds >= 60 && differenceInSeconds < 3600) return `${Math.floor(differenceInSeconds / 60)}m ago`;

  const today = dateKey(now);
  const notificationDay = dateKey(date);
  if (notificationDay === today) {
    return `Today, ${new Intl.DateTimeFormat('en-US', { timeZone: APP_TIME_ZONE, hour: 'numeric', minute: '2-digit' }).format(date)}`;
  }

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (notificationDay === dateKey(yesterday)) {
    return `Yesterday, ${new Intl.DateTimeFormat('en-US', { timeZone: APP_TIME_ZONE, hour: 'numeric', minute: '2-digit' }).format(date)}`;
  }

  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: yearKey(date) === yearKey(now) ? undefined : 'numeric',
  }).format(date);
}
