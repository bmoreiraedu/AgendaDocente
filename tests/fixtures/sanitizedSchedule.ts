const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const ACTIONS = [
  'Correção da atividade de Currículo',
  'Correção da atividade de LinkedIn',
  'Correção da atividade de PDI',
  'Postar atividade de Currículo',
  'Postar atividade de LinkedIn',
  'Postar atividade de PDI',
]

function portugueseDate(date: Date): string {
  return `${date.getUTCDate()} de ${MONTHS[date.getUTCMonth()]} de ${date.getUTCFullYear()}`
}

function dates(start: string, end: string, include?: { index: number; date: string }): string[] {
  const first = new Date(`${start}T00:00:00Z`)
  const values = Array.from({ length: 36 }, (_, index) => {
    const next = new Date(first)
    next.setUTCDate(next.getUTCDate() + index * 4)
    return next.toISOString().slice(0, 10)
  })
  values[35] = end
  if (include) values[include.index] = include.date
  return values
}

export function sanitizedScheduleCsv(): string {
  const headers = 'Data,Turma,Aula,HORÁRIO CP,Instrutor(a) de CP,Ações CP,Postagem de Materiais/Atividades'
  const times = ['19h às 20h', '19h às 22h', '20h50 às 22h', '21h às 22h']
  const firstClassDates = dates('2026-07-13', '2026-12-09')
  const secondClassDates = dates('2026-07-14', '2026-12-10', { index: 21, date: '2026-10-07' })
  const rows: string[] = []

  for (const [classIndex, classDates] of [firstClassDates, secondClassDates].entries()) {
    for (let index = 0; index < classDates.length; index += 1) {
      const iso = classDates[index]
      if (!iso) continue
      const date = new Date(`${iso}T00:00:00Z`)
      const isPending = classIndex === 1 && index === 21
      const time = isPending ? 'Conselho de classe horário será enviado via invite no TEAMS' : times[index % times.length]
      const action = index < 6 ? ACTIONS[index] : ''
      rows.push([
        portugueseDate(date), classIndex === 0 ? 'BRSAO 257' : 'BRSAO 267',
        `Aula sanitizada ${classIndex + 1}-${index + 1}`, time, 'Professor Exemplo', action, index < 12 ? 'checked' : '',
      ].join(','))
    }
  }
  return [headers, ...rows].join('\n')
}
