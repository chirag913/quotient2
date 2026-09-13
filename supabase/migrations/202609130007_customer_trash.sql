begin;
alter table public.leads add column deleted_at timestamptz;
alter table public.payment_records add column crm_deleted_at timestamptz;

-- CRM removal never deletes financial records or changes a payment's status.
create function public.sq_customer_trash(p_submission_id uuid, p_deleted boolean)
returns void language plpgsql security definer set search_path='' as $$
declare changed_at timestamptz;
begin
  if public.sq_staff_role() is distinct from 'owner' then
    raise exception 'Owner access required' using errcode='42501';
  end if;
  if p_submission_id is null or p_deleted is null then
    raise exception 'Invalid customer' using errcode='22023';
  end if;
  changed_at := case when p_deleted then now() else null end;
  update public.leads set deleted_at=changed_at where submission_id=p_submission_id;
  if not found then raise exception 'Customer not found' using errcode='P0002'; end if;
  update public.payment_records set crm_deleted_at=changed_at where submission_id=p_submission_id;
  insert into public.audit_events(actor_id,action)
  values(auth.uid(),case when p_deleted then 'customer.trashed:' else 'customer.restored:' end || p_submission_id::text);
end;$$;
revoke all on function public.sq_customer_trash(uuid,boolean) from public,anon,authenticated;
grant execute on function public.sq_customer_trash(uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
