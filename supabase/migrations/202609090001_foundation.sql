begin;
create table public.assessment_definitions (
 version text primary key, definition jsonb not null, created_at timestamptz not null default now()
);
create table public.staff_memberships (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','practitioner')), active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.assessments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 submission_id uuid not null, definition_version text not null references public.assessment_definitions(version),
 name text not null check(length(name) between 1 and 100), phone text not null default '',
 answers jsonb not null, scores jsonb not null, primary_profile text not null,
 consent_version text not null, consent_at timestamptz not null default now(),
 created_at timestamptz not null default now(), unique(user_id,submission_id)
);
create index assessments_owner_date on public.assessments(user_id,created_at desc);
create table public.assessment_reviews (
 assessment_id uuid primary key references public.assessments(id) on delete cascade,
 assigned_to uuid references public.staff_memberships(user_id), status text not null default 'new' check(status in ('new','reviewed')),
 updated_at timestamptz not null default now()
);
create table public.audit_events (
 id bigint generated always as identity primary key, actor_id uuid not null,
 assessment_id uuid references public.assessments(id) on delete set null,
 action text not null, created_at timestamptz not null default now()
);
alter table public.assessment_definitions enable row level security;
alter table public.staff_memberships enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_reviews enable row level security;
alter table public.audit_events enable row level security;

create function public.sq_staff_role() returns text language sql stable security definer set search_path='' as $$
 select role from public.staff_memberships where user_id=auth.uid() and active and auth.jwt()->>'aal'='aal2';
$$;
revoke all on function public.sq_staff_role() from public;
grant execute on function public.sq_staff_role() to authenticated;
create function public.sq_can_review(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(public.sq_staff_role()='owner' or (public.sq_staff_role()='practitioner' and exists(select 1 from public.assessment_reviews where assessment_id=target and assigned_to=auth.uid())),false);
$$;
revoke all on function public.sq_can_review(uuid) from public;
grant execute on function public.sq_can_review(uuid) to authenticated;

revoke all on public.assessment_definitions,public.staff_memberships,public.assessments,public.assessment_reviews,public.audit_events from anon,authenticated;
grant select on public.staff_memberships,public.assessments,public.assessment_reviews,public.audit_events to authenticated;
create policy membership_self on public.staff_memberships for select to authenticated using(user_id=auth.uid());
create policy assessment_read on public.assessments for select to authenticated using(user_id=auth.uid() or public.sq_can_review(id));
create policy review_read on public.assessment_reviews for select to authenticated using(public.sq_can_review(assessment_id));
create policy audit_owner on public.audit_events for select to authenticated using(public.sq_staff_role()='owner');

create function public.sq_submit_assessment(p_submission_id uuid,p_version text,p_name text,p_phone text,p_answers jsonb,p_consent text)
returns public.assessments language plpgsql security definer set search_path='' as $$
declare
 actor uuid := auth.uid(); definition jsonb; q jsonb; selected jsonb; choice jsonb; weight record; v integer;
 scores jsonb := '{"oil":0,"dehydration":0,"sensitivity":0,"sun":0}'; primary_name text; saved public.assessments;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then raise exception 'Verified sign in required' using errcode='42501'; end if;
 if p_submission_id is null or p_name is null or length(trim(p_name)) not between 1 and 100 or p_phone is null or (p_phone<>'' and p_phone !~ '^\+?[0-9]{10,15}$') or p_consent is distinct from '2026-09-09' then raise exception 'Invalid contact or consent' using errcode='22023'; end if;
 if p_version is distinct from '2026-09-09-v1' then raise exception 'Unsupported assessment version' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 if not exists(select 1 from public.assessments where user_id=actor and submission_id=p_submission_id) and (select count(*) from public.assessments where user_id=actor and created_at>now()-interval '1 day')>=100 then raise exception 'Daily submission limit' using errcode='54000'; end if;
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
 insert into public.assessments(user_id,submission_id,definition_version,name,phone,answers,scores,primary_profile,consent_version)
 values(actor,p_submission_id,p_version,trim(p_name),p_phone,p_answers,scores,primary_name,p_consent)
 on conflict(user_id,submission_id) do nothing returning * into saved;
 if saved.id is null then
   select * into saved from public.assessments where user_id=actor and submission_id=p_submission_id;
   if saved.answers<>p_answers or saved.name<>trim(p_name) or saved.phone<>p_phone or saved.definition_version<>p_version then raise exception 'Submission identifier reused with different answers' using errcode='22023'; end if;
 else
   insert into public.assessment_reviews(assessment_id) values(saved.id);
   insert into public.audit_events(actor_id,assessment_id,action) values(actor,saved.id,'assessment.submitted');
 end if;
 return saved;
end;
$$;
revoke all on function public.sq_submit_assessment(uuid,text,text,text,jsonb,text) from public;
grant execute on function public.sq_submit_assessment(uuid,text,text,text,jsonb,text) to authenticated;

create function public.sq_review_assessment(p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.sq_can_review(p_id) then raise exception 'Staff access required' using errcode='42501'; end if;
 if p_status not in ('new','reviewed') or p_status is null then raise exception 'Invalid status' using errcode='22023'; end if;
 update public.assessment_reviews set status=p_status,updated_at=now() where assessment_id=p_id;
 if not found then raise exception 'Assessment not found' using errcode='22023'; end if;
 insert into public.audit_events(actor_id,assessment_id,action) values(auth.uid(),p_id,'assessment.'||p_status);
end;$$;
revoke all on function public.sq_review_assessment(uuid,text) from public;
grant execute on function public.sq_review_assessment(uuid,text) to authenticated;
commit;
