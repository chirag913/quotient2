begin;
-- Webhook payloads are backend-only, including on projects with permissive
-- public-schema default grants. Do not rely on Supabase's default privileges.
alter table public.payment_events enable row level security;
revoke all on public.payment_events from anon, authenticated;
grant select, insert, update on public.payment_records, public.payment_events to service_role;
grant usage, select on sequence public.payment_records_id_seq, public.payment_events_id_seq to service_role;
notify pgrst, 'reload schema';
commit;
