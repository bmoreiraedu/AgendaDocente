import type { ImportDiff, ImportDiffItem, ImportIssue, ScheduleEvent } from '../../types/domain'

const DIFF_FIELDS: (keyof ScheduleEvent)[] = [
  'classCode', 'eventDate', 'title', 'eventKind', 'startTime', 'endTime', 'timeStatus',
  'originalTimeText', 'instructorName', 'materialsSourceStatus', 'normalizedActionText',
]

export function diffSchedule(current: ScheduleEvent[], incoming: ScheduleEvent[]): ImportDiff {
  const warnings: ImportIssue[] = []
  const existingByIdentity = groupByIdentity(current)
  const incomingByIdentity = groupByIdentity(incoming)
  const result: ImportDiff = { created: [], updated: [], removed: [], unchanged: [], warnings }
  const identities = new Set([...existingByIdentity.keys(), ...incomingByIdentity.keys()])

  for (const identityHash of identities) {
    const beforeList = existingByIdentity.get(identityHash) ?? []
    const afterList = incomingByIdentity.get(identityHash) ?? []
    if (beforeList.length > 1 || afterList.length > 1) {
      warnings.push({ level: 'warning', code: 'ambiguous_identity', message: 'Correspondência ambígua de evento; revisão necessária.' })
    }

    const before = beforeList[0] ?? null
    const after = afterList[0] ?? null
    if (!before && after) result.created.push(item('created', identityHash, null, after, []))
    else if (before && !after) result.removed.push(item('removed', identityHash, before, null, []))
    else if (before && after) {
      const changedFields = DIFF_FIELDS.filter((field) => before[field] !== after[field]).map(String)
      if (changedFields.length === 0) result.unchanged.push(item('unchanged', identityHash, before, after, []))
      else result.updated.push(item('updated', identityHash, before, after, changedFields))
    }
  }
  return result
}

function groupByIdentity(events: ScheduleEvent[]): Map<string, ScheduleEvent[]> {
  const map = new Map<string, ScheduleEvent[]>()
  for (const event of events) map.set(event.identityHash, [...(map.get(event.identityHash) ?? []), event])
  return map
}

function item(
  type: ImportDiffItem['type'], identityHash: string, before: ScheduleEvent | null,
  after: ScheduleEvent | null, changedFields: string[],
): ImportDiffItem {
  return { type, identityHash, before, after, changedFields }
}
