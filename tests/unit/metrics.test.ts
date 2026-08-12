import { describe, expect, it } from 'vitest'
import { getTemporalEventState, nextScheduleEvent } from '../../src/lib/dates/schedule'
import { cycleProgress, findScheduleConflicts, totalKnownHours } from '../../src/lib/schedule/metrics'
import { parseScheduleCsv } from '../../src/lib/csv/parser'

const header = 'Data,Turma,Aula,HORÁRIO CP,Instrutor(a) de CP,Ações CP,Postagem de Materiais/Atividades'

async function events() {
  return (await parseScheduleCsv(`${header}\n13 de Julho de 2026,BRSAO257,A,19h às 22h,P,,\n13 de Julho de 2026,BRSAO267,B,21h às 22h,P,,\n14 de Julho de 2026,BRSAO257,C,Conselho horário a confirmar,P,,`)).events
}

describe('métricas de agenda', () => {
  it('calcula carga conhecida e conflito', async () => {
    const source = await events()
    expect(totalKnownHours(source)).toBe(4)
    expect(findScheduleConflicts(source)).toHaveLength(1)
  })

  it('deriva estado temporal no timezone do perfil', async () => {
    const source = await events()
    expect(getTemporalEventState(source[0]!, new Date('2026-07-13T22:30:00Z'))).toBe('in_progress')
    expect(getTemporalEventState(source[2]!, new Date('2026-07-14T12:00:00Z'))).toBe('pending_time')
  })

  it('encontra próximo evento e calcula progresso sem encerrar pendente de hoje', async () => {
    const source = await events()
    const now = new Date('2026-07-14T12:00:00Z')
    expect(nextScheduleEvent(source, now)?.title).toBe('C')
    expect(cycleProgress(source, now, 'America/Sao_Paulo')).toBe(67)
  })
})
