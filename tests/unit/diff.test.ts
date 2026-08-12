import { describe, expect, it } from 'vitest'
import { diffSchedule } from '../../src/lib/csv/diff'
import { parseScheduleCsv } from '../../src/lib/csv/parser'

const header = 'Data,Turma,Aula,HORÁRIO CP,Instrutor(a) de CP,Ações CP,Postagem de Materiais/Atividades'

async function event(date: string, time: string, action = '') {
  const preview = await parseScheduleCsv(`${header}\n${date},BRSAO 257,Aula identidade,${time},Professor,${action},checked`)
  const parsed = preview.events[0]
  if (!parsed) throw new Error('Fixture inválida')
  return parsed
}

describe('diff conservador', () => {
  it('classifica unchanged', async () => {
    const source = await event('13 de Julho de 2026', '19h às 20h')
    expect(diffSchedule([source], [source]).unchanged).toHaveLength(1)
  })

  it('mantém identidade quando horário muda', async () => {
    const before = await event('13 de Julho de 2026', '19h às 20h')
    const after = await event('13 de Julho de 2026', '19h às 22h')
    const diff = diffSchedule([before], [after])
    expect(diff.updated).toHaveLength(1)
    expect(diff.updated[0]?.changedFields).toEqual(expect.arrayContaining(['endTime', 'originalTimeText']))
  })

  it('trata mudança de data como remoção e criação', async () => {
    const before = await event('13 de Julho de 2026', '19h às 20h')
    const after = await event('14 de Julho de 2026', '19h às 20h')
    const diff = diffSchedule([before], [after])
    expect(diff.created).toHaveLength(1)
    expect(diff.removed).toHaveLength(1)
  })

  it('detecta mudança de ação como update', async () => {
    const before = await event('13 de Julho de 2026', '19h às 20h', 'Postar atividade de PDI')
    const after = await event('13 de Julho de 2026', '19h às 20h', 'Corrigir atividade de PDI')
    expect(diffSchedule([before], [after]).updated[0]?.changedFields).toContain('normalizedActionText')
  })
})
