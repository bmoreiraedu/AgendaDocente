import { useMemo, useState } from 'react'
import { Check, CheckCircle2, RotateCcw, Search } from 'lucide-react'
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageTitle } from '../../components/ui'
import { useWorkspace } from '../../app/providers/WorkspaceProvider'
import { useEvents, useToggleAction } from '../data/queries'
import { useProfile } from '../data/queries'
import { useAuth } from '../auth/AuthProvider'
import { eventHasElapsed } from '../../lib/dates/schedule'

type Tab = 'pending' | 'completed' | 'all'

export function ActionsPage() {
  const { user } = useAuth()
  const profile = useProfile(user?.id)
  const { selectedCycleId, selectedClassId } = useWorkspace()
  const events = useEvents(selectedCycleId)
  const toggle = useToggleAction(selectedCycleId)
  const [tab, setTab] = useState<Tab>('pending')
  const [search, setSearch] = useState('')
  const now = useMemo(() => new Date(), [])
  const timezone = profile.data?.timezone ?? 'America/Sao_Paulo'
  const actions = useMemo(() => (events.data ?? []).filter((event) => event.actionId && (!selectedClassId || event.classId === selectedClassId)).filter((event) => tab === 'all' || (tab === 'completed' ? event.actionStatus === 'completed' : event.actionStatus !== 'completed')).filter((event) => `${event.actionText} ${event.classCode} ${event.title}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => {
    if (tab !== 'pending') return a.eventDate.localeCompare(b.eventDate)
    const aPast = eventHasElapsed(a, now, timezone) ? 0 : 1
    const bPast = eventHasElapsed(b, now, timezone) ? 0 : 1
    return aPast - bPast || a.eventDate.localeCompare(b.eventDate)
  }), [events.data, now, search, selectedClassId, tab, timezone])

  if (events.isLoading) return <LoadingState label="Organizando ações…" />
  if (events.isError) return <ErrorState message={events.error.message} />
  return <div><PageTitle eyebrow="Acompanhamento pessoal" title="Ações CP" description="Pendências simples, sem virar um gerenciador de projetos." />
    <div className="tab-toolbar"><div className="tabs" role="tablist">{([['pending', 'Pendentes'], ['completed', 'Concluídas'], ['all', 'Todas']] as [Tab, string][]).map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label}<span>{(events.data ?? []).filter((event) => event.actionId && (value === 'all' || (value === 'completed' ? event.actionStatus === 'completed' : event.actionStatus !== 'completed'))).length}</span></button>)}</div><div className="search-box small"><Search size={16} /><Input aria-label="Buscar ações" placeholder="Buscar ação…" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
    {!actions.length ? <EmptyState icon={<CheckCircle2 />} title={tab === 'pending' ? 'Tudo em dia.' : 'Nenhuma ação aqui.'} description={tab === 'pending' ? 'Você não possui Ações CP pendentes neste ciclo.' : 'Altere a aba ou os filtros para ver outras ações.'} /> : <div className="actions-list">{actions.map((event) => { const past = eventHasElapsed(event, now, timezone); const completed = event.actionStatus === 'completed'; return <Card className="action-card" key={event.actionId}><button className={`action-check ${completed ? 'checked' : ''}`} aria-label={completed ? 'Reabrir ação' : 'Concluir ação'} onClick={() => toggle.mutate({ actionId: event.actionId!, status: completed ? 'pending' : 'completed' })}>{completed && <Check />}</button><span className={`class-bar color-${event.classColor ?? 'teal'}`} /><div className="action-copy"><div><Badge tone="accent">{event.classCode}</Badge>{!completed && past && <Badge tone="warning">Evento já realizado</Badge>}{completed && <Badge tone="positive">Concluída</Badge>}</div><h2>{event.actionText}</h2><p>{event.title}</p><span>{formatActionDate(event.eventDate)} · {event.startTime ?? 'Horário a confirmar'}</span></div><Button variant="ghost" size="sm" onClick={() => toggle.mutate({ actionId: event.actionId!, status: completed ? 'pending' : 'completed' })}>{completed ? <RotateCcw size={15} /> : <Check size={15} />}{completed ? 'Reabrir' : 'Concluir'}</Button></Card> })}</div>}
  </div>
}

function formatActionDate(iso: string) { return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)) }
