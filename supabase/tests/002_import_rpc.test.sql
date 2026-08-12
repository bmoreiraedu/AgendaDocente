begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values ('30000000-0000-4000-8000-000000000003', 'rpc@example.test');
insert into public.profiles (id, full_name) values ('30000000-0000-4000-8000-000000000003', 'Usuário RPC');
insert into public.institutions (id, user_id, name) values (
  '31000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 'Instituição RPC'
);
insert into public.cycles (id, user_id, institution_id, code) values (
  '32000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003',
  '31000000-0000-4000-8000-000000000003', 'C-RPC'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}', true);

select lives_ok($$
  select public.apply_schedule_import(
    '33000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000003',
    '32000000-0000-4000-8000-000000000003', 'v1.csv', repeat('1', 64),
    '30000000-0000-4000-8000-000000000003/32000000-0000-4000-8000-000000000003/33000000-0000-4000-8000-000000000003/original.csv',
    1, 0,
    '[{"class_code":"TURMA1","class_source_label":"Turma 1","event_date":"2026-08-11","title":"Aula RPC","event_kind":"class","start_time":"19:00","end_time":"20:00","time_status":"defined","original_time_text":"19h às 20h","instructor_name":"Professor","materials_source_status":true,"action_text":"Postar atividade","normalized_action_text":"postar atividade","source_row_number":2,"source_order":0,"identity_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","row_hash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","source_payload":{}}]'::jsonb,
    null
  )
$$, 'importação inicial executa');

select is((select count(*)::integer from public.events where active), 1, 'um evento ativo');
select is((select count(*)::integer from public.event_actions where active), 1, 'uma ação ativa');
select is((select count(*)::integer from public.action_progress where status = 'pending'), 1, 'ação inicia pendente');
select is((select status from public.import_batches where id = '33000000-0000-4000-8000-000000000003'), 'succeeded', 'lote concluído');

insert into public.event_notes (user_id, event_id, content)
select '30000000-0000-4000-8000-000000000003', id, 'Nota preservada' from public.events limit 1;
update public.action_progress set status = 'completed', completed_at = now();

select lives_ok($$
  select public.apply_schedule_import(
    '34000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000003',
    '32000000-0000-4000-8000-000000000003', 'v2.csv', repeat('2', 64),
    '30000000-0000-4000-8000-000000000003/32000000-0000-4000-8000-000000000003/34000000-0000-4000-8000-000000000003/original.csv',
    1, 0,
    '[{"class_code":"TURMA1","class_source_label":"Turma 1","event_date":"2026-08-11","title":"Aula RPC","event_kind":"class","start_time":"20:00","end_time":"21:00","time_status":"defined","original_time_text":"20h às 21h","instructor_name":"Professor","materials_source_status":true,"action_text":"Postar atividade","normalized_action_text":"postar atividade","source_row_number":2,"source_order":0,"identity_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","row_hash":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","source_payload":{}}]'::jsonb,
    null
  )
$$, 'reimportação executa');

select is((select count(*)::integer from public.events), 1, 'reimportação não duplica evento');
select is((select start_time::text from public.events where active), '20:00:00', 'horário atualizado');
select is((select content from public.event_notes), 'Nota preservada', 'nota pessoal preservada');
select is((select status from public.action_progress), 'completed', 'progresso da ação preservado');

select lives_ok($$select public.rollback_latest_import('34000000-0000-4000-8000-000000000003')$$, 'rollback da última versão executa');
select is((select start_time::text from public.events where active), '19:00:00', 'rollback restaura horário');
select is((select status from public.import_batches where id = '34000000-0000-4000-8000-000000000003'), 'rolled_back', 'lote marcado como revertido');

select * from finish();
rollback;
