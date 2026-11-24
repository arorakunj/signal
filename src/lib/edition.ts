export const EDITION_TIME_ZONE = 'America/Denver'
const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: EDITION_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
})

export function mountainDay(date = new Date()) {
  const parts = dayFormat.formatToParts(date)
  return ['year', 'month', 'day'].map((part) => parts.find(({ type }) => type === part)?.value).join('-')
}


// 5 a.m. Mountain Standard Time (UTC−07:00) is 12:00 UTC year-round.
export function editionDay(date = new Date()) {
  return new Date(date.getTime() - 12 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
