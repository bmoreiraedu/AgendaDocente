import { describe, expect, it } from 'vitest'
import { decodeCsvBytes } from '../../src/lib/csv/decode'
import { parseScheduleCsv } from '../../src/lib/csv/parser'

const headers = 'Data,Turma,Aula,HORÁRIO CP,Instrutor(a) de CP,Ações CP,Postagem de Materiais/Atividades'
const row = '13 de Julho de 2026,BRSAO 257,Aula teste,19h às 20h,Professor,,checked'

describe('parser de cronograma', () => {
  it('aceita UTF-8 com BOM', async () => {
    const preview = await parseScheduleCsv(`\uFEFF${headers}\n${row}`)
    expect(preview.fatal).toBe(false)
    expect(preview.events).toHaveLength(1)
  })

  it('aceita ponto e vírgula', async () => {
    const preview = await parseScheduleCsv(`${headers.replaceAll(',', ';')}\n${row.replaceAll(',', ';')}`)
    expect(preview.events).toHaveLength(1)
  })

  it('faz fallback Windows-1252', () => {
    const bytes = Uint8Array.from([0x41, 0xe7, 0xe3, 0x6f])
    expect(decodeCsvBytes(bytes)).toEqual({ text: 'Ação', encoding: 'windows-1252' })
  })

  it('deduplica linhas integralmente iguais com warning', async () => {
    const preview = await parseScheduleCsv(`${headers}\n${row}\n${row}`)
    expect(preview.events).toHaveLength(1)
    expect(preview.issues).toContainEqual(expect.objectContaining({ code: 'duplicate_row', level: 'warning' }))
  })

  it('bloqueia estrutura sem colunas essenciais', async () => {
    const preview = await parseScheduleCsv('Outro,Campo\nA,B')
    expect(preview.fatal).toBe(true)
    expect(preview.issues).toContainEqual(expect.objectContaining({ code: 'missing_date' }))
  })

  it('aceita mapeamento manual simples quando headers mudam', async () => {
    const source = 'Quando,Grupo,Encontro\n13 de Julho de 2026,BRSAO 257,Aula mapeada'
    const preview = await parseScheduleCsv(source, { date: 'Quando', class: 'Grupo', title: 'Encontro' })
    expect(preview.fatal).toBe(false)
    expect(preview.events[0]).toEqual(expect.objectContaining({ classCode: 'BRSAO257', title: 'Aula mapeada' }))
  })
})
