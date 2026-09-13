import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import {leadInput} from '../src/lib/leads';
import {definition} from '../src/lib/assessment';

test('India phone normalization rejects wrong country codes and wrong lengths',()=>{
  const source=readFileSync('public/assessment.js','utf8');
  const fn=source.slice(source.indexOf('function normalizePhone('),source.indexOf('async function startPayment('));
  const normalize=runInNewContext(`${fn}; normalizePhone`);
  for(const value of ['9999999999','+919999999999','+91 99999 99999']) assert.equal(normalize(value),'+919999999999');
  for(const value of ['', '999999999','99999999999','+12025550100','+929999999999','99999x99999']) assert.equal(normalize(value),'');
  const value={submissionId:crypto.randomUUID(),version:definition.version,name:'QA Test',email:'qa@example.com',phone:'+919999999999',answers:{},consentVersion:'2026-09-09',whatsappConsent:false,turnstileToken:'test',website:''};
  assert.equal(leadInput.safeParse(value).success,true);
  for(const phone of ['9999999999','+91999999999','+9199999999999','+12025550100']) assert.equal(leadInput.safeParse({...value,phone}).success,false);
});

test('payment migrations support backend checkout storage without exposing webhook payloads',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      grant usage on schema public to anon,authenticated,service_role;
      create table public.leads(id uuid primary key);
      create function public.sq_staff_role() returns text language sql stable as $$select null::text$$;`);
    for(const file of ['202609090004_payment_events.sql','202609090005_payment_records.sql','202609130006_payment_service_access.sql']) await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
    await db.exec('set role service_role');
    const sid=crypto.randomUUID();
    for(const plan of ['plan','consultation']) {
      await db.query(`insert into payment_records(submission_id,customer_name,email,phone,plan_type,plan,amount,razorpay_order_id,razorpay_subscription_id) values($1,'QA Test','qa@example.com','+919999999999',$2,$2,$3,$4,$5)`,[sid,plan,plan==='plan'?149900:99900,plan==='consultation'?'order_test':null,plan==='plan'?'sub_test':null]);
      const result=await db.query(`select razorpay_order_id,razorpay_subscription_id from payment_records where submission_id=$1 and plan_type=$2 and status='pending' order by created_at desc limit 1`,[sid,plan]);
      assert.equal(result.rows.length,1);
    }
    await db.exec(`insert into payment_events(provider_event_id,provider_event,raw) values('evt_test','payment.captured','{}'); update payment_records set status='paid' where razorpay_order_id='order_test';`);
    for(const role of ['anon','authenticated']) {
      await db.exec(`reset role; set role ${role}`);
      await assert.rejects(db.exec('select raw from payment_events'));
    }
  } finally {await db.close();}
});
