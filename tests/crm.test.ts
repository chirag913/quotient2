import {test} from 'node:test';
import assert from 'node:assert/strict';
import {csvCell,indiaDays} from '../src/lib/crm';
test('CRM exports quote fields and neutralize spreadsheet formulas',()=>{
 assert.equal(csvCell('A,"B"'),'"A,""B"""');
 for(const value of ['=1+1','+919999999999','@SUM(A1)','  -2'])assert.ok(csvCell(value).startsWith('"\''));
 assert.equal(csvCell('person@example.com'),'"person@example.com"');
});
test('CRM daily totals use complete India calendar days across UTC boundary',()=>{
 const days=indiaDays(new Date('2026-09-09T20:00:00Z'));
 assert.equal(days.length,7);assert.equal(days[6].start,'2026-09-09T18:30:00.000Z');
 assert.equal(days[6].end,'2026-09-10T18:30:00.000Z');
 assert.equal(days[6].label,'Thu');
 for(let i=1;i<7;i++)assert.equal(days[i-1].end,days[i].start);
});
