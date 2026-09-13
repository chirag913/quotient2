begin;
create table public.payment_records (
  id bigint generated always as identity primary key,
  lead_id uuid references public.leads(id) on delete set null,
  submission_id uuid not null,
  customer_name text not null check(length(trim(customer_name)) between 1 and 200),
  email text not null,
  phone text not null,
  plan_type text not null check(plan_type in ('plan','consultation')),
  plan text not null,
  amount bigint not null check(amount >= 0),
  currency text not null default 'INR',
  status text not null default 'pending' check(status in ('pending','paid','failed')),
  razorpay_payment_id text,
  razorpay_order_id text,
  razorpay_subscription_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  failure_reason text,
  meta jsonb
);

create unique index payment_records_one_pending_per_lead_submission on public.payment_records (submission_id,plan_type) where status='pending';
create unique index payment_records_payment_id_uniq on public.payment_records (razorpay_payment_id) where razorpay_payment_id is not null;
create unique index payment_records_order_id_uniq on public.payment_records (razorpay_order_id) where razorpay_order_id is not null;
create unique index payment_records_subscription_id_uniq on public.payment_records (razorpay_subscription_id) where razorpay_subscription_id is not null;
create index payment_records_status_idx on public.payment_records (status,created_at desc);
create index payment_records_plan_idx on public.payment_records (plan_type,created_at desc);
create index payment_records_submission_idx on public.payment_records (submission_id);

alter table public.payment_records enable row level security;
revoke all on public.payment_records from anon,authenticated;
grant select, insert, update on public.payment_records to authenticated;
create policy payment_records_staff_read on public.payment_records for select to authenticated using (public.sq_staff_role() in ('owner','practitioner'));
grant update on public.payment_records to authenticated;
create policy payment_records_staff_update on public.payment_records for update to authenticated using (public.sq_staff_role() in ('owner','practitioner'));
create policy payment_records_staff_insert on public.payment_records for insert to authenticated with check (public.sq_staff_role() in ('owner','practitioner'));
commit;
