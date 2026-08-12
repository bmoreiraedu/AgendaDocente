import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, FileSpreadsheet, History, Import, RefreshCcw, ShieldCheck, TriangleAlert, UploadCloud } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageTitle } from '../../components/ui'
import { useWorkspace } from '../../app/providers/WorkspaceProvider'
import { queryKeys, useCycles, useImports, useInstitutions } from '../data/queries'
import { useAuth } from '../auth/AuthProvider'
import { decodeCsvBytes } from '../../lib/csv/decode'
import { sha256Bytes, sha256Text } from '../../lib/csv/hash'
import { parseScheduleCsv } from '../../lib/csv/parser'
import type { CsvCanonicalField, CsvColumnMapping, ImportPreview, ScheduleEvent } from '../../types/domain'
import { requireSupabase } from '../../lib/supabase/client'
import type { ImportBatch } from '../../types/database'
import { normalizeHeader } from '../../lib/csv/normalizers'

export function ImportsPage() {
  const { selectedCycleId } = useWorkspace()
  const cycles = useCycles()
  const imports = useImports(selectedCycleId)
  const cycle = cycles.data?.find((item) => item.id === selectedCycleId)
  if (imports.isLoading) return <LoadingState label="Carregando histórico…" />
  if (imports.isError) return <ErrorState message={imports.error.message} />
  return <div><PageTitle eyebrow={cycle?.code ?? 'Cronogramas'} title="Importações" description="Versões auditáveis, atualizações seguras e rollback da versão mais recente." action={<Link to="/imports/new" className="button button-primary button-md"><UploadCloud size={16} /> Atualizar cronograma</Link>} />
    {!imports.data?.length ? <EmptyState icon={<Import />} title="Nenhuma importação ainda." description="Envie o CSV oficial para criar sua agenda." action={<Link className="button button-primary button-md" to="/imports/new">Importar CSV</Link>} /> : <div className="import-history"><div className="history-line" />{imports.data.map((batch, index) => <Card className="import-card" key={batch.id}><span className={`history-dot ${batch.status}`}><History /></span><div className="import-version"><span>Versão {batch.version_number}</span><strong>{index === 0 && batch.status === 'succeeded' ? 'Versão atual' : statusLabel(batch.status)}</strong></div><div className="import-copy"><div><h2>{batch.version_number === 1 ? 'Importação inicial' : 'Atualização do cronograma'}</h2><Badge tone={batch.status === 'succeeded' ? 'positive' : batch.status === 'rolled_back' ? 'warning' : 'neutral'}>{statusLabel(batch.status)}</Badge></div><p>{formatDateTime(batch.completed_at ?? batch.created_at)} · {batch.file_name}</p><div className="diff-pills"><span className="created">+{batch.created_count} criados</span><span className="updated">~{batch.updated_count} atualizados</span><span className="removed">−{batch.removed_count} removidos</span><span>{batch.unchanged_count} sem alteração</span></div></div><Link className="button button-secondary button-sm" to={`/imports/${batch.id}`}>Detalhar <ArrowRight size={15} /></Link></Card>)}</div>}
  </div>
}

export function NewImportPage() {
  const { user } = useAuth()
  const { selectedCycleId } = useWorkspace()
  const cycles = useCycles()
  const institutions = useInstitutions()
  const imports = useImports(selectedCycleId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [fileHash, setFileHash] = useState('')
  const [encoding, setEncoding] = useState('')
  const [csvText, setCsvText] = useState('')
  const [manualMapping, setManualMapping] = useState<CsvColumnMapping>({})
  const [processing, setProcessing] = useState(false)
  const [importing, setImporting] = useState(false)
  const cycle = cycles.data?.find((item) => item.id === selectedCycleId)
  const institution = institutions.data?.find((item) => item.id === cycle?.institution_id)
  const identical = imports.data?.[0]?.file_hash === fileHash && imports.data?.[0]?.status === 'succeeded'

  const processFile = async (nextFile: File) => {
    if (!nextFile.name.toLowerCase().endsWith('.csv')) return toast.error('Selecione um arquivo .csv.')
    setProcessing(true); setFile(nextFile); setPreview(null)
    try {
      const bytes = new Uint8Array(await nextFile.arrayBuffer())
      const decoded = decodeCsvBytes(bytes)
      const [hash, parsed] = await Promise.all([sha256Bytes(bytes), parseScheduleCsv(decoded.text)])
      setFileHash(hash); setPreview(parsed); setEncoding(decoded.encoding); setCsvText(decoded.text); setManualMapping({})
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : 'Não foi possível ler o CSV.') }
    finally { setProcessing(false) }
  }

  const drop = (event: DragEvent) => { event.preventDefault(); const next = event.dataTransfer.files[0]; if (next) void processFile(next) }
  const applyManualMapping = async () => {
    if (!csvText) return
    setProcessing(true)
    try { setPreview(await parseScheduleCsv(csvText, manualMapping)) }
    finally { setProcessing(false) }
  }
  const confirm = async () => {
    if (!file || !preview || preview.fatal || !cycle || !institution || !user || !selectedCycleId) return
    setImporting(true)
    const batchId = crypto.randomUUID()
    const storagePath = `${user.id}/${selectedCycleId}/${batchId}/original.csv`
    const client = requireSupabase()
    try {
      const headerSignature = await sha256Text(preview.headers.map(normalizeHeader).join('|'))
      const existingTemplate = await client.from('import_templates').select('id').eq('header_signature', headerSignature).maybeSingle()
      if (existingTemplate.error) throw existingTemplate.error
      let templateId = existingTemplate.data ? String(existingTemplate.data.id) : null
      if (!templateId) {
        const template = await client.from('import_templates').insert({
          user_id: user.id,
          institution_id: institution.id,
          name: `Mapeamento ${institution.short_name || institution.name}`,
          header_signature: headerSignature,
          column_mapping: preview.columnMapping,
        }).select('id').single()
        if (template.error) throw template.error
        templateId = String(template.data.id)
      }
      const uploaded = await client.storage.from('schedule-imports').upload(storagePath, file, { contentType: file.type || 'text/csv', upsert: false })
      if (uploaded.error) throw uploaded.error
      const payload = preview.events.map(toRpcEvent)
      const result = await client.rpc('apply_schedule_import', {
        p_batch_id: batchId,
        p_institution_id: institution.id,
        p_cycle_id: selectedCycleId,
        p_file_name: file.name,
        p_file_hash: fileHash,
        p_storage_path: storagePath,
        p_total_rows: preview.rawRowCount,
        p_warning_count: preview.issues.filter((issue) => issue.level === 'warning').length,
        p_payload: payload,
        p_template_id: templateId,
      })
      if (result.error) {
        await client.storage.from('schedule-imports').remove([storagePath])
        throw result.error
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.events(selectedCycleId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.classes(selectedCycleId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.imports(selectedCycleId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.cycles }),
      ])
      toast.success('Cronograma aplicado com segurança.')
      navigate(`/imports/${batchId}`)
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : 'A importação falhou; o cronograma anterior foi preservado.') }
    finally { setImporting(false) }
  }

  return <div><PageTitle eyebrow="Nova versão" title="Importar cronograma" description="O arquivo é processado no navegador. Nada muda antes da sua confirmação." />
    <div className="import-layout"><div><Card className={`dropzone ${file ? 'has-file' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={drop}><input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => { const next = event.target.files?.[0]; if (next) void processFile(next) }} />{processing ? <LoadingState label="Lendo e validando o CSV…" /> : file ? <><span className="file-icon"><FileSpreadsheet /></span><h2>{file.name}</h2><p>{formatBytes(file.size)} · {encoding.toUpperCase()} · SHA-256 {fileHash.slice(0, 10)}…</p><Button variant="secondary" onClick={() => fileInput.current?.click()}>Trocar arquivo</Button></> : <><span className="drop-icon"><UploadCloud /></span><h2>Arraste seu CSV para cá</h2><p>ou selecione o arquivo oficial exportado do cronograma</p><Button onClick={() => fileInput.current?.click()}>Selecionar CSV</Button><small>Somente .csv · até 10 MB</small></>}</Card>
      {identical && <div className="warning-banner positive"><CheckCircle2 /><div><strong>Este arquivo já é a versão atual.</strong><span>Nenhuma alteração é necessária e uma nova versão não será criada.</span></div></div>}
      {preview?.fatal && preview.headers.length > 0 && <ManualMappingCard preview={preview} mapping={manualMapping} onChange={setManualMapping} onApply={() => void applyManualMapping()} loading={processing} />}
      {preview && <PreviewTable preview={preview} />}</div>
      <aside className="import-summary"><Card><p className="eyebrow">Destino</p><h2>{cycle?.code ?? 'Selecione um ciclo'}</h2><p>{institution?.name ?? 'Instituição não encontrada'}</p></Card>{preview && <Card><p className="eyebrow">Reconhecimento</p><h2>{preview.validRowCount} eventos</h2><dl><div><dt>Turmas</dt><dd>{preview.classes.length}</dd></div><div><dt>Período</dt><dd>{formatPeriod(preview.periodStart, preview.periodEnd)}</dd></div><div><dt>Ações CP</dt><dd>{preview.actionRowCount}</dd></div><div><dt>Horário pendente</dt><dd>{preview.pendingTimeCount}</dd></div></dl><div className="class-chips">{preview.classes.map((item) => <Badge key={item} tone="accent">{item}</Badge>)}</div></Card>}{preview && <Card className="validation-card"><p className="eyebrow">Validação</p>{preview.fatal ? <p className="validation error"><TriangleAlert /> Há erros bloqueantes.</p> : <p className="validation success"><ShieldCheck /> Pronto para importar.</p>}<ul>{preview.issues.slice(0, 5).map((issue, index) => <li key={`${issue.code}-${index}`} className={issue.level}><span>{issue.level === 'error' ? 'Erro' : 'Aviso'}</span>{issue.message}{issue.row && <small>Linha {issue.row}</small>}</li>)}</ul></Card>}<Button className="confirm-import" disabled={!preview || preview.fatal || identical || !cycle} loading={importing} onClick={() => void confirm()}>{imports.data?.length ? 'Aplicar atualização' : `Importar ${cycle?.code ?? 'cronograma'}`} <ArrowRight size={16} /></Button></aside>
    </div>
  </div>
}

function PreviewTable({ preview }: { preview: ImportPreview }) {
  const sample = [...preview.events.slice(0, 4), ...preview.events.slice(-2)]
  return <Card className="preview-card"><div className="section-heading"><div><p className="eyebrow">Prévia</p><h2>Linhas reconhecidas</h2></div><Badge tone={preview.fatal ? 'warning' : 'positive'}>{preview.fatal ? 'Revisar' : 'Estrutura válida'}</Badge></div><div className="table-scroll"><table><thead><tr><th>Data</th><th>Turma</th><th>Aula</th><th>Horário</th><th>Ação CP</th></tr></thead><tbody>{sample.map((event) => <tr key={event.rowHash}><td>{formatDate(event.eventDate)}</td><td><Badge tone="accent">{event.classCode}</Badge></td><td>{event.title}</td><td>{event.startTime ? `${event.startTime}–${event.endTime}` : <Badge tone="warning">A confirmar</Badge>}</td><td>{event.actionText ?? '—'}</td></tr>)}</tbody></table></div></Card>
}

const MAPPING_FIELDS: [CsvCanonicalField, string, boolean][] = [
  ['date', 'Data', true], ['class', 'Turma', true], ['title', 'Aula', true], ['time', 'Horário', false],
  ['instructor', 'Instrutor', false], ['action', 'Ações CP', false], ['materials', 'Materiais', false],
]

function ManualMappingCard({ preview, mapping, onChange, onApply, loading }: { preview: ImportPreview; mapping: CsvColumnMapping; onChange: (value: CsvColumnMapping) => void; onApply: () => void; loading: boolean }) {
  return <Card className="mapping-card"><div><p className="eyebrow">Mapeamento manual</p><h2>Algum cabeçalho mudou?</h2><p>Associe as colunas essenciais. Campos opcionais podem ficar sem seleção.</p></div><div className="mapping-grid">{MAPPING_FIELDS.map(([field, label, required]) => <label className="field" key={field}><span className="field-label">{label}{required && ' *'}</span><select className="input" value={mapping[field] ?? preview.columnMapping[field] ?? ''} onChange={(event) => onChange({ ...mapping, [field]: event.target.value || undefined })}><option value="">Não mapear</option>{preview.headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}</div><Button variant="secondary" loading={loading} onClick={onApply}>Validar mapeamento</Button></Card>
}

export function ImportDetailPage() {
  const { importId } = useParams()
  const { selectedCycleId } = useWorkspace()
  const imports = useImports(selectedCycleId)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [rollingBack, setRollingBack] = useState(false)
  const batch = imports.data?.find((item) => item.id === importId)
  const changes = useQuery({
    queryKey: ['import-changes', importId], enabled: Boolean(importId),
    queryFn: async () => { const result = await requireSupabase().from('import_changes').select('*').eq('import_batch_id', importId!).order('created_at'); if (result.error) throw new Error(result.error.message); return result.data as ImportChange[] },
  })
  if (imports.isLoading || changes.isLoading) return <LoadingState />
  if (!batch) return <EmptyState title="Importação não encontrada." description="Ela pode pertencer a outro ciclo ou não estar disponível para este usuário." />
  const latest = imports.data?.find((item) => item.status === 'succeeded')
  const canRollback = latest?.id === batch.id && Boolean(batch.previous_batch_id)
  const rollback = async () => {
    setRollingBack(true)
    const result = await requireSupabase().rpc('rollback_latest_import', { p_import_batch_id: batch.id })
    setRollingBack(false)
    if (result.error) return toast.error(result.error.message)
    await Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.events(selectedCycleId) }), queryClient.invalidateQueries({ queryKey: queryKeys.imports(selectedCycleId) })])
    toast.success('Versão anterior restaurada.'); navigate('/imports')
  }
  return <div><Link className="back-link" to="/imports"><ArrowLeft size={16} /> Histórico</Link><PageTitle eyebrow={`Versão ${batch.version_number}`} title={batch.version_number === 1 ? 'Importação inicial' : 'Atualização do cronograma'} description={`${formatDateTime(batch.completed_at ?? batch.created_at)} · ${batch.file_name}`} action={<Badge tone={batch.status === 'succeeded' ? 'positive' : 'warning'}>{statusLabel(batch.status)}</Badge>} />
    <div className="detail-kpis"><MiniKpi label="Linhas válidas" value={batch.valid_rows} /><MiniKpi label="Criados" value={batch.created_count} tone="created" /><MiniKpi label="Atualizados" value={batch.updated_count} tone="updated" /><MiniKpi label="Removidos" value={batch.removed_count} tone="removed" /><MiniKpi label="Sem alteração" value={batch.unchanged_count} /></div>
    <div className="import-detail-grid"><Card className="section-card"><p className="eyebrow">Arquivo e auditoria</p><dl className="metadata-list"><div><dt>Arquivo</dt><dd>{batch.file_name}</dd></div><div><dt>SHA-256</dt><dd><code>{batch.file_hash.slice(0, 18)}…</code></dd></div><div><dt>Versão</dt><dd>{batch.version_number}</dd></div><div><dt>Total de linhas</dt><dd>{batch.total_rows}</dd></div><div><dt>Avisos</dt><dd>{batch.warning_count}</dd></div><div><dt>Erros</dt><dd>{batch.error_count}</dd></div></dl><p className="privacy-note"><ShieldCheck /> O CSV está em bucket privado. Nenhuma URL pública é exposta.</p>{canRollback && <Button variant="danger" loading={rollingBack} onClick={() => void rollback()}><RefreshCcw size={16} /> Restaurar versão anterior</Button>}</Card><Card className="section-card"><div className="section-heading"><div><p className="eyebrow">Diff oficial</p><h2>Alterações detalhadas</h2></div></div>{changes.data?.length ? <div className="change-list">{changes.data.slice(0, 30).map((change) => <div key={change.id}><Badge tone={change.change_type === 'created' ? 'positive' : change.change_type === 'removed' ? 'warning' : 'accent'}>{changeLabel(change.change_type)}</Badge><div><strong>{String(change.after_snapshot?.title ?? change.before_snapshot?.title ?? change.entity_type)}</strong><span>{String(change.after_snapshot?.event_date ?? change.before_snapshot?.event_date ?? '')}</span></div></div>)}</div> : <p className="muted-block">Nenhuma alteração estrutural registrada.</p>}</Card></div>
  </div>
}

interface ImportChange { id: string; entity_type: 'event' | 'action'; entity_id: string; change_type: 'created' | 'updated' | 'removed'; before_snapshot: Record<string, unknown> | null; after_snapshot: Record<string, unknown> | null }
function toRpcEvent(event: ScheduleEvent) { return { class_code: event.classCode, class_source_label: event.classSourceLabel, event_date: event.eventDate, title: event.title, event_kind: event.eventKind, start_time: event.startTime, end_time: event.endTime, time_status: event.timeStatus, original_time_text: event.originalTimeText, instructor_name: event.instructorName, materials_source_status: event.materialsSourceStatus, action_text: event.actionText, normalized_action_text: event.normalizedActionText, source_row_number: event.sourceRowNumber, source_order: event.sourceOrder, identity_hash: event.identityHash, row_hash: event.rowHash, source_payload: event.sourcePayload } }
function statusLabel(status: ImportBatch['status']) { return ({ processing: 'Processando', succeeded: 'Concluída', failed: 'Falhou', rolled_back: 'Revertida' } as const)[status] }
function changeLabel(value: ImportChange['change_type']) { return ({ created: 'Criado', updated: 'Atualizado', removed: 'Removido' } as const)[value] }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function formatDate(value: string) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) }
function formatPeriod(start: string | null, end: string | null) { return start && end ? `${formatDate(start)} → ${formatDate(end)}` : '—' }
function formatBytes(value: number) { return value < 1024 * 1024 ? `${Math.round(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB` }
function MiniKpi({ label, value, tone }: { label: string; value: number; tone?: string }) { return <Card className={`mini-kpi ${tone ?? ''}`}><strong>{value}</strong><span>{label}</span></Card> }
