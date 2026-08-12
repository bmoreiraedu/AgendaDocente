import type { TimeStatus } from '../../types/domain'

const MONTHS: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
}

export function removeDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function normalizeHeader(value: string): string {
  return removeDiacritics(normalizeWhitespace(value.replace(/^\uFEFF/, ''))).toLocaleLowerCase('pt-BR')
}

export function normalizeClassCode(value: string): string {
  return removeDiacritics(value).replace(/\s+/g, '').toUpperCase()
}

export function normalizeComparableText(value: string): string {
  return removeDiacritics(normalizeWhitespace(value)).toLocaleLowerCase('pt-BR')
}

export function parsePortugueseDate(value: string): string | null {
  const normalized = normalizeWhitespace(value)
  const match = normalized.match(/^(\d{1,2})\s+de\s+([A-Za-zÀ-ÿ]+)\s+de\s+(\d{4})$/i)
  if (!match) return null

  const day = Number(match[1])
  const monthName = removeDiacritics(match[2] ?? '').toLocaleLowerCase('pt-BR')
  const year = Number(match[3])
  const month = MONTHS[monthName]
  if (!month || day < 1 || day > 31 || year < 1900 || year > 2200) return null

  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export interface ParsedTime {
  startTime: string | null
  endTime: string | null
  timeStatus: TimeStatus
  originalTimeText: string | null
}

function clock(hourText: string, minuteText?: string): string | null {
  const hour = Number(hourText)
  const minute = Number(minuteText ?? '0')
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function parseScheduleTime(value: string): ParsedTime {
  const original = normalizeWhitespace(value)
  if (!original) {
    return { startTime: null, endTime: null, timeStatus: 'pending', originalTimeText: null }
  }

  const normalized = removeDiacritics(original).replace(/[–—-]/g, 'as')
  const match = normalized.match(/^(\d{1,2})h(?:(\d{2}))?\s*(?:as|a)\s*(\d{1,2})h(?:(\d{2}))?$/i)
  if (!match) {
    return { startTime: null, endTime: null, timeStatus: 'pending', originalTimeText: original }
  }

  const startTime = clock(match[1] ?? '', match[2])
  const endTime = clock(match[3] ?? '', match[4])
  if (!startTime || !endTime || endTime <= startTime) {
    return { startTime: null, endTime: null, timeStatus: 'pending', originalTimeText: original }
  }

  return { startTime, endTime, timeStatus: 'defined', originalTimeText: original }
}

export function parseMaterialsStatus(value: string): true | null {
  return normalizeComparableText(value) === 'checked' ? true : null
}

export function normalizeAction(value: string): { display: string | null; normalized: string | null } {
  const display = normalizeWhitespace(value)
  return display
    ? { display, normalized: normalizeComparableText(display) }
    : { display: null, normalized: null }
}
