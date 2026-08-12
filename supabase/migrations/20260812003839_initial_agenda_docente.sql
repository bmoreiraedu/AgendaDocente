create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  display_name text,
  avatar_path text,
  job_title text,
  phone text,
  timezone text not null default 'America/Sao_Paulo',
  locale text not null default 'pt-BR',
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  default_agenda_view text not null default 'week' check (default_agenda_view in ('day', 'week', 'month')),
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  show_weekends boolean not null default true,
  hour_format text not null default '24h' check (hour_format in ('24h')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('master', 'admin', 'user')),
  created_at timestamptz not null default now()
);

create table public.institutions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  short_name text,
  logo_path text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name)
);

create table public.cycles (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  institution_id uuid not null,
  code text not null check (length(trim(code)) > 0),
  name text,
  start_date date,
  end_date date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, institution_id, code),
  constraint cycles_institution_owner_fk foreign key (institution_id, user_id)
    references public.institutions(id, user_id) on delete cascade,
  constraint cycles_date_order check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.teaching_classes (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cycle_id uuid not null,
  code text not null check (code = upper(regexp_replace(code, '\s+', '', 'g'))),
  source_label text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, cycle_id, code),
  constraint classes_cycle_owner_fk foreign key (cycle_id, user_id)
    references public.cycles(id, user_id) on delete cascade
);

create table public.class_preferences (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null,
  color_token text,
  note_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, class_id),
  constraint class_preferences_owner_fk foreign key (class_id, user_id)
    references public.teaching_classes(id, user_id) on delete cascade
);

create table public.import_templates (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  institution_id uuid,
  name text not null check (length(trim(name)) > 0),
  header_signature text,
  column_mapping jsonb not null check (jsonb_typeof(column_mapping) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint import_templates_institution_owner_fk foreign key (institution_id, user_id)
    references public.institutions(id, user_id) on delete cascade
);

create table public.import_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  institution_id uuid not null,
  cycle_id uuid not null,
  template_id uuid,
  source_type text not null default 'csv_upload' check (source_type = 'csv_upload'),
  file_name text not null,
  file_hash text not null check (file_hash ~ '^[0-9a-f]{64}$'),
  storage_path text,
  status text not null check (status in ('processing', 'succeeded', 'failed', 'rolled_back')),
  version_number integer not null check (version_number > 0),
  previous_batch_id uuid,
  total_rows integer not null default 0 check (total_rows >= 0),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  warning_count integer not null default 0 check (warning_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  created_count integer not null default 0 check (created_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  removed_count integer not null default 0 check (removed_count >= 0),
  unchanged_count integer not null default 0 check (unchanged_count >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, cycle_id, version_number),
  constraint import_batches_institution_owner_fk foreign key (institution_id, user_id)
    references public.institutions(id, user_id) on delete restrict,
  constraint import_batches_cycle_owner_fk foreign key (cycle_id, user_id)
    references public.cycles(id, user_id) on delete restrict,
  constraint import_batches_template_owner_fk foreign key (template_id, user_id)
    references public.import_templates(id, user_id) on delete restrict,
  constraint import_batches_previous_owner_fk foreign key (previous_batch_id, user_id)
    references public.import_batches(id, user_id) on delete restrict
);

create table public.events (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null,
  event_date date not null,
  title text not null check (length(trim(title)) > 0),
  event_kind text not null default 'class' check (event_kind in ('class', 'special', 'other')),
  start_time time,
  end_time time,
  time_status text not null default 'defined' check (time_status in ('defined', 'pending')),
  original_time_text text,
  instructor_name text,
  materials_source_status boolean,
  source_row_number integer,
  source_order integer,
  identity_hash text,
  row_hash text not null check (row_hash ~ '^[0-9a-f]{64}$'),
  source_payload jsonb,
  current_import_batch_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, class_id, identity_hash),
  constraint events_class_owner_fk foreign key (class_id, user_id)
    references public.teaching_classes(id, user_id) on delete cascade,
  constraint events_import_owner_fk foreign key (current_import_batch_id, user_id)
    references public.import_batches(id, user_id) on delete restrict,
  constraint events_time_shape check (
    (time_status = 'defined' and start_time is not null and end_time is not null and end_time > start_time)
    or (time_status = 'pending' and start_time is null and end_time is null)
  )
);

create table public.event_actions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null,
  action_text text not null check (length(trim(action_text)) > 0),
  normalized_action_text text not null check (length(trim(normalized_action_text)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint event_actions_event_owner_fk foreign key (event_id, user_id)
    references public.events(id, user_id) on delete cascade
);

create unique index event_actions_one_active_text_idx
  on public.event_actions(user_id, event_id, normalized_action_text) where active;

create table public.action_progress (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, action_id),
  constraint action_progress_action_owner_fk foreign key (action_id, user_id)
    references public.event_actions(id, user_id) on delete cascade,
  constraint action_progress_completion check (
    (status = 'pending' and completed_at is null) or (status = 'completed' and completed_at is not null)
  )
);

create table public.event_notes (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_id),
  constraint event_notes_event_owner_fk foreign key (event_id, user_id)
    references public.events(id, user_id) on delete cascade
);

create table public.import_changes (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  import_batch_id uuid not null,
  entity_type text not null check (entity_type in ('event', 'action')),
  entity_id uuid not null,
  change_type text not null check (change_type in ('created', 'updated', 'removed')),
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_at timestamptz not null default now(),
  constraint import_changes_batch_owner_fk foreign key (import_batch_id, user_id)
    references public.import_batches(id, user_id) on delete cascade
);

create index institutions_user_idx on public.institutions(user_id);
create index cycles_user_institution_idx on public.cycles(user_id, institution_id);
create index classes_user_cycle_idx on public.teaching_classes(user_id, cycle_id);
create index events_user_class_date_idx on public.events(user_id, class_id, event_date);
create index events_user_active_date_idx on public.events(user_id, active, event_date);
create index events_import_idx on public.events(current_import_batch_id);
create index event_actions_user_event_idx on public.event_actions(user_id, event_id, active);
create index action_progress_user_action_idx on public.action_progress(user_id, action_id);
create index event_notes_user_event_idx on public.event_notes(user_id, event_id);
create index import_batches_user_cycle_idx on public.import_batches(user_id, cycle_id, version_number desc);
create unique index import_templates_user_signature_idx on public.import_templates(user_id, header_signature)
  where header_signature is not null;
create index import_changes_batch_idx on public.import_changes(import_batch_id, entity_type, change_type);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger institutions_set_updated_at before update on public.institutions
  for each row execute function public.set_updated_at();
create trigger cycles_set_updated_at before update on public.cycles
  for each row execute function public.set_updated_at();
create trigger teaching_classes_set_updated_at before update on public.teaching_classes
  for each row execute function public.set_updated_at();
create trigger class_preferences_set_updated_at before update on public.class_preferences
  for each row execute function public.set_updated_at();
create trigger import_templates_set_updated_at before update on public.import_templates
  for each row execute function public.set_updated_at();
create trigger events_set_updated_at before update on public.events
  for each row execute function public.set_updated_at();
create trigger event_actions_set_updated_at before update on public.event_actions
  for each row execute function public.set_updated_at();
create trigger action_progress_set_updated_at before update on public.action_progress
  for each row execute function public.set_updated_at();
create trigger event_notes_set_updated_at before update on public.event_notes
  for each row execute function public.set_updated_at();

create or replace function public.apply_schedule_import(
  p_batch_id uuid,
  p_institution_id uuid,
  p_cycle_id uuid,
  p_file_name text,
  p_file_hash text,
  p_storage_path text,
  p_total_rows integer,
  p_warning_count integer,
  p_payload jsonb,
  p_template_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_previous_batch_id uuid;
  v_batch_id uuid := p_batch_id;
  v_version integer;
  v_item jsonb;
  v_class_id uuid;
  v_event public.events%rowtype;
  v_removed_event public.events%rowtype;
  v_active_action public.event_actions%rowtype;
  v_target_action public.event_actions%rowtype;
  v_before jsonb;
  v_created integer := 0;
  v_updated integer := 0;
  v_removed integer := 0;
  v_unchanged integer := 0;
  v_valid integer := 0;
  v_color text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if v_batch_id is null then
    raise exception 'batch id is required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload) <> 'array' or jsonb_array_length(p_payload) = 0 then
    raise exception 'payload must be a non-empty JSON array' using errcode = '22023';
  end if;
  if p_file_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid SHA-256 file hash' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.institutions
    where id = p_institution_id and user_id = v_user_id and archived_at is null
  ) then
    raise exception 'institution not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.cycles
    where id = p_cycle_id and institution_id = p_institution_id and user_id = v_user_id and archived_at is null
  ) then
    raise exception 'cycle not found' using errcode = 'P0002';
  end if;
  if p_template_id is not null and not exists (
    select 1 from public.import_templates where id = p_template_id and user_id = v_user_id
  ) then
    raise exception 'template not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.import_batches
    where user_id = v_user_id and cycle_id = p_cycle_id and file_hash = p_file_hash and status = 'succeeded'
      and version_number = (
        select max(version_number) from public.import_batches
        where user_id = v_user_id and cycle_id = p_cycle_id and status = 'succeeded'
      )
  ) then
    raise exception 'file is already the current schedule version' using errcode = '23505';
  end if;

  select id into v_previous_batch_id
  from public.import_batches
  where user_id = v_user_id and cycle_id = p_cycle_id and status = 'succeeded'
  order by version_number desc limit 1;

  select coalesce(max(version_number), 0) + 1 into v_version
  from public.import_batches where user_id = v_user_id and cycle_id = p_cycle_id;

  insert into public.import_batches (
    id, user_id, institution_id, cycle_id, template_id, file_name, file_hash, storage_path,
    status, version_number, previous_batch_id, total_rows, warning_count
  ) values (
    v_batch_id, v_user_id, p_institution_id, p_cycle_id, p_template_id, p_file_name, p_file_hash, p_storage_path,
    'processing', v_version, v_previous_batch_id, greatest(p_total_rows, 0), greatest(p_warning_count, 0)
  ) returning id into v_batch_id;

  for v_item in select value from jsonb_array_elements(p_payload)
  loop
    if coalesce(v_item->>'class_code', '') = ''
      or coalesce(v_item->>'event_date', '') = ''
      or coalesce(v_item->>'title', '') = ''
      or coalesce(v_item->>'identity_hash', '') = ''
      or coalesce(v_item->>'row_hash', '') = '' then
      raise exception 'invalid normalized event payload' using errcode = '22023';
    end if;

    insert into public.teaching_classes (user_id, cycle_id, code, source_label)
    values (v_user_id, p_cycle_id, v_item->>'class_code', nullif(v_item->>'class_source_label', ''))
    on conflict (user_id, cycle_id, code) do update
      set source_label = coalesce(excluded.source_label, public.teaching_classes.source_label), archived_at = null
    returning id into v_class_id;

    v_color := case mod((('x' || substr(md5(v_item->>'class_code'), 1, 8))::bit(32)::bigint), 6)
      when 0 then 'teal' when 1 then 'indigo' when 2 then 'amber'
      when 3 then 'rose' when 4 then 'sky' else 'violet' end;
    insert into public.class_preferences (user_id, class_id, color_token)
    values (v_user_id, v_class_id, v_color)
    on conflict (user_id, class_id) do nothing;

    select * into v_event from public.events
    where user_id = v_user_id and class_id = v_class_id and identity_hash = v_item->>'identity_hash'
    limit 1;

    if v_event.id is null then
      insert into public.events (
        user_id, class_id, event_date, title, event_kind, start_time, end_time, time_status,
        original_time_text, instructor_name, materials_source_status, source_row_number, source_order,
        identity_hash, row_hash, source_payload, current_import_batch_id, active
      ) values (
        v_user_id, v_class_id, (v_item->>'event_date')::date, v_item->>'title', coalesce(v_item->>'event_kind', 'class'),
        nullif(v_item->>'start_time', '')::time, nullif(v_item->>'end_time', '')::time,
        coalesce(v_item->>'time_status', 'pending'), nullif(v_item->>'original_time_text', ''),
        nullif(v_item->>'instructor_name', ''), case when v_item ? 'materials_source_status' then (v_item->>'materials_source_status')::boolean else null end,
        nullif(v_item->>'source_row_number', '')::integer, nullif(v_item->>'source_order', '')::integer,
        v_item->>'identity_hash', v_item->>'row_hash', v_item->'source_payload', v_batch_id, true
      ) returning * into v_event;
      insert into public.import_changes (user_id, import_batch_id, entity_type, entity_id, change_type, after_snapshot)
      values (v_user_id, v_batch_id, 'event', v_event.id, 'created', to_jsonb(v_event));
      v_created := v_created + 1;
    elsif v_event.row_hash = v_item->>'row_hash' and v_event.active then
      update public.events set
        current_import_batch_id = v_batch_id,
        source_row_number = nullif(v_item->>'source_row_number', '')::integer,
        source_order = nullif(v_item->>'source_order', '')::integer,
        source_payload = v_item->'source_payload'
      where id = v_event.id and user_id = v_user_id
      returning * into v_event;
      v_unchanged := v_unchanged + 1;
    else
      v_before := to_jsonb(v_event);
      update public.events set
        event_date = (v_item->>'event_date')::date,
        title = v_item->>'title',
        event_kind = coalesce(v_item->>'event_kind', 'class'),
        start_time = nullif(v_item->>'start_time', '')::time,
        end_time = nullif(v_item->>'end_time', '')::time,
        time_status = coalesce(v_item->>'time_status', 'pending'),
        original_time_text = nullif(v_item->>'original_time_text', ''),
        instructor_name = nullif(v_item->>'instructor_name', ''),
        materials_source_status = case when v_item ? 'materials_source_status' then (v_item->>'materials_source_status')::boolean else null end,
        source_row_number = nullif(v_item->>'source_row_number', '')::integer,
        source_order = nullif(v_item->>'source_order', '')::integer,
        row_hash = v_item->>'row_hash',
        source_payload = v_item->'source_payload',
        current_import_batch_id = v_batch_id,
        active = true
      where id = v_event.id and user_id = v_user_id
      returning * into v_event;
      insert into public.import_changes (user_id, import_batch_id, entity_type, entity_id, change_type, before_snapshot, after_snapshot)
      values (v_user_id, v_batch_id, 'event', v_event.id, 'updated', v_before, to_jsonb(v_event));
      v_updated := v_updated + 1;
    end if;

    v_active_action := null;
    select * into v_active_action from public.event_actions
    where user_id = v_user_id and event_id = v_event.id and active
    order by created_at desc limit 1;

    if nullif(v_item->>'normalized_action_text', '') is null then
      if v_active_action.id is not null then
        v_before := to_jsonb(v_active_action);
        update public.event_actions set active = false
        where id = v_active_action.id and user_id = v_user_id returning * into v_active_action;
        insert into public.import_changes (user_id, import_batch_id, entity_type, entity_id, change_type, before_snapshot, after_snapshot)
        values (v_user_id, v_batch_id, 'action', v_active_action.id, 'removed', v_before, to_jsonb(v_active_action));
      end if;
    elsif v_active_action.id is not null and v_active_action.normalized_action_text = v_item->>'normalized_action_text' then
      update public.event_actions set action_text = v_item->>'action_text'
      where id = v_active_action.id and user_id = v_user_id;
    else
      if v_active_action.id is not null then
        v_before := to_jsonb(v_active_action);
        update public.event_actions set active = false
        where id = v_active_action.id and user_id = v_user_id returning * into v_active_action;
        insert into public.import_changes (user_id, import_batch_id, entity_type, entity_id, change_type, before_snapshot, after_snapshot)
        values (v_user_id, v_batch_id, 'action', v_active_action.id, 'removed', v_before, to_jsonb(v_active_action));
      end if;

      v_target_action := null;
      select * into v_target_action from public.event_actions
      where user_id = v_user_id and event_id = v_event.id
        and normalized_action_text = v_item->>'normalized_action_text'
      order by created_at desc limit 1;
      if v_target_action.id is null then
        insert into public.event_actions (user_id, event_id, action_text, normalized_action_text, active)
        values (v_user_id, v_event.id, v_item->>'action_text', v_item->>'normalized_action_text', true)
        returning * into v_target_action;
        insert into public.action_progress (user_id, action_id) values (v_user_id, v_target_action.id);
        insert into public.import_changes (user_id, import_batch_id, entity_type, entity_id, change_type, after_snapshot)
        values (v_user_id, v_batch_id, 'action', v_target_action.id, 'created', to_jsonb(v_target_action));
      else
        v_before := to_jsonb(v_target_action);
        update public.event_actions set action_text = v_item->>'action_text', active = true
        where id = v_target_action.id and user_id = v_user_id returning * into v_target_action;
        insert into public.action_progress (user_id, action_id) values (v_user_id, v_target_action.id)
        on conflict (user_id, action_id) do nothing;
        insert into public.import_changes (user_id, import_batch_id, entity_type, entity_id, change_type, before_snapshot, after_snapshot)
        values (v_user_id, v_batch_id, 'action', v_target_action.id, 'updated', v_before, to_jsonb(v_target_action));
      end if;
    end if;
    v_valid := v_valid + 1;
    v_event := null;
    v_active_action := null;
    v_target_action := null;
  end loop;

  for v_removed_event in
    select e.* from public.events e
    join public.teaching_classes tc on tc.id = e.class_id and tc.user_id = e.user_id
    where e.user_id = v_user_id and tc.cycle_id = p_cycle_id and e.active
      and e.current_import_batch_id is distinct from v_batch_id
  loop
    v_before := to_jsonb(v_removed_event);
    update public.events set active = false, current_import_batch_id = v_batch_id
    where id = v_removed_event.id and user_id = v_user_id returning * into v_removed_event;
    insert into public.import_changes (user_id, import_batch_id, entity_type, entity_id, change_type, before_snapshot, after_snapshot)
    values (v_user_id, v_batch_id, 'event', v_removed_event.id, 'removed', v_before, to_jsonb(v_removed_event));
    v_removed := v_removed + 1;
  end loop;

  update public.import_batches set
    status = 'succeeded', valid_rows = v_valid, created_count = v_created, updated_count = v_updated,
    removed_count = v_removed, unchanged_count = v_unchanged, completed_at = now()
  where id = v_batch_id and user_id = v_user_id;

  update public.cycles set
    start_date = (select min(e.event_date) from public.events e join public.teaching_classes tc on tc.id = e.class_id
      where e.user_id = v_user_id and tc.cycle_id = p_cycle_id and e.active),
    end_date = (select max(e.event_date) from public.events e join public.teaching_classes tc on tc.id = e.class_id
      where e.user_id = v_user_id and tc.cycle_id = p_cycle_id and e.active)
  where id = p_cycle_id and user_id = v_user_id;

  return jsonb_build_object(
    'batch_id', v_batch_id, 'version_number', v_version, 'valid_rows', v_valid,
    'created', v_created, 'updated', v_updated, 'removed', v_removed, 'unchanged', v_unchanged
  );
end;
$$;

create or replace function public.rollback_latest_import(p_import_batch_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_batch public.import_batches%rowtype;
  v_change public.import_changes%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  select * into v_batch from public.import_batches
  where id = p_import_batch_id and user_id = v_user_id and status = 'succeeded';
  if v_batch.id is null then
    raise exception 'import batch not found' using errcode = 'P0002';
  end if;
  if v_batch.id is distinct from (
    select id from public.import_batches
    where user_id = v_user_id and cycle_id = v_batch.cycle_id and status = 'succeeded'
    order by version_number desc limit 1
  ) then
    raise exception 'only the latest successful import can be rolled back' using errcode = '22023';
  end if;
  if v_batch.previous_batch_id is null then
    raise exception 'the initial import has no previous version' using errcode = '22023';
  end if;

  for v_change in
    select * from public.import_changes
    where import_batch_id = v_batch.id and user_id = v_user_id and entity_type = 'action'
    order by case change_type when 'created' then 0 else 1 end, created_at desc
  loop
    if v_change.change_type = 'created' then
      update public.event_actions set active = false where id = v_change.entity_id and user_id = v_user_id;
    elsif v_change.before_snapshot is not null then
      update public.event_actions set
        action_text = v_change.before_snapshot->>'action_text',
        normalized_action_text = v_change.before_snapshot->>'normalized_action_text',
        active = (v_change.before_snapshot->>'active')::boolean
      where id = v_change.entity_id and user_id = v_user_id;
    end if;
  end loop;

  for v_change in
    select * from public.import_changes
    where import_batch_id = v_batch.id and user_id = v_user_id and entity_type = 'event'
    order by created_at desc
  loop
    if v_change.change_type = 'created' then
      update public.events set active = false where id = v_change.entity_id and user_id = v_user_id;
    elsif v_change.before_snapshot is not null then
      update public.events set
        event_date = (v_change.before_snapshot->>'event_date')::date,
        title = v_change.before_snapshot->>'title',
        event_kind = v_change.before_snapshot->>'event_kind',
        start_time = nullif(v_change.before_snapshot->>'start_time', '')::time,
        end_time = nullif(v_change.before_snapshot->>'end_time', '')::time,
        time_status = v_change.before_snapshot->>'time_status',
        original_time_text = v_change.before_snapshot->>'original_time_text',
        instructor_name = v_change.before_snapshot->>'instructor_name',
        materials_source_status = nullif(v_change.before_snapshot->>'materials_source_status', '')::boolean,
        source_row_number = nullif(v_change.before_snapshot->>'source_row_number', '')::integer,
        source_order = nullif(v_change.before_snapshot->>'source_order', '')::integer,
        identity_hash = v_change.before_snapshot->>'identity_hash',
        row_hash = v_change.before_snapshot->>'row_hash',
        source_payload = v_change.before_snapshot->'source_payload',
        current_import_batch_id = nullif(v_change.before_snapshot->>'current_import_batch_id', '')::uuid,
        active = (v_change.before_snapshot->>'active')::boolean
      where id = v_change.entity_id and user_id = v_user_id;
    end if;
  end loop;

  update public.import_batches set status = 'rolled_back'
  where id = v_batch.id and user_id = v_user_id;

  return jsonb_build_object('rolled_back_batch_id', v_batch.id, 'restored_batch_id', v_batch.previous_batch_id);
end;
$$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.institutions enable row level security;
alter table public.cycles enable row level security;
alter table public.teaching_classes enable row level security;
alter table public.class_preferences enable row level security;
alter table public.import_templates enable row level security;
alter table public.import_batches enable row level security;
alter table public.events enable row level security;
alter table public.event_actions enable row level security;
alter table public.action_progress enable row level security;
alter table public.event_notes enable row level security;
alter table public.import_changes enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "user_roles_select_own" on public.user_roles for select to authenticated
  using ((select auth.uid()) = user_id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'institutions', 'cycles', 'teaching_classes', 'class_preferences', 'import_templates',
    'import_batches', 'events', 'event_actions', 'action_progress', 'event_notes', 'import_changes'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      table_name || '_select_own', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      table_name || '_insert_own', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name || '_update_own', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      table_name || '_delete_own', table_name
    );
  end loop;
end;
$$;

revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from public, anon;
grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, update, delete on
  public.institutions, public.cycles, public.teaching_classes, public.class_preferences,
  public.import_templates, public.import_batches, public.events, public.event_actions,
  public.action_progress, public.event_notes, public.import_changes
to authenticated;
grant execute on function public.apply_schedule_import(uuid, uuid, uuid, text, text, text, integer, integer, jsonb, uuid) to authenticated;
grant execute on function public.rollback_latest_import(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('schedule-imports', 'schedule-imports', false, 10485760, array['text/csv', 'text/plain', 'application/vnd.ms-excel']),
  ('avatars', 'avatars', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "schedule_imports_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'schedule-imports' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "schedule_imports_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'schedule-imports' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "schedule_imports_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'schedule-imports' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
