import { useEffect, useState } from 'react'
import { BookOpenCheck, CalendarDays, Check, Clock3, FileCheck2, UserRound, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button } from '../../components/ui'
import type { EventWithRelations } from '../../types/domain'
import { formatLongDate } from '../../lib/dates/schedule'
import { useSaveEventNote, useToggleAction } from '../data/queries'
import { useAuth } from '../auth/AuthProvider'

export function EventDetailSheet({ event, cycleId, onClose }: { event: EventWithRelations | null; cycleId?: string; onClose: () => void }) {
  const { user } = useAuth()
  const [note, setNote] = useState(event?.note ?? '')
  const saveNote = useSaveEventNote(cycleId)
  const toggle = useToggleAction(cycleId)
  useEffect(() => setNote(event?.note ?? ''), [event])
  if (!event) return null
  const save = () => {
    if (!event.id || !user) return
    saveNote.mutate({ eventId: event.id, userId: user.id, content: note }, {
      onSuccess: () => toast.success('Nota salva.'), onError: (error) => toast.error(error.message),
    })
  }
  return <div className="sheet-backdrop" onMouseDown={(mouseEvent) => mouseEvent.target === mouseEvent.currentTarget && onClose()}><aside className="event-sheet" role="dialog" aria-modal="true" aria-labelledby="event-sheet-title"><div className="sheet-header"><div><Badge tone="accent">{event.classCode}</Badge><span>Detalhe do evento</span></div><Button variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}><X /></Button></div><div className="sheet-body"><div className={`sheet-color color-${event.classColor ?? 'teal'}`} /><p className="eyebrow">{event.eventKind === 'special' ? 'Compromisso especial' : 'Aula'}</p><h2 id="event-sheet-title">{event.title}</h2><div className="detail-grid"><Detail icon={<CalendarDays />} label="Data" value={formatLongDate(event.eventDate)} /><Detail icon={<Clock3 />} label="Horário" value={event.timeStatus === 'pending' ? 'Horário a confirmar' : `${event.startTime} → ${event.endTime}`} /><Detail icon={<UserRound />} label="Instrutor" value={event.instructorName ?? 'Não informado'} /><Detail icon={<FileCheck2 />} label="Materiais" value={event.materialsSourceStatus ? 'Postados na fonte' : 'Não informado'} /></div>{event.actionText && <section className="sheet-section"><p className="section-label"><BookOpenCheck size={16} /> Ação CP</p><div className="sheet-action"><div><strong>{event.actionText}</strong><Badge tone={event.actionStatus === 'completed' ? 'positive' : 'warning'}>{event.actionStatus === 'completed' ? 'Concluída' : 'Pendente'}</Badge></div>{event.actionId && <Button variant="secondary" size="sm" onClick={() => toggle.mutate({ actionId: event.actionId!, status: event.actionStatus === 'completed' ? 'pending' : 'completed' })}><Check size={15} />{event.actionStatus === 'completed' ? 'Reabrir' : 'Concluir'}</Button>}</div></section>}<section className="sheet-section"><label className="section-label" htmlFor="event-note">Nota pessoal</label><textarea id="event-note" rows={5} value={note} onChange={(changeEvent) => setNote(changeEvent.target.value)} placeholder="Registre algo útil para esta aula…" /><div className="sheet-actions"><span>Dados oficiais são atualizados pelo CSV.</span><Button size="sm" onClick={save} loading={saveNote.isPending}>Salvar nota</Button></div></section></div></aside></div>
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="detail-item"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div> }
