begin;
create table public.leads (
 id uuid primary key default gen_random_uuid(), submission_id uuid not null unique,
 definition_version text not null references public.assessment_definitions(version),
 name text not null check(length(name) between 1 and 100),email text not null,phone text not null,
 answers jsonb not null,scores jsonb not null,primary_profile text not null,
 consent_version text not null,consent_at timestamptz not null default now(),whatsapp_consent boolean not null,
 contact_hash text not null,assigned_to uuid references public.staff_memberships(user_id),
 status text not null default 'new' check(status in ('new','reviewed')),created_at timestamptz not null default now()
);
create index leads_created on public.leads(created_at desc);
create index leads_contact on public.leads(contact_hash,created_at desc);
alter table public.leads enable row level security;
revoke all on public.leads from anon,authenticated;
grant select on public.leads to authenticated;
create policy lead_staff_read on public.leads for select to authenticated using(public.sq_staff_role()='owner' or (public.sq_staff_role()='practitioner' and assigned_to=auth.uid()));
create function public.sq_submit_lead(p_submission_id uuid,p_version text,p_name text,p_email text,p_phone text,p_answers jsonb,p_consent text,p_whatsapp boolean,p_contact_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare definition jsonb;q jsonb;selected jsonb;choice jsonb;weight record;v integer;
 scores jsonb:='{"oil":0,"dehydration":0,"sensitivity":0,"sun":0}';primary_name text;saved public.leads;
begin
 if p_submission_id is null or p_version is distinct from '2026-09-09-v1' or p_name is null or length(trim(p_name)) not between 1 and 100 or p_email is null or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or p_phone is null or p_phone !~ '^\+[1-9][0-9]{9,14}$' or p_consent is distinct from '2026-09-09' or p_whatsapp is null or p_contact_hash is null or p_contact_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid submission' using errcode='22023';end if;
 perform pg_advisory_xact_lock(91520260909);
 select * into saved from public.leads where submission_id=p_submission_id;
 if saved.id is not null then
 if saved.answers<>p_answers or saved.name<>trim(p_name) or saved.email<>lower(p_email) or saved.phone<>p_phone or saved.whatsapp_consent<>p_whatsapp then raise exception 'Submission changed' using errcode='22023';end if;
 return saved.id;end if;
 if (select count(*) from public.leads where created_at>now()-interval '1 day')>=500 or (select count(*) from public.leads where contact_hash=p_contact_hash and created_at>now()-interval '1 day')>=5 then raise exception 'Daily submission limit' using errcode='54000';end if;
 select d.definition into definition from public.assessment_definitions d where d.version=p_version;
 if definition is null or p_answers is null or jsonb_typeof(p_answers)<>'object' or (select count(*) from jsonb_object_keys(p_answers))<>7 then raise exception 'Invalid answers' using errcode='22023'; end if;
 for q in select * from jsonb_array_elements(definition->'questions') loop
   selected := p_answers->(q->>'id');
   if selected is null or jsonb_typeof(selected)<>'array' then raise exception 'Missing question' using errcode='22023'; end if;
   if jsonb_array_length(selected)<1 or jsonb_array_length(selected)>(case when (q->>'multi')::boolean then coalesce((q->>'max')::int,1) else 1 end) then raise exception 'Invalid selection count' using errcode='22023'; end if;
   if (select count(distinct value) from jsonb_array_elements(selected))<>jsonb_array_length(selected) then raise exception 'Duplicate answer' using errcode='22023'; end if;
   if q->>'id'='secondary' and selected @> '[4]' and jsonb_array_length(selected)>1 then raise exception 'None is exclusive' using errcode='22023'; end if;
   for choice in select * from jsonb_array_elements(selected) loop
     if jsonb_typeof(choice)<>'number' or choice::text !~ '^[0-9]+$' then raise exception 'Invalid option' using errcode='22023'; end if;
     v := choice::text::int;
     if v<0 or v>=jsonb_array_length(q->'options') then raise exception 'Invalid option' using errcode='22023'; end if;
     for weight in select * from jsonb_each_text(q->'options'->v->'w') loop
       scores := jsonb_set(scores,array[weight.key],to_jsonb((scores->>weight.key)::int+weight.value::int));
     end loop;
   end loop;
 end loop;
 select key into primary_name from unnest(array['oil','dehydration','sensitivity','sun']) with ordinality as d(key,ordinal) order by (scores->>key)::int desc,ordinal limit 1;

 insert into public.leads(submission_id,definition_version,name,email,phone,answers,scores,primary_profile,consent_version,whatsapp_consent,contact_hash) values(p_submission_id,p_version,trim(p_name),lower(p_email),p_phone,p_answers,scores,primary_name,p_consent,p_whatsapp,p_contact_hash) returning * into saved;
 return saved.id;
end;$$;
revoke all on function public.sq_submit_lead(uuid,text,text,text,text,jsonb,text,boolean,text) from public,anon,authenticated;
grant execute on function public.sq_submit_lead(uuid,text,text,text,text,jsonb,text,boolean,text) to service_role;
create function public.sq_review_lead(p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_status is null or p_status not in ('new','reviewed') then raise exception 'Invalid status' using errcode='22023';end if;
 update public.leads set status=p_status where id=p_id and (public.sq_staff_role()='owner' or (public.sq_staff_role()='practitioner' and assigned_to=auth.uid()));
 if not found then raise exception 'Staff access required' using errcode='42501';end if;
 insert into public.audit_events(actor_id,action) values(auth.uid(),'lead.'||p_status||':'||p_id::text);
end;$$;
revoke all on function public.sq_review_lead(uuid,text) from public,anon,authenticated;
grant execute on function public.sq_review_lead(uuid,text) to authenticated;
commit;
