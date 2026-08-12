-- Cover composite foreign keys so cascades and referential checks remain efficient.
create index action_progress_action_owner_idx on public.action_progress (action_id, user_id);
create index class_preferences_owner_idx on public.class_preferences (class_id, user_id);
create index cycles_institution_owner_idx on public.cycles (institution_id, user_id);
create index event_actions_event_owner_idx on public.event_actions (event_id, user_id);
create index event_notes_event_owner_idx on public.event_notes (event_id, user_id);
create index events_class_owner_idx on public.events (class_id, user_id);
create index events_import_owner_idx on public.events (current_import_batch_id, user_id);
create index import_batches_cycle_owner_idx on public.import_batches (cycle_id, user_id);
create index import_batches_institution_owner_idx on public.import_batches (institution_id, user_id);
create index import_batches_previous_owner_idx on public.import_batches (previous_batch_id, user_id);
create index import_batches_template_owner_idx on public.import_batches (template_id, user_id);
create index import_changes_batch_owner_idx on public.import_changes (import_batch_id, user_id);
create index import_changes_user_idx on public.import_changes (user_id);
create index import_templates_institution_owner_idx on public.import_templates (institution_id, user_id);
create index teaching_classes_cycle_owner_idx on public.teaching_classes (cycle_id, user_id);
