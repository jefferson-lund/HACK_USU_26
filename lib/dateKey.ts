/**
 * Calendar date key ("YYYY-MM-DD") in the device's LOCAL timezone.
 *
 * `new Date().toISOString().split('T')[0]` converts to UTC first, so anyone
 * west of UTC gets *tomorrow's* key for anything logged late in the day --
 * after 6pm in Utah (UTC-6), after 4pm in California. That silently files an
 * evening check-in under the wrong day, and contradicts the date the screen
 * itself prints via toLocaleDateString.
 *
 * Only for calendar keys. Timestamps sent to external APIs (e.g. the WHOOP
 * date window) still want real UTC instants from toISOString().
 */
export function dateKey(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
