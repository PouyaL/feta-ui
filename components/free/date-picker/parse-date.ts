const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const day = (from: Date, add: number): Date => new Date(from.getFullYear(), from.getMonth(), from.getDate() + add)

/** Reads plain English dates: today, tomorrow, next friday, in 3 days, Nov 12, 12 November. */
export function parseDate(text: string, now: Date): Date | null {
  const input = text.trim().toLowerCase()
  if (!input) return null
  if (input === 'today') return day(now, 0)
  if (input === 'tomorrow') return day(now, 1)
  if (input === 'yesterday') return day(now, -1)
  const inDays = input.match(/^in (\d+) days?$/)
  if (inDays) return day(now, Number(inDays[1]))
  const inWeeks = input.match(/^in (\d+) weeks?$/)
  if (inWeeks) return day(now, Number(inWeeks[1]) * 7)
  const weekday = input.match(/^(next |this )?([a-z]+)$/)
  if (weekday) {
    const index = WEEKDAYS.findIndex((name) => name.startsWith(weekday[2] ?? '-') && (weekday[2]?.length ?? 0) >= 3)
    if (index >= 0) {
      const ahead = (index - now.getDay() + 7) % 7 || 7
      return day(now, ahead)
    }
  }
  const monthFirst = input.match(/^([a-z]{3})[a-z]* (\d{1,2})(?:,? (\d{4}))?$/)
  const dayFirst = input.match(/^(\d{1,2}) ([a-z]{3})[a-z]*(?:,? (\d{4}))?$/)
  const parts = monthFirst ? [monthFirst[1], monthFirst[2], monthFirst[3]] : dayFirst ? [dayFirst[2], dayFirst[1], dayFirst[3]] : null
  if (parts) {
    const month = MONTHS.indexOf(parts[0] ?? '')
    if (month >= 0) {
      const date = new Date(Number(parts[2] ?? now.getFullYear()), month, Number(parts[1]))
      if (date.getMonth() === month) return date
    }
  }
  return null
}
