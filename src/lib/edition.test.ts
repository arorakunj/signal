import { expect, it } from 'vitest'
import { editionDay, mountainDay } from './edition'

it('uses the local Mountain calendar date for podcast publication', () => {
  expect(mountainDay(new Date('2026-01-03T06:30:00Z'))).toBe('2026-01-02')
  expect(mountainDay(new Date('2026-07-03T06:30:00Z'))).toBe('2026-07-03')
})

it.each(['2026-01-03', '2026-07-03'])('rolls over the edition at 5 a.m. MST on %s', (day) => {
  const previous = day.replace(/03$/, '02')
  expect(editionDay(new Date(`${day}T11:59:59.999Z`))).toBe(previous)
  expect(editionDay(new Date(`${day}T12:00:00.000Z`))).toBe(day)
})
