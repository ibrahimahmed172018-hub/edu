/**
 * WhatsApp 1-Click Notifications Engine for EduCore Educational Platform
 * Generates direct https://wa.me/20... URLs with URL-encoded Arabic messages
 */

/**
 * Sanitizes Egyptian phone number to standard international WhatsApp format:
 * 201XXXXXXXXX
 */
export function formatPhoneForWhatsApp(rawPhone: string | null | undefined): string | null {
  if (!rawPhone) return null;
  const digits = String(rawPhone).replace(/\D/g, '');
  if (!digits) return null;

  // If already starts with 20 and is 12 digits: e.g. 201000000000
  if (digits.startsWith('20') && digits.length === 12) {
    return digits;
  }

  // If starts with 01 and is 11 digits: e.g. 01000000000 -> 201000000000
  if (digits.startsWith('0') && digits.length === 11) {
    return '2' + digits;
  }

  // If starts with 1 and is 10 digits: e.g. 1000000000 -> 201000000000
  if (digits.startsWith('1') && digits.length === 10) {
    return '20' + digits;
  }

  // Fallback: prepend 20 if valid length
  if (digits.length >= 10 && !digits.startsWith('20')) {
    return '20' + digits;
  }

  return digits;
}

/**
 * Resolves base URL for parent portal link
 */
function resolvePortalUrl(token: string, origin?: string): string {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://demo.qaleb.site');
  return `${base}/p/${token}`;
}

/**
 * 1. Absence Alert Notification
 */
export function getAbsenceWhatsAppUrl(
  phone: string | null | undefined,
  studentName: string,
  token: string,
  origin?: string
): string | null {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  if (!formattedPhone) return null;

  const portalUrl = resolvePortalUrl(token, origin);
  const text = `السلام عليكم يا فندم،\nنود إبلاغكم بغياب الطالب (${studentName}) عن حصة اليوم في منصة EduCore (أ/ محمد إبراهيم).\nيمكنكم متابعة سجل الحضور والواجبات عبر الرابط:\n${portalUrl}`;

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;
}

/**
 * 2. Exam / Quiz Score Notification
 */
export function getScoreWhatsAppUrl(
  phone: string | null | undefined,
  studentName: string,
  examTitle: string,
  score: number,
  maxScore: number,
  token: string,
  origin?: string
): string | null {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  if (!formattedPhone) return null;

  const percentage = Math.round((score / maxScore) * 100);
  const portalUrl = resolvePortalUrl(token, origin);

  let evaluation = 'ممتاز 🌟';
  if (percentage < 70) {
    evaluation = 'يحتاج متابعة ومراجعة ⚠️';
  } else if (percentage < 85) {
    evaluation = 'جيد جداً 👍';
  }

  const text = `مرحباً بحضرتك،\nنتيجة امتحان (${examTitle}) للطالب (${studentName}) في منصة EduCore (أ/ محمد إبراهيم) هي:\nالدرجة: ${score} من ${maxScore} (${percentage}% - ${evaluation}).\nلمشاهدة التقرير الأكاديمي الكامل وملاحظات المعلم:\n${portalUrl}`;

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;
}

/**
 * 3. Tuition Fee Reminder Notification
 */
export function getFeeReminderWhatsAppUrl(
  phone: string | null | undefined,
  studentName: string,
  monthName: string,
  token: string,
  origin?: string
): string | null {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  if (!formattedPhone) return null;

  const portalUrl = resolvePortalUrl(token, origin);
  const text = `السلام عليكم ورحمة الله،\nتذكير لطيف بمصاريف شهر (${monthName}) للطالب (${studentName}) في منصة EduCore (أ/ محمد إبراهيم).\nللاطلاع على كشف الحساب والتقرير الأكاديمي:\n${portalUrl}\nللاستفسار والدعم: +20 100 000 0000`;

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;
}
