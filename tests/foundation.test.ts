import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {scoreAnswers,definition,assessmentInput} from '../src/lib/assessment';
import {trustedOrigin,mutationAllowed} from '../src/lib/security';
const answers=Object.fromEntries(definition.questions.map(q=>[q.id,[0]]));
test('score validation rejects missing, extra, conflicting and forged selections',()=>{
 assert.deepEqual(scoreAnswers(answers),{scores:{oil:6,dehydration:0,sensitivity:2,sun:0},primary:'oil'});
 for(const invalid of [{},{...answers,extra:[0]},{...answers,sun:[0,1]},{...answers,secondary:[0,4]},{...answers,budget:[99]},{...answers,budget:[0,0]}])assert.throws(()=>scoreAnswers(invalid));
 assert.equal(assessmentInput.safeParse({submissionId:crypto.randomUUID(),version:definition.version,name:'Test',phone:'',answers,consentVersion:'2026-09-09',scores:{oil:999}}).success,false);
});
test('mutations require the configured origin and JSON',()=>{
 assert.equal(trustedOrigin({APP_ORIGIN:'https://www.skinquotient.in'}),'https://www.skinquotient.in');
 for(const url of ['https://evil.test/path','ftp://localhost','http://evil.test','https://user:pass@example.com'])assert.throws(()=>trustedOrigin({APP_ORIGIN:url}));
 assert.equal(mutationAllowed(new Request('https://site.test/api',{headers:{origin:'https://evil.test','content-type':'application/json'}}),'https://site.test'),false);
 assert.equal(mutationAllowed(new Request('https://site.test/api',{headers:{origin:'https://site.test','content-type':'application/json'}}),'https://site.test'),true);
});
test('PostgreSQL enforces ownership, verification, idempotency and staff MFA',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$; create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('test.aal',true))$$; grant usage on schema public,auth to authenticated,anon;`);
 await db.exec(readFileSync('supabase/migrations/202609090001_foundation.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/202609090002_definition.sql','utf8'));
 const alice=crypto.randomUUID(),bob=crypto.randomUUID(),owner=crypto.randomUUID(),practitioner=crypto.randomUUID(),unverified=crypto.randomUUID(),submission=crypto.randomUUID();
 for(const id of [alice,bob,owner,practitioner])await db.query('insert into auth.users values($1,now())',[id]);
 await db.query('insert into auth.users values($1,null)',[unverified]);
 await db.query("insert into public.staff_memberships(user_id,role) values($1,'owner'),($2,'practitioner')",[owner,practitioner]);
 async function act(id:string,aal='aal1'){await db.exec('reset role');await db.query("select set_config('test.uid',$1,false),set_config('test.aal',$2,false)",[id,aal]);await db.exec('set role authenticated')}
 async function submit(value=answers,sid=submission){return db.query<{id:string;scores:unknown}>('select id,scores from public.sq_submit_assessment($1,$2,$3,$4,$5,$6)',[sid,definition.version,'Synthetic test','',JSON.stringify(value),'2026-09-09'])}
 await act(alice);const first=await submit();assert.deepEqual(first.rows[0].scores,scoreAnswers(answers).scores);assert.equal((await submit()).rows[0].id,first.rows[0].id);
 await assert.rejects(submit({...answers,sun:[2]}));await assert.rejects(submit({...answers,secondary:[0,4]},crypto.randomUUID()));
 await assert.rejects(db.exec("update public.assessments set name='forged'"));await assert.rejects(db.query("insert into public.staff_memberships(user_id,role) values($1,'owner')",[alice]));
 await act(bob);assert.equal((await db.query('select * from public.assessments')).rows.length,0);await assert.rejects(db.query("select public.sq_review_assessment($1,'reviewed')",[first.rows[0].id]));
 await act(unverified);await assert.rejects(submit(answers,crypto.randomUUID()));
 await act(owner);assert.equal((await db.query('select * from public.assessments')).rows.length,0);
 await act(owner,'aal2');assert.equal((await db.query('select * from public.assessments')).rows.length,1);await db.query("select public.sq_review_assessment($1,'reviewed')",[first.rows[0].id]);
 await act(practitioner,'aal2');assert.equal((await db.query('select * from public.assessments')).rows.length,0);
 await db.exec('reset role');await db.query('update public.assessment_reviews set assigned_to=$1 where assessment_id=$2',[practitioner,first.rows[0].id]);
 await act(practitioner,'aal2');assert.equal((await db.query('select * from public.assessments')).rows.length,1);
 await db.exec('reset role');await db.query('update public.staff_memberships set active=false where user_id=$1',[practitioner]);
 await act(practitioner,'aal2');assert.equal((await db.query('select * from public.assessments')).rows.length,0);
 await db.exec('reset role; set role anon');await assert.rejects(db.exec('select * from public.assessments'));await assert.rejects(submit());
 }finally{await db.close()}
});
