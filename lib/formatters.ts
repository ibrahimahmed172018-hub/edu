/**
 * Standardization Formatters for EduCore Platform
 * 100% Arabic & Egyptian Pound (EGP / ج.م)
 */

/**
 * Formats monetary amounts in Egyptian Pounds (ج.م)
 * e.g. 500 -> "500 ج.م"
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') {
    return '0 ج.م';
  }
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) {
    return '0 ج.م';
  }
  return `${num.toLocaleString('ar-EG')} ج.م`;
}

/**
 * Formats dates into natural Egyptian Arabic strings
 * e.g. "2026-09-15" -> "15 سبتمبر 2026"
 */
export function formatDate(
  dateInput: string | Date | null | undefined,
  includeDayName: boolean = false
): string {
  if (!dateInput) return '—';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '—';

    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };

    if (includeDayName) {
      options.weekday = 'long';
    }

    return d.toLocaleDateString('ar-EG', options);
  } catch {
    return String(dateInput);
  }
}

/**
 * Formats time in Egyptian Arabic 12-hour format
 * e.g. "11:30 ص" or "04:15 م"
 */
export function formatTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '—';

    return d.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}
