import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('only verified owners can trash and restore a signup without changing payment history',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('test.aal',true))$$;
    grant usage on schema public,auth to authenticated,anon,service_role;`);
  for(const file of ['202609090001_foundation.sql','202609090002_definition.sql','202609090003_guest_leads.sql','202609090005_payment_records.sql','202609130007_customer_trash.sql']) await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
  const owner=crypto.randomUUID(), practitioner=crypto.randomUUID(), outsider=crypto.randomUUID(), sid=crypto.randomUUID();
  for(const id of [owner,practitioner,outsider]) await db.query('insert into auth.users values($1,now())',[id]);
  await db.query("insert into staff_memberships(user_id,role) values($1,'owner'),($2,'practitioner')",[owner,practitioner]);
  await db.query(`insert into leads(submission_id,definition_version,name,email,phone,answers,scores,primary_profile,consent_version,whatsapp_consent,contact_hash) values($1,'2026-09-09-v1','Synthetic QA','qa@example.com','+919999999999','{}','{}','oil','2026-09-09',false,'test')`,[sid]);
  await db.query(`insert into payment_records(submission_id,customer_name,email,phone,plan_type,plan,amount,status,razorpay_payment_id) values($1,'Synthetic QA','qa@example.com','+919999999999','plan','Plan',149900,'paid','pay_test')`,[sid]);
  async function act(id:string,aal:string){await db.exec('reset role');await db.query("select set_config('test.uid',$1,false),set_config('test.aal',$2,false)",[id,aal]);await db.exec('set role authenticated');}
  for(const [id,aal] of [[owner,'aal1'],[practitioner,'aal2'],[outsider,'aal2']]) {await act(id,aal);await assert.rejects(db.query('select sq_customer_trash($1,true)',[sid]));}
  await db.exec('reset role; set role anon');await assert.rejects(db.query('select sq_customer_trash($1,true)',[sid]));
  await act(owner,'aal2');
  await assert.rejects(db.query('select sq_customer_trash($1,true)',[crypto.randomUUID()]));
  await db.query('select sq_customer_trash($1,true)',[sid]);
  assert.equal((await db.query('select id from leads where deleted_at is null')).rows.length,0);
  assert.equal((await db.query('select id from payment_records where crm_deleted_at is null')).rows.length,0);
  assert.deepEqual((await db.query('select status,amount,razorpay_payment_id from payment_records')).rows,[{status:'paid',amount:149900,razorpay_payment_id:'pay_test'}]);
  await db.query('select sq_customer_trash($1,false)',[sid]);
  assert.equal((await db.query('select id from leads where deleted_at is null')).rows.length,1);
  assert.equal((await db.query('select id from payment_records where crm_deleted_at is null')).rows.length,1);
  await db.exec('reset role');
  assert.equal((await db.query("select * from audit_events where action like 'customer.%'")).rows.length,2);
 } finally {await db.close();}
});
