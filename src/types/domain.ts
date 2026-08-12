export type TimeStatus = 'defined' | 'pending'
export type EventKind = 'class' | 'special' | 'other'
export type ActionStatus = 'pending' | 'completed'

export interface ScheduleEvent {
  id?: string
  classCode: string
  classSourceLabel: string
  eventDate: string
  title: string
  eventKind: EventKind
  startTime: string | null
  endTime: string | null
  timeStatus: TimeStatus
  originalTimeText: string | null
  instructorName: string | null
  materialsSourceStatus: true | null
  actionText: string | null
  normalizedActionText: string | null
  sourceRowNumber: number
  sourceOrder: number
  identityHash: string
  rowHash: string
  sourcePayload: Record<string, string>
}

export interface ImportIssue {
  level: 'info' | 'warning' | 'error'
  code: string
  message: string
  row?: number
}

export type CsvCanonicalField = 'date' | 'class' | 'title' | 'time' | 'instructor' | 'action' | 'materials'
export type CsvColumnMapping = Partial<Record<CsvCanonicalField, string>>

export interface ImportPreview {
  events: ScheduleEvent[]
  issues: ImportIssue[]
  rawRowCount: number
  validRowCount: number
  classes: string[]
  periodStart: string | null
  periodEnd: string | null
  pendingTimeCount: number
  actionRowCount: number
  distinctActions: string[]
  structuredTimeFormats: string[]
  headers: string[]
  columnMapping: CsvColumnMapping
  fatal: boolean
}

export interface ImportDiffItem {
  type: 'created' | 'updated' | 'removed' | 'unchanged'
  identityHash: string
  before: ScheduleEvent | null
  after: ScheduleEvent | null
  changedFields: string[]
}

export interface ImportDiff {
  created: ImportDiffItem[]
  updated: ImportDiffItem[]
  removed: ImportDiffItem[]
  unchanged: ImportDiffItem[]
  warnings: ImportIssue[]
}

export interface EventWithRelations extends ScheduleEvent {
  classId?: string
  actionId?: string
  actionStatus?: ActionStatus
  actionCompletedAt?: string | null
  note?: string | null
  classColor?: string | null
}
