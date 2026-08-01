function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, (month || 1) - 1, day || 1);
}

function formatDateOnly(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function buildReportDateTicks(start: string, end: string, count = 3) {
  if (count <= 1 || start === end) return [start];

  const startTime = parseDateOnly(start);
  const endTime = parseDateOnly(end);
  const ticks = Array.from({ length: count }, (_, index) =>
    formatDateOnly(startTime + ((endTime - startTime) * index) / (count - 1)),
  );

  return ticks.filter((value, index) => index === 0 || value !== ticks[index - 1]);
}

export function reportDateRatio(value: string, start: string, end: string) {
  const startTime = parseDateOnly(start);
  const endTime = parseDateOnly(end);
  const span = Math.max(1, endTime - startTime);
  return Math.min(1, Math.max(0, (parseDateOnly(value) - startTime) / span));
}
