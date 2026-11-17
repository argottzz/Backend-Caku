const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MILLISECONDS_PER_DAY = 86_400_000;

export function isValidDateString(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function todayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function toUtcDate(value: string): Date {
  if (!isValidDateString(value)) {
    throw new Error(`Tanggal tidak valid: ${value}`);
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function differenceInDays(start: string, end: string): number {
  const startMs = toUtcDate(start).getTime();
  const endMs = toUtcDate(end).getTime();

  return Math.round((endMs - startMs) / MILLISECONDS_PER_DAY);
}

export function rentalDurationDays(start: string, end: string): number {
  return differenceInDays(start, end) + 1;
}

export function isBeforeDate(a: string, b: string): boolean {
  return toUtcDate(a).getTime() < toUtcDate(b).getTime();
}

export function isAfterDate(a: string, b: string): boolean {
  return toUtcDate(a).getTime() > toUtcDate(b).getTime();
}
