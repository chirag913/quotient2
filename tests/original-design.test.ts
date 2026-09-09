import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('the original transparent portrait and policy designs are preserved',()=>{
 const original=readFileSync('index.html','utf8');const encoded=original.match(/data:image\/png;base64,([^"']+)/)![1];
 assert.deepEqual(readFileSync('public/skin-portrait.png'),Buffer.from(encoded,'base64'));
 for(const file of ['about.html','contact.html','privacy-policy.html','terms.html','refund-cancellation.html','shipping-policy.html'])assert.equal(readFileSync('public/'+file,'utf8'),readFileSync(file,'utf8'));
 const page=readFileSync('public/assessment.html','utf8');assert.ok(page.includes('body:not(.home-mode) .home-benefits, body:not(.home-mode) .home-foot{display:none;}'));
 assert.ok(!page.includes('>Staff login</a>'));assert.ok(!page.includes('Open sign in'));
});
