/**
 * Schedule resolution helper for EduCore platform
 * Determines currently active group based on Egypt local time (Africa/Cairo)
 */

export interface SchedulableGroup {
  id: string;
  name: string;
  grade: string;
  schedule?: string | null;
  days_of_week?: string[] | null;
  start_time?: string | null;
  end_time?: string | null;
}

export interface CairoTimeInfo {
  dayName: string; // e.g. "Sunday", "Tuesday"
  dayIndex: number;
  currentMinutes: number;
  timeString: string;
}

/**
 * Returns current date/time components localized to Africa/Cairo
 */
export function getCairoNow(): CairoTimeInfo {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  let dayName = '';
  let hour = 0;
  let minute = 0;

  for (const part of parts) {
    if (part.type === 'weekday') dayName = part.value;
    if (part.type === 'hour') hour = parseInt(part.value, 10);
    if (part.type === 'minute') minute = parseInt(part.value, 10);
  }

  // Fallback if weekday empty
  if (!dayName) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    dayName = dayNames[now.getUTCDay()];
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayIndex = dayNames.indexOf(dayName);
  const currentMinutes = hour * 60 + minute;
  const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return { dayName, dayIndex, currentMinutes, timeString };
}

function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Formats standard time string (e.g. "16:00:00" or "16:00") into friendly Arabic (e.g. "4:00 م")
 */
export function formatTimeToArabic(timeStr?: string | null): string {
  if (!timeStr) return '';
  const minutes = parseTimeToMinutes(timeStr);
  if (minutes === null) return timeStr;
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h24 >= 12 ? 'م' : 'ص';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mStr = m === 0 ? '00' : String(m).padStart(2, '0');
  return `${h12}:${mStr} ${period}`;
}

/**
 * Returns formatted time window in Arabic: e.g. "4:00 م - 6:00 م"
 */
export function formatGroupTimeWindow(start?: string | null, end?: string | null): string {
  if (!start || !end) return '';
  return `${formatTimeToArabic(start)} - ${formatTimeToArabic(end)}`;
}

/**
 * Finds the currently active group based on Egypt local time.
 * Includes a 30-minute arrival entry buffer and 30-minute departure buffer.
 */
export function getActiveGroupNow<T extends SchedulableGroup>(
  groups: T[],
  bufferMinutes: number = 30
): T | null {
  if (!groups || groups.length === 0) return null;

  const { dayName, currentMinutes } = getCairoNow();
  const dayLower = dayName.toLowerCase();

  for (const group of groups) {
    if (!group.days_of_week || !Array.isArray(group.days_of_week) || group.days_of_week.length === 0) {
      continue;
    }

    // Match day of week (supports English names, lowercase, or Arabic equivalents)
    const matchesDay = group.days_of_week.some((d) => {
      if (!d) return false;
      const clean = d.trim().toLowerCase();
      if (clean === dayLower) return true;
      // Arabic day mapping support
      const arabicDays: Record<string, string> = {
        'الأحد': 'sunday',
        'الاحد': 'sunday',
        'الإثنين': 'monday',
        'الاثنين': 'monday',
        'الثلاثاء': 'tuesday',
        'الأربعاء': 'wednesday',
        'الاربعاء': 'wednesday',
        'الخميس': 'thursday',
        'الجمعة': 'friday',
        'السبت': 'saturday',
      };
      return arabicDays[clean] === dayLower;
    });

    if (!matchesDay) continue;

    const startMin = parseTimeToMinutes(group.start_time);
    const endMin = parseTimeToMinutes(group.end_time);

    if (startMin === null || endMin === null) continue;

    // Buffer: 30 minutes before start, 30 minutes after end
    const windowStart = startMin - bufferMinutes;
    const windowEnd = endMin + bufferMinutes;

    if (currentMinutes >= windowStart && currentMinutes <= windowEnd) {
      return group;
    }
  }

  return null;
}
