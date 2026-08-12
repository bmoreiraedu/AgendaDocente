begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

select has_table('public', 'profiles', 'profiles existe');
select has_table('public', 'events', 'events existe');
select has_table('public', 'import_batches', 'import_batches existe');
select has_function('public', 'apply_schedule_import', array['uuid','uuid','uuid','text','text','text','integer','integer','jsonb','uuid'], 'RPC de importação existe');
select has_function('public', 'rollback_latest_import', array['uuid'], 'RPC de rollback existe');
select is((select relrowsecurity from pg_class where oid = 'public.events'::regclass), true, 'RLS ativa em events');
select is((select relrowsecurity from pg_class where oid = 'public.event_notes'::regclass), true, 'RLS ativa em event_notes');
select is((select relrowsecurity from pg_class where oid = 'public.import_batches'::regclass), true, 'RLS ativa em import_batches');

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'a@example.test'),
  ('20000000-0000-4000-8000-000000000002', 'b@example.test');

insert into public.profiles (id, full_name) values
  ('10000000-0000-4000-8000-000000000001', 'Usuário A'),
  ('20000000-0000-4000-8000-000000000002', 'Usuário B');
insert into public.institutions (id, user_id, name) values
  ('11000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Instituição A');
insert into public.cycles (id, user_id, institution_id, code) values
  ('12000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'C1');
insert into public.teaching_classes (id, user_id, cycle_id, code) values
  ('13000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', 'TURMAA');
insert into public.events (
  id, user_id, class_id, event_date, title, start_time, end_time, time_status, identity_hash, row_hash
) values (
  '14000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
  '13000000-0000-4000-8000-000000000001', '2026-08-11', 'Evento privado A', '19:00', '20:00', 'defined',
  repeat('a', 64), repeat('b', 64)
);
insert into public.event_notes (user_id, event_id, content) values
  ('10000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', 'Nota privada A');
insert into storage.objects (bucket_id, name, owner_id) values
  ('avatars', '10000000-0000-4000-8000-000000000001/avatar.png', '10000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select is((select count(*)::integer from public.events), 0, 'B não lê eventos de A');
select is((select count(*)::integer from public.event_notes), 0, 'B não lê notas de A');
select is((select count(*)::integer from public.institutions), 0, 'B não lê instituições de A');
select is((select count(*)::integer from storage.objects where bucket_id = 'avatars'), 0, 'B não lê Storage de A');

update public.events set title = 'Ataque B' where id = '14000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.events where title = 'Ataque B'), 0, 'B não altera eventos de A');

delete from public.event_notes where id is not null;
select is((select count(*)::integer from public.event_notes), 0, 'B não exclui notas de A');

select throws_ok(
  $$insert into public.user_roles (user_id, role) values ('20000000-0000-4000-8000-000000000002', 'master')$$,
  '42501', null, 'usuário comum não pode se autoelevar'
);

reset role;
select is((select title from public.events where id = '14000000-0000-4000-8000-000000000001'), 'Evento privado A', 'evento de A permaneceu intacto');
select is((select count(*)::integer from public.event_notes where user_id = '10000000-0000-4000-8000-000000000001'), 1, 'nota de A permaneceu intacta');
select is((select count(*)::integer from storage.objects where owner_id = '10000000-0000-4000-8000-000000000001'), 1, 'objeto de A permaneceu intacto');

select * from finish();
rollback;
