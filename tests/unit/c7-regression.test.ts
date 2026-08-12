// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseScheduleCsv } from '../../src/lib/csv/parser'
import { sanitizedScheduleCsv } from '../fixtures/sanitizedSchedule'

describe('regressão C7-2026', () => {
  it('preserva todos os invariantes estruturais do cronograma', async () => {
    const privateFixture = process.env.REAL_SCHEDULE_CSV
    const csv = privateFixture && existsSync(privateFixture) ? readFileSync(privateFixture, 'utf8') : sanitizedScheduleCsv()
    const preview = await parseScheduleCsv(csv)

    expect(preview.fatal).toBe(false)
    expect(preview.events).toHaveLength(72)
    expect(preview.events.filter((event) => event.classCode === 'BRSAO257')).toHaveLength(36)
    expect(preview.events.filter((event) => event.classCode === 'BRSAO267')).toHaveLength(36)
    expect(preview.actionRowCount).toBe(12)
    expect(preview.distinctActions).toHaveLength(6)
    expect(preview.structuredTimeFormats).toHaveLength(4)
    expect(preview.pendingTimeCount).toBe(1)
    expect(preview.periodStart).toBe('2026-07-13')
    expect(preview.periodEnd).toBe('2026-12-10')
    expect(preview.events).toContainEqual(expect.objectContaining({
      eventDate: '2026-10-07', classCode: 'BRSAO267', timeStatus: 'pending', startTime: null, endTime: null,
    }))
  })
})
