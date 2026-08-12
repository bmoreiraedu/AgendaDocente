import type { ScheduleEvent } from '../../types/domain'
import { eventHasElapsed } from '../dates/schedule'

function minutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number)
  return (hour ?? 0) * 60 + (minute ?? 0)
}

export function eventDurationHours(event: ScheduleEvent): number {
  if (!event.startTime || !event.endTime || event.timeStatus !== 'defined') return 0
  return Math.max(0, minutes(event.endTime) - minutes(event.startTime)) / 60
}

export function totalKnownHours(events: ScheduleEvent[]): number {
  return events.reduce((sum, event) => sum + eventDurationHours(event), 0)
}

export interface ScheduleConflict {
  date: string
  first: ScheduleEvent
  second: ScheduleEvent
}

export function findScheduleConflicts(events: ScheduleEvent[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = []
  const byDate = new Map<string, ScheduleEvent[]>()
  for (const event of events.filter((item) => item.startTime && item.endTime && item.timeStatus === 'defined')) {
    byDate.set(event.eventDate, [...(byDate.get(event.eventDate) ?? []), event])
  }
  for (const [date, dayEvents] of byDate) {
    const sorted = dayEvents.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
    for (let firstIndex = 0; firstIndex < sorted.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < sorted.length; secondIndex += 1) {
        const first = sorted[firstIndex]
        const second = sorted[secondIndex]
        if (first?.endTime && second?.startTime && second.startTime < first.endTime) conflicts.push({ date, first, second })
      }
    }
  }
  return conflicts
}

export function cycleProgress(events: ScheduleEvent[], now: Date, timeZone: string): number {
  if (events.length === 0) return 0
  const elapsed = events.filter((event) => eventHasElapsed(event, now, timeZone)).length
  return Math.round((elapsed / events.length) * 100)
}
