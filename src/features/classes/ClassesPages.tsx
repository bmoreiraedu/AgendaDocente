import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, CalendarClock, Clock3, Palette, UsersRound } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageTitle } from '../../components/ui'
import { useWorkspace } from '../../app/providers/WorkspaceProvider'
import { queryKeys, useClasses, useCycles, useEvents } from '../data/queries'
import { totalKnownHours } from '../../lib/schedule/metrics'
import { nextScheduleEvent } from '../../lib/dates/schedule'
import { requireSupabase } from '../../lib/supabase/client'
import { useAuth } from '../auth/AuthProvider'
import { useQueryClient } from '@tanstack/react-query'

const COLORS = ['teal', 'indigo', 'amber', 'rose', 'sky', 'violet']

export function ClassesPage() {
  const { selectedCycleId } = useWorkspace()
  const classes = useClasses(selectedCycleId)
  const events = useEvents(selectedCycleId)
  const cycles = useCycles()
  if (classes.isLoading || events.isLoading) return <LoadingState label="Carregando turmas…" />
  if (classes.isError || events.isError) return <ErrorState message={classes.error?.message ?? events.error?.message ?? 'Erro inesperado'} />
  const cycle = cycles.data?.find((item) => item.id === selectedCycleId)
  return <div><PageTitle eyebrow={cycle?.code ?? 'Ciclo'} title="Turmas" description="Visão enxuta da carga, das ações e do próximo encontro." />
    {!classes.data?.length ? <EmptyState icon={<UsersRound />} title="Nenhuma turma ainda." description="As turmas são criadas automaticamente na primeira importação." /> : <div className="class-grid">{classes.data.map((item) => { const classEvents = (events.data ?? []).filter((event) => event.classId === item.id); const next = nextScheduleEvent(classEvents, new Date()); return <Link key={item.id} to={`/classes/${item.id}`} className="class-card-link"><Card className="class-card"><div className="class-card-top"><span className={`class-monogram color-${item.color_token ?? 'teal'}`}>{item.code.slice(-3)}</span><ArrowRight /></div><p className="eyebrow">{cycle?.code}</p><h2>{item.code}</h2><div className="class-stats"><span><CalendarClock /> <strong>{classEvents.length}</strong> encontros</span><span><Clock3 /> <strong>{formatHours(totalKnownHours(classEvents))}</strong> conhecidas</span></div><div className="next-mini"><span>Próxima aula</span><strong>{next ? `${formatDate(next.eventDate)} · ${next.startTime ?? 'A confirmar'}` : 'Ciclo concluído'}</strong></div><div className="class-card-footer"><span>{classEvents.filter((event) => event.actionText).length} ações CP</span><span>Ver turma <ArrowRight /></span></div></Card></Link> })}</div>}
  </div>
}

export function ClassDetailPage() {
  const { classId } = useParams()
  const { user } = useAuth()
  const { selectedCycleId } = useWorkspace()
  const classes = useClasses(selectedCycleId)
  const events = useEvents(selectedCycleId)
  const cycles = useCycles()
  const queryClient = useQueryClient()
  const teachingClass = classes.data?.find((item) => item.id === classId)
  const classEvents = (events.data ?? []).filter((event) => event.classId === classId)
  const [note, setNote] = useState(teachingClass?.note_text ?? '')
  const [color, setColor] = useState(teachingClass?.color_token ?? 'teal')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (teachingClass) {
      setNote(teachingClass.note_text ?? '')
      setColor(teachingClass.color_token ?? 'teal')
    }
  }, [teachingClass])
  if (classes.isLoading || events.isLoading) return <LoadingState />
  if (!teachingClass) return <EmptyState title="Turma não encontrada." description="Ela pode ter sido arquivada ou pertencer a outro ciclo." />
  const cycle = cycles.data?.find((item) => item.id === teachingClass.cycle_id)
  const next = nextScheduleEvent(classEvents, new Date())
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!user) return; setSaving(true)
    const result = await requireSupabase().from('class_preferences').upsert({ user_id: user.id, class_id: teachingClass.id, color_token: color, note_text: note }, { onConflict: 'user_id,class_id' })
    setSaving(false)
    if (result.error) toast.error(result.error.message)
    else { toast.success('Preferências da turma salvas.'); void queryClient.invalidateQueries({ queryKey: queryKeys.classes(selectedCycleId) }) }
  }
  return <div><PageTitle eyebrow={`${cycle?.code ?? 'Ciclo'} · Turma`} title={teachingClass.code} description={`${classEvents.length} encontros · ${formatHours(totalKnownHours(classEvents))} de carga conhecida`} action={<Badge tone={next ? 'positive' : 'neutral'}>{next ? 'Ciclo em andamento' : 'Encerrado'}</Badge>} />
    <div className="class-detail-grid"><div><Card className="class-next"><p className="eyebrow">Próxima aula</p>{next ? <><h2>{next.title}</h2><strong>{formatDate(next.eventDate)} · {next.startTime ?? 'Horário a confirmar'}</strong></> : <p>Não há próximos encontros.</p>}</Card><Card className="section-card"><div className="section-heading"><div><p className="eyebrow">Cronograma</p><h2>Próximas aulas</h2></div></div><div className="simple-timeline">{classEvents.filter((event) => event.eventDate >= new Date().toISOString().slice(0, 10)).slice(0, 8).map((event) => <div key={event.id}><span className={`timeline-dot color-${color}`} /><time>{formatDate(event.eventDate)}<small>{event.startTime ?? 'A confirmar'}</small></time><strong>{event.title}</strong>{event.actionText && <Badge tone="warning">Ação</Badge>}</div>)}</div></Card></div><Card className="preference-card"><p className="eyebrow">Personalização</p><h2>Preferências da turma</h2><form onSubmit={(event) => void save(event)}><label className="field"><span className="field-label"><Palette size={15} /> Cor da turma</span><div className="color-picker">{COLORS.map((item) => <button type="button" aria-label={`Cor ${item}`} aria-pressed={color === item} key={item} className={`color-${item} ${color === item ? 'active' : ''}`} onClick={() => setColor(item)} />)}</div></label><label className="field"><span className="field-label">Nota geral</span><textarea rows={7} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: Reforçar PDI na próxima aula." /></label><Button type="submit" loading={saving}>Salvar preferências</Button></form></Card></div>
  </div>
}

function formatHours(value: number) { return `${String(value).replace('.', ',')}h` }
function formatDate(iso: string) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', weekday: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)) }
