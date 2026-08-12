import Papa from 'papaparse'
import { z } from 'zod'
import type { CsvCanonicalField, CsvColumnMapping, ImportIssue, ImportPreview, ScheduleEvent } from '../../types/domain'
import { sha256Text } from './hash'
import {
  normalizeAction,
  normalizeClassCode,
  normalizeComparableText,
  normalizeHeader,
  normalizeWhitespace,
  parseMaterialsStatus,
  parsePortugueseDate,
  parseScheduleTime,
} from './normalizers'

const HEADER_ALIASES: Record<CsvCanonicalField, string[]> = {
  date: ['data'],
  class: ['turma'],
  title: ['aula'],
  time: ['horario cp', 'horario'],
  instructor: ['instrutor(a) de cp', 'instrutor de cp', 'instrutor'],
  action: ['acoes cp', 'acao cp'],
  materials: ['postagem de materiais/atividades', 'postagem de materiais e atividades', 'materiais'],
}

const essentialRowSchema = z.object({
  date: z.string().min(1),
  class: z.string().min(1),
  title: z.string().min(1),
})

function resolveMapping(headers: string[], overrides: CsvColumnMapping = {}): CsvColumnMapping {
  const normalized = new Map(headers.map((header) => [normalizeHeader(header), header]))
  const mapping: CsvColumnMapping = {}
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [CsvCanonicalField, string[]][]) {
    const match = aliases.map(normalizeHeader).find((alias) => normalized.has(alias))
    if (match) mapping[field] = normalized.get(match)
  }
  for (const [field, header] of Object.entries(overrides) as [CsvCanonicalField, string][]) {
    if (headers.includes(header)) mapping[field] = header
  }
  return mapping
}

function value(row: Record<string, string>, header?: string): string {
  return header ? String(row[header] ?? '') : ''
}

function stablePayload(event: Omit<ScheduleEvent, 'identityHash' | 'rowHash'>): string {
  return JSON.stringify({
    classCode: event.classCode,
    eventDate: event.eventDate,
    title: normalizeComparableText(event.title),
    eventKind: event.eventKind,
    startTime: event.startTime,
    endTime: event.endTime,
    timeStatus: event.timeStatus,
    originalTimeText: event.originalTimeText,
    instructorName: event.instructorName,
    materialsSourceStatus: event.materialsSourceStatus,
    normalizedActionText: event.normalizedActionText,
  })
}

export async function parseScheduleCsv(csvText: string, overrides: CsvColumnMapping = {}): Promise<ImportPreview> {
  const issues: ImportIssue[] = []
  const parsed = Papa.parse<Record<string, string>>(csvText.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.replace(/^\uFEFF/, '').trim(),
  })

  for (const error of parsed.errors) {
    issues.push({
      level: error.type === 'Delimiter' ? 'warning' : 'error',
      code: `papa_${error.code}`,
      message: error.message,
      row: typeof error.row === 'number' ? error.row + 2 : undefined,
    })
  }

  const headers = parsed.meta.fields ?? []
  const mapping = resolveMapping(headers, overrides)
  const required: CsvCanonicalField[] = ['date', 'class', 'title']
  for (const field of required) {
    if (!mapping[field]) {
      issues.push({ level: 'error', code: `missing_${field}`, message: `Coluna obrigatória não reconhecida: ${field}.` })
    }
  }
  for (const field of ['time', 'instructor', 'action', 'materials'] as CsvCanonicalField[]) {
    if (!mapping[field]) {
      issues.push({ level: 'warning', code: `missing_optional_${field}`, message: `Coluna opcional não reconhecida: ${field}.` })
    }
  }

  if (required.some((field) => !mapping[field])) return emptyPreview(parsed.data.length, issues, headers, mapping)

  const events: ScheduleEvent[] = []
  const rowHashes = new Set<string>()
  for (let index = 0; index < parsed.data.length; index += 1) {
    const row = parsed.data[index]
    if (!row) continue
    const rawEssential = {
      date: normalizeWhitespace(value(row, mapping.date)),
      class: normalizeWhitespace(value(row, mapping.class)),
      title: normalizeWhitespace(value(row, mapping.title)),
    }
    const checked = essentialRowSchema.safeParse(rawEssential)
    if (!checked.success) {
      issues.push({ level: 'error', code: 'invalid_required_value', message: 'Data, turma e aula são obrigatórias.', row: index + 2 })
      continue
    }

    const eventDate = parsePortugueseDate(checked.data.date)
    if (!eventDate) {
      issues.push({ level: 'error', code: 'invalid_date', message: `Data inválida: ${checked.data.date}`, row: index + 2 })
      continue
    }

    const classCode = normalizeClassCode(checked.data.class)
    const timeText = value(row, mapping.time)
    const time = parseScheduleTime(timeText)
    if (time.timeStatus === 'pending') {
      issues.push({
        level: 'warning',
        code: time.originalTimeText ? 'unstructured_time' : 'missing_time',
        message: time.originalTimeText ? `Horário a confirmar: ${time.originalTimeText}` : 'Horário não informado.',
        row: index + 2,
      })
    }
    const action = normalizeAction(value(row, mapping.action))
    const instructor = normalizeWhitespace(value(row, mapping.instructor)) || null
    const sourcePayload = Object.fromEntries(Object.entries(row).map(([key, item]) => [key, String(item ?? '')]))
    const baseEvent: Omit<ScheduleEvent, 'identityHash' | 'rowHash'> = {
      classCode,
      classSourceLabel: checked.data.class,
      eventDate,
      title: checked.data.title,
      eventKind: time.originalTimeText && /conselho/i.test(time.originalTimeText) ? 'special' : 'class',
      ...time,
      instructorName: instructor,
      materialsSourceStatus: parseMaterialsStatus(value(row, mapping.materials)),
      actionText: action.display,
      normalizedActionText: action.normalized,
      sourceRowNumber: index + 2,
      sourceOrder: index,
      sourcePayload,
    }
    const identityHash = await sha256Text(`${classCode}|${eventDate}|${normalizeComparableText(checked.data.title)}`)
    const rowHash = await sha256Text(stablePayload(baseEvent))
    if (rowHashes.has(rowHash)) {
      issues.push({ level: 'warning', code: 'duplicate_row', message: 'Registro duplicado ignorado.', row: index + 2 })
      continue
    }
    rowHashes.add(rowHash)
    events.push({ ...baseEvent, identityHash, rowHash })
  }

  if (parsed.data.length > 0 && events.length === 0) {
    issues.push({ level: 'error', code: 'no_valid_dates', message: 'Nenhuma linha válida pôde ser importada.' })
  }

  const dates = events.map((event) => event.eventDate).sort()
  return {
    events,
    issues,
    rawRowCount: parsed.data.length,
    validRowCount: events.length,
    classes: [...new Set(events.map((event) => event.classCode))].sort(),
    periodStart: dates[0] ?? null,
    periodEnd: dates.at(-1) ?? null,
    pendingTimeCount: events.filter((event) => event.timeStatus === 'pending').length,
    actionRowCount: events.filter((event) => event.actionText).length,
    distinctActions: [...new Set(events.flatMap((event) => (event.actionText ? [event.actionText] : [])))].sort(),
    structuredTimeFormats: [...new Set(events.flatMap((event) => event.timeStatus === 'defined' && event.originalTimeText ? [event.originalTimeText] : []))].sort(),
    headers,
    columnMapping: mapping,
    fatal: issues.some((issue) => issue.level === 'error'),
  }
}

function emptyPreview(rawRowCount: number, issues: ImportIssue[], headers: string[], columnMapping: CsvColumnMapping): ImportPreview {
  return {
    events: [], issues, rawRowCount, validRowCount: 0, classes: [], periodStart: null, periodEnd: null,
    pendingTimeCount: 0, actionRowCount: 0, distinctActions: [], structuredTimeFormats: [], headers, columnMapping, fatal: true,
  }
}
