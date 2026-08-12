import { describe, expect, it } from 'vitest'
import {
  normalizeAction,
  normalizeClassCode,
  normalizeHeader,
  parseMaterialsStatus,
  parsePortugueseDate,
  parseScheduleTime,
} from '../../src/lib/csv/normalizers'

describe('normalização de CSV', () => {
  it('normaliza BOM, trim, caixa e acentos de header', () => {
    expect(normalizeHeader('\uFEFF  HORÁRIO   CP ')).toBe('horario cp')
  })

  it.each([
    ['BRSAO 257', 'BRSAO257'],
    ['brsao257', 'BRSAO257'],
    [' BRSAO257 ', 'BRSAO257'],
  ])('normaliza turma %s', (source, expected) => expect(normalizeClassCode(source)).toBe(expected))

  it.each([
    ['1 de Janeiro de 2026', '2026-01-01'], ['2 de Fevereiro de 2026', '2026-02-02'],
    ['3 de Março de 2026', '2026-03-03'], ['4 de Abril de 2026', '2026-04-04'],
    ['5 de Maio de 2026', '2026-05-05'], ['6 de Junho de 2026', '2026-06-06'],
    ['13 de Julho de 2026', '2026-07-13'], ['8 de Agosto de 2026', '2026-08-08'],
    ['9 de Setembro de 2026', '2026-09-09'], ['7 de Outubro de 2026', '2026-10-07'],
    ['11 de Novembro de 2026', '2026-11-11'], ['12 de Dezembro de 2026', '2026-12-12'],
  ])('converte %s', (source, expected) => expect(parsePortugueseDate(source)).toBe(expected))

  it.each([
    ['19h às 20h', '19:00', '20:00'],
    ['19h às 22h', '19:00', '22:00'],
    ['20h50 às 22h', '20:50', '22:00'],
    ['21h às 22h', '21:00', '22:00'],
  ])('estrutura %s', (source, start, end) => {
    expect(parseScheduleTime(source)).toEqual({ startTime: start, endTime: end, timeStatus: 'defined', originalTimeText: source })
  })

  it('preserva horário textual como pendente', () => {
    const source = 'Conselho de classe horário será enviado via invite no TEAMS'
    expect(parseScheduleTime(source)).toEqual({ startTime: null, endTime: null, timeStatus: 'pending', originalTimeText: source })
  })

  it('mantém materiais tri-state e normaliza ações', () => {
    expect(parseMaterialsStatus('checked')).toBe(true)
    expect(parseMaterialsStatus('')).toBeNull()
    expect(normalizeAction('  Postar   atividade de PDI ')).toEqual({
      display: 'Postar atividade de PDI', normalized: 'postar atividade de pdi',
    })
  })
})
