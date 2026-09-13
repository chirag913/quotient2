begin;
create table public.payment_events (
 id bigint generated always as identity primary key,
 provider text not null default 'razorpay',
 provider_event_id text not null unique,
 provider_event text not null,
 payment_id text,
 subscription_id text,
 order_id text,
 submission_id text,
 email text,
 phone text,
 plan text,
 status text,
 amount bigint,
 currency text,
 raw jsonb not null,
 processed_at timestamptz,
 received_at timestamptz not null default now()
);
create index payment_events_submission_idx on public.payment_events (submission_id);
create index payment_events_payment_idx on public.payment_events (payment_id);
create index payment_events_subscription_idx on public.payment_events (subscription_id);
commit;
