import { useState, type FormEvent } from 'react'
import { ArrowRight, Check, GraduationCap, UploadCloud, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Card, Field, Input } from '../../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { queryKeys, useProfile } from '../data/queries'
import { requireSupabase } from '../../lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

export function OnboardingPage() {
  const { user } = useAuth()
  const profile = useProfile(user?.id)
  const [step, setStep] = useState<1 | 2>(profile.data ? 2 : 1)
  const [fullName, setFullName] = useState(profile.data?.full_name ?? '')
  const [displayName, setDisplayName] = useState(profile.data?.display_name ?? '')
  const [jobTitle, setJobTitle] = useState(profile.data?.job_title ?? 'Professor de Competências Profissionais')
  const [institution, setInstitution] = useState('Escola da Nuvem')
  const [shortName, setShortName] = useState('EdN')
  const [cycle, setCycle] = useState('C7-2026')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault(); if (!user) return
    setLoading(true)
    const result = await requireSupabase().from('profiles').upsert({
      id: user.id, full_name: fullName, display_name: displayName || null, job_title: jobTitle || null,
    })
    setLoading(false)
    if (result.error) return toast.error(result.error.message)
    await queryClient.invalidateQueries({ queryKey: queryKeys.profile })
    setStep(2)
  }

  const createWorkspace = async (event: FormEvent) => {
    event.preventDefault(); if (!user) return
    setLoading(true)
    try {
      const client = requireSupabase()
      let institutionId: string
      const existingInstitution = await client.from('institutions').select('id').eq('name', institution).maybeSingle()
      if (existingInstitution.error) throw existingInstitution.error
      if (existingInstitution.data) institutionId = String(existingInstitution.data.id)
      else {
        const created = await client.from('institutions').insert({ user_id: user.id, name: institution, short_name: shortName || null }).select('id').single()
        if (created.error) throw created.error
        institutionId = String(created.data.id)
      }
      const existingCycle = await client.from('cycles').select('id').eq('institution_id', institutionId).eq('code', cycle).maybeSingle()
      if (existingCycle.error) throw existingCycle.error
      if (!existingCycle.data) {
        const createdCycle = await client.from('cycles').insert({ user_id: user.id, institution_id: institutionId, code: cycle }).select('id').single()
        if (createdCycle.error) throw createdCycle.error
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.institutions }),
        queryClient.invalidateQueries({ queryKey: queryKeys.cycles }),
      ])
      navigate('/imports/new')
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : 'Não foi possível preparar o ciclo.') }
    finally { setLoading(false) }
  }

  return <main className="onboarding-page">
    <header className="onboarding-brand"><GraduationCap /><strong>Agenda Docente</strong></header>
    <div className="onboarding-wrap">
      <div className="stepper"><Step active={step === 1} complete={step > 1} icon={<UserRound />} label="Seu perfil" /><span /><Step active={step === 2} complete={false} icon={<UploadCloud />} label="Cronograma" /></div>
      {step === 1 ? <Card className="onboarding-card"><p className="eyebrow">Passo 1 de 2</p><h1>Como devemos chamar você?</h1><p>O mínimo necessário para personalizar seu cockpit.</p><form onSubmit={(event) => void saveProfile(event)}><Field label="Nome completo"><Input value={fullName} onChange={(event) => setFullName(event.target.value)} required autoFocus /></Field><Field label="Nome de exibição" hint="Opcional"><Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></Field><Field label="Função / cargo" hint="Opcional"><Input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} /></Field><Button type="submit" loading={loading}>Continuar <ArrowRight size={16} /></Button></form></Card>
      : <Card className="onboarding-card"><p className="eyebrow">Passo 2 de 2</p><h1>Prepare seu primeiro ciclo.</h1><p>As turmas serão identificadas automaticamente no CSV.</p><form onSubmit={(event) => void createWorkspace(event)}><Field label="Instituição"><Input value={institution} onChange={(event) => setInstitution(event.target.value)} required /></Field><div className="form-grid"><Field label="Nome curto"><Input value={shortName} onChange={(event) => setShortName(event.target.value)} /></Field><Field label="Ciclo"><Input value={cycle} onChange={(event) => setCycle(event.target.value)} required /></Field></div><Button type="submit" loading={loading}>Selecionar cronograma <UploadCloud size={16} /></Button></form></Card>}
    </div>
  </main>
}

function Step({ active, complete, icon, label }: { active: boolean; complete: boolean; icon: React.ReactNode; label: string }) {
  return <div className={`step ${active ? 'active' : ''} ${complete ? 'complete' : ''}`}><span>{complete ? <Check /> : icon}</span><small>{label}</small></div>
}
