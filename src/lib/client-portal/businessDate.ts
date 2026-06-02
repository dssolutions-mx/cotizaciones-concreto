/** Business calendar for client portal (operations in Mexico). */
export const PORTAL_BUSINESS_TIMEZONE = 'America/Mexico_City';

/** YYYY-MM-DD in the portal business timezone (matches schedule UI intent). */
export function getBusinessDateString(
  date: Date = new Date(),
  timeZone: string = PORTAL_BUSINESS_TIMEZONE
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function isDeliveryDateBeforeBusinessToday(deliveryDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) return true;
  return deliveryDate < getBusinessDateString();
}
