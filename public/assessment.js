
let submissionId = crypto.randomUUID();
let saving = false;


const questions = [
  { id:'skinFeel', kicker:'Your Skin', title:'How does your skin usually feel by midday?',
    hint:"Select all that apply. Choose what sounds like your skin.", multi:true, max:3,
    options:[
      {t1:'Oily or shiny, especially around the T-zone', t2:'Often feels oily', ic:'i-sparkle', w:{oil:3}},
      {t1:'Tight, dry, or flaky', t2:'Feels short on hydration', ic:'i-droplet-off', w:{dehydration:3}},
      {t1:'Oily in some areas, dry in others', t2:'Mixed / combination', ic:'i-half-circle', w:{oil:2,dehydration:1}},
      {t1:'Comfortable and balanced', t2:'Generally balanced', ic:'i-check-circle', w:{}},
    ]},
  { id:'topConcern', kicker:'Main Goal', title:"What are your main skin concerns right now?",
    hint:'Select all that apply. Choose up to 3 concerns.', multi:true, max:3,
    options:[
      {t1:'Active Acne, blackheads & clogged pores', t2:'', ic:'i-alert-triangle', w:{oil:2,sensitivity:1}},
      {t1:'Dark spots, acne marks & uneven tone', t2:'', ic:'i-target', w:{sun:2}},
      {t1:'Fine lines, wrinkles & loss of elasticity', t2:'', ic:'i-hourglass', w:{dehydration:1}},
      {t1:'Dullness & uneven texture', t2:'', ic:'i-cloud', w:{dehydration:2}},
      {t1:'Redness, stinging or easily irritated skin', t2:'', ic:'i-pulse', w:{sensitivity:3}},
    ]},
  { id:'secondary', kicker:'Anything Else?', title:'Does anything else sound familiar? (Choose up to 3)',
    hint:'Select all that apply · Up to 3. Choose anything else that sounds like your skin.', multi:true, max:3,
    options:[
      {t1:'My pores clog easily', t2:'', ic:'i-grid', w:{oil:1}},
      {t1:'I tan quickly in the sun', t2:'', ic:'i-sun-high', w:{sun:2}},
      {t1:'My skin feels dry even when it looks oily', t2:'', ic:'i-droplet', w:{dehydration:2}},
      {t1:'New products often irritate my skin', t2:'', ic:'i-alert-triangle', w:{sensitivity:2}},
      {t1:'None of these', t2:'', ic:'i-minus-circle', w:{}},
    ]},
  { id:'routine', kicker:'Your Current Routine', title:'How much skincare are you currently using?',
    hint:'Select all that apply. Choose the routine levels that describe you.', multi:true, max:3,
    options:[
      {t1:'Minimal: Water or basic cleanser only', t2:'', ic:'i-minus-circle', w:{sensitivity:1}},
      {t1:'Basics: Cleanser, moisturiser and sunscreen', t2:'', ic:'i-droplet', w:{}},
      {t1:'Intermediate: Basics + mild serums or gentle exfoliants', t2:'', ic:'i-flask', w:{}},
      {t1:'Advanced: Multi step routine with strong actives', t2:'', ic:'i-sparkle', w:{sensitivity:1}},
    ]},
  { id:'sun', kicker:'Sun Exposure', title:'How much time do you spend outdoors most days?',
    hint:'Think about your usual commute, errands and outdoor time.', multi:false,
    options:[
      {t1:'Mostly indoors', t2:'<30 minutes a day', ic:'i-home', w:{sun:0}},
      {t1:'Some outdoor time / daily commute', t2:'30–90 minutes a day', ic:'i-sun-low', w:{sun:2}},
      {t1:'A lot of outdoor time', t2:'2+ hours a day', ic:'i-sun-high', w:{sun:3}},
    ]},
  { id:'sensitivity', kicker:'Skin Sensitivity', title:'How does your skin react to new skincare?',
    hint:'Pick the closest match.', multi:false,
    options:[
      {t1:'Usually fine — rarely stings or turns red', t2:'', ic:'i-shield-check', w:{sensitivity:0}},
      {t1:'Mildly Sensitive - Sometimes stings feels warm or gets red', t2:'', ic:'i-shield-check', w:{sensitivity:2}},
      {t1:'Highly Sensitive — Often burns, stings, or becomes red and irritated when trying new products.', t2:'', ic:'i-alert-triangle', w:{sensitivity:3}},
    ]},
  { id:'budget', kicker:'Budget', title:'How much would you like to spend on skincare products?',
    hint:'Select all that apply. Choose up to 3 options.', multi:true, max:3,
    options:[
      {t1:'₹800 – ₹1,500', t2:'Simple, affordable options', ic:'₹', w:{}},
      {t1:'₹1,500 – ₹3,000', t2:'Targeted skincare', ic:'₹₹', w:{}},
      {t1:'₹3,000+', t2:'Premium / advanced skincare', ic:'₹₹₹', w:{}},
      {t1:"I'm not sure yet", t2:'', ic:'i-sparkle', w:{}},
    ]},
];

const ROUTINE_TEMPLATES = {
  oil: {
    title: "Oil-Balance Focus",
    desc: "Your answers suggest that <strong>oil control is one of your main priorities</strong>. The goal is to manage shine and clogged pores without making your skin feel stripped or uncomfortable.",
    amCleanser: "Salicylic Acid 1.5% + Zinc Amino Gel",
    activeTitle: "Niacinamide 5% + Zinc PCA 1%",
    activeDesc: "Contracts appearance of pores and reduces sebum lipid output.",
    sunscreen: "Ultra-Lightweight Matte Fluid SPF 50+ PA++++"
  },
  dehydration: {
    title: "Hydration Focus",
    desc: "Your answers suggest that <strong>hydration is one of your main priorities</strong>. Your routine should focus on keeping skin comfortable and supported rather than piling on more strong actives.",
    amCleanser: "Colloidal Oat & Amino Acid Gentle Foam",
    activeTitle: "Multi-Molecular Hyaluronic Acid + Ectoin 2%",
    activeDesc: "Injects deep hydration and binds water inside epidermal layers.",
    sunscreen: "Hydra-Gel Essence Sunscreen SPF 50 PA++++"
  },
  sensitivity: {
    title: "Sensitivity Focus",
    desc: "Your answers suggest that <strong>skin comfort and sensitivity are key priorities</strong>. A simpler, gentler routine may be a better starting point than adding lots of strong actives at once.",
    amCleanser: "Centella & Micro-Algae Non-Foaming Cleansing Milk",
    activeTitle: "Madecassoside 0.5% + Bifida Ferment Lysate",
    activeDesc: "Reinforces damaged tight junctions and calms histamine receptors.",
    sunscreen: "100% Non-Nano Mineral Physical Barrier SPF 50"
  },
  sun: {
    title: "Tone & Sun-Protection Focus",
    desc: "Your answers suggest that <strong>uneven tone and sun exposure are important priorities</strong>. Consistent sun protection and a targeted routine can help you work toward a more even-looking complexion.",
    amCleanser: "Antioxidant Green Tea Gentle Clarifier",
    activeTitle: "3-O-Ethyl Ascorbic Acid 10% + Ferulic Acid",
    activeDesc: "Neutralizes reactive oxygen species and blocks tyrosinase darkening.",
    sunscreen: "Broad-Spectrum PA++++ Hybrid Shield SPF 50+"
  }
};

let qIndex = 0;
let answers = {};
let scores = {oil:0, dehydration:0, sensitivity:0, sun:0};
let funShown = false;
let leadData = {name:'', email:'', phone:''};
let paymentState = null;

function goTo(id){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if(target) target.classList.add('active');

  const showMeter = (id === 'screen-question');
  document.getElementById('meterWrap').style.display = showMeter ? 'block' : 'none';
  window.scrollTo({top: 0, behavior: 'smooth'});
}

function startQuiz(){
  qIndex = 0;
  answers = {};
  scores = {oil:0, dehydration:0, sensitivity:0, sun:0};
  funShown = false;
  renderQuestion();
  goTo('screen-question');
}

function iconHtml(ic){
  if(ic && ic.startsWith('i-')){
    return `<span class="opt-ic-wrap"><svg class="icon"><use href="#${ic}"/></svg></span>`;
  }
  return `<span class="opt-ic-wrap opt-text-chip">${ic}</span>`;
}

function renderQuestion(){
  const q = questions[qIndex];
  document.getElementById('qKicker').textContent = q.kicker;
  document.getElementById('qTitle').textContent = q.title;
  document.getElementById('qHint').textContent = q.hint;
  document.getElementById('stepLabel').textContent = `Q${qIndex+1} / ${questions.length}`;

  const wrap = document.getElementById('qOptions');
  wrap.innerHTML = '';
  const selected = answers[q.id] || [];

  q.options.forEach((o, i)=>{
    const div = document.createElement('div');
    div.className = 'option' + (q.multi ? ' multi' : '') + (selected.includes(i) ? ' selected' : '');
    div.innerHTML = `${iconHtml(o.ic)}<div class="tx"><div class="t1">${o.t1}</div>${o.t2 ? `<div class="t2">${o.t2}</div>` : ''}</div><div class="ck"></div>`;
    div.setAttribute('role','checkbox'); div.setAttribute('aria-checked',String(selected.includes(i))); div.tabIndex=0; div.onclick = ()=> selectOption(q, i); div.onkeydown = e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();selectOption(q,i)}};
    wrap.appendChild(div);
  });
  updateNextBtn(q);
  updateMeter();
}

function selectOption(q, i){
  let sel = answers[q.id] || [];
  if(q.multi){
    // Q3 has a mutually-exclusive "None of these" option.
    const noneIndex = q.id === 'secondary' ? q.options.findIndex(o => o.t1 === 'None of these') : -1;
    if(i === noneIndex){
      sel = sel.includes(i) ? [] : [i];
    } else {
      if(noneIndex >= 0) sel = sel.filter(x => x !== noneIndex);
      if(sel.includes(i)){ sel = sel.filter(x => x !== i); }
      else{
        if(sel.length >= (q.max || 99)) return;
        sel.push(i);
      }
    }
  } else {
    sel = [i];
  }
  answers[q.id] = sel;
  renderQuestion();
}

function updateNextBtn(q){
  const sel = answers[q.id] || [];
  document.getElementById('qNextBtn').disabled = sel.length === 0;
}

function computeScores(){
  scores = {oil:0, dehydration:0, sensitivity:0, sun:0};
  questions.forEach(q=>{
    const sel = answers[q.id] || [];
    sel.forEach(i=>{
      const w = q.options[i].w || {};
      Object.keys(w).forEach(k => scores[k] += w[k]);
    });
  });
}

function updateMeter(){
  computeScores();
  const dims = ['oil','dehydration','sensitivity','sun'];
  const total = dims.reduce((s,k) => s + scores[k], 0) || 1;
  dims.forEach(k=>{
    document.getElementById('seg-'+k).style.width = ((scores[k]/total)*100) + '%';
  });
  const parts = dims.filter(k => scores[k] > 0).sort((a,b) => scores[b] - scores[a]).map(k => `${cap(k)} ${scores[k]}`);
  const eq = document.getElementById('equationLine');
  eq.innerHTML = parts.length ? `<span class="tag">Looking at:</span> ${parts.join(' · ')}` : `<span class="tag">building your ratio…</span>`;
}

function cap(s){ return {oil:'Sebum',dehydration:'Hydration',sensitivity:'Reactivity',sun:'Sun Exposure'}[s] || s; }

function nextQuestion(){
  qIndex++;
  if(qIndex === 4 && !funShown){
    funShown = true;
    goTo('screen-fun');
    return;
  }
  if(qIndex >= questions.length){
    runAnalyzing();
    return;
  }
  renderQuestion();
}

function afterFun(){
  renderQuestion();
  goTo('screen-question');
}

function prevQuestion(){
  if(qIndex === 0){ goTo('screen-hero'); return; }
  qIndex--;
  renderQuestion();
  goTo('screen-question');
}

function runAnalyzing(){
  goTo('screen-analyzing');
  const steps = document.querySelectorAll('.analyzing-step');
  const note = document.getElementById('skinNote');
  const noteTitle = document.getElementById('skinNoteTitle');
  const noteCopy = document.getElementById('skinNoteCopy');
  const noteSource = document.getElementById('skinNoteSource');
  steps.forEach(s => s.classList.remove('done'));

  const notes = [
    {title:'UV Index 3+? Protect your skin.', copy:'It is the UV Index — not just the temperature — that tells you when sun protection matters. WHO recommends protection when the UV Index reaches 3 or above.', source:'WHO · UV Index guidance'},
    {title:'“More skincare” is not always better.', copy:'Gentle, consistent routines often beat constantly adding products. Dermatologists warn that too much cleansing, scrubbing or switching treatments can irritate skin.', source:'American Academy of Dermatology'},
    {title:'Drinking more water is not a magic skin fix.', copy:'Staying hydrated is important, but evidence that simply increasing water intake dramatically improves skin is limited. Your skin barrier and routine matter too.', source:'PubMed systematic review'},
    {title:'Hot water can be rough on dry skin.', copy:'If your skin is dry or irritated, dermatologists recommend warm rather than hot water and moisturizing after washing.', source:'American Academy of Dermatology'}
  ];
  /* One Skin Note stays visible for the full analysis so it can be read. */
  if(note && notes.length){
    const n = notes[0];
    noteTitle.textContent = n.title;
    noteCopy.textContent = n.copy;
    noteSource.textContent = n.source;
  }
  let i = 0;
  const iv = setInterval(()=>{
    if(steps[i]) steps[i].classList.add('done');
    i++;
    if(i >= steps.length){
      clearInterval(iv);
      setTimeout(() => { goTo('screen-lead'); }, 850);
    }
  }, 1200);
}

function validateEmail(email){
  return String(email).toLowerCase().match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
}

let intakeStatus=null,widgetId=null;
const whatsappNumber='919995850411';

function ensureIndiaCountryCode(){
  const input = document.getElementById('leadPhone');
  if(!input) return;
  const raw = String(input.value || '').replace(/\D/g,'');
  const digits = raw.startsWith('91') ? raw.slice(2) : raw;
  const cleaned = digits.slice(0,10);
  const joined = cleaned.length ? `+91 ${cleaned}` : '+91 ';
  if(input.value !== joined) input.value = joined;
}

function getWhatsappUrl(message=''){
  const baseMessage=`Hi Skin Quotient, ${message}`.trim();
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(baseMessage)}`;
}

function updateResultWhatsappLinks(planType,customSuffix=''){
  const label = leadData.name ? `I’m ${leadData.name}.` : 'I’m interested in';
  const extra = customSuffix ? ` ${customSuffix}` : '';
  const planText = planType === 'plan'
    ? `${label} I would like to continue with the Personalized Skin Plan.${extra}`
    : `${label} I would like to continue with the 1:1 Skin Consultation.${extra}`;
  const href = getWhatsappUrl(planText);
  const planLink = document.getElementById('planWhatsappLink');
  const callLink = document.getElementById('callWhatsappLink');
  if(planLink) planLink.href = href;
  if(callLink) callLink.href = href;
}

async function prepareIntake(){
 try{const response=await fetch('/api/leads',{cache:'no-store'});intakeStatus=await response.json();paymentState=intakeStatus; if(intakeStatus.enabled&&window.turnstile&&widgetId===null&&document.getElementById('screen-lead').classList.contains('active'))widgetId=turnstile.render('#verification',{sitekey:intakeStatus.siteKey,action:'assessment'});if(!intakeStatus.enabled)document.getElementById('saveNotice').textContent='Online saving is being connected. You can contact us on WhatsApp.';}catch{document.getElementById('saveNotice').textContent='Unable to connect. Please try again.';}
}
window.addEventListener('load',()=>{
  const leadPhone = document.getElementById('leadPhone');
  if(leadPhone && !leadPhone.value) leadPhone.value = '+91 ';
  ensureIndiaCountryCode();
  leadPhone?.addEventListener('input', ensureIndiaCountryCode);
  leadPhone?.addEventListener('blur', ensureIndiaCountryCode);
  updateResultWhatsappLinks('plan');
  prepareIntake();
});

function normalizePhone(value){
  const clean = String(value || '').replace(/[\s()-]/g,'');
  if(/^[6-9][0-9]{9}$/.test(clean)) return '+91'+clean;
  if(/^\+[1-9][0-9]{9,14}$/.test(clean)) return clean;
  if(clean.startsWith('+91')&&clean.length===13) return clean;
  return clean.startsWith('+') ? clean : '+91'+clean.replace(/^\+/, '');
}

async function startPayment(planType){
  const targetScreen = planType === 'consultation' ? 'screen-confirm-call' : 'screen-confirm-plan';
  const titleEl = planType === 'consultation' ? document.getElementById('callResultTitle') : document.getElementById('planResultTitle');
  const messageEl = planType === 'consultation' ? document.getElementById('callResultMessage') : document.getElementById('planResultMessage');
  if(paymentState?.paymentsEnabled === false){
    if(titleEl) titleEl.textContent='Payment not available';
    if(messageEl) messageEl.textContent='Online checkout is still being connected. Ask us on WhatsApp and we’ll continue from there.';
    updateResultWhatsappLinks(planType);goTo(targetScreen);return;
  }
  if(typeof window.Razorpay !== 'function'){
    if(titleEl) titleEl.textContent='Checkout unavailable';
    if(messageEl) messageEl.textContent='Checkout script could not be loaded. Ask us on WhatsApp and we’ll continue from there.';
    updateResultWhatsappLinks(planType);goTo(targetScreen);return;
  }
  try{
    updateResultWhatsappLinks(planType,'Preparing your secure payment link...');
    const response = await fetch('/api/payments/order',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({plan:planType,name:leadData.name,email:leadData.email,phone:leadData.phone,submissionId})
    });
    const data = await response.json();
    if(!response.ok || !data.orderId) throw new Error(data.error || 'Unable to start payment.');

    const options = {
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      name: data.name,
      description: data.description,
      order_id: data.orderId,
      handler: async function(payment){
        const verifyRes = await fetch('/api/payments/verify',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({plan:planType,razorpay_order_id:payment.razorpay_order_id,razorpay_payment_id:payment.razorpay_payment_id,razorpay_signature:payment.razorpay_signature})
        });
        const verifyData = await verifyRes.json();
        if(!verifyRes.ok || !verifyData.ok) throw new Error(verifyData.error || 'Payment could not be confirmed.');
        if(titleEl) titleEl.textContent = planType==='plan' ? 'Skin Plan paid' : 'Consultation paid';
        if(messageEl) messageEl.textContent = planType==='plan' ? 'Payment confirmed. Please continue with WhatsApp so our team can start your onboarding now.' : 'Payment confirmed. Please continue with WhatsApp so our team can schedule your consultation now.';
        updateResultWhatsappLinks(planType,'My payment is done.');
        goTo(targetScreen);
      },
      prefill:{name:leadData.name, email:leadData.email, contact:(leadData.phone||'').replace('+','')},
      theme:{color:'#6A57C3'}
    };
    new window.Razorpay(options).open();
  }catch(error){
    const details = error instanceof Error ? error.message : 'Could not launch payment.';
    if(titleEl && !titleEl.textContent) titleEl.textContent='Checkout not started';
    if(messageEl) messageEl.textContent=details;
    updateResultWhatsappLinks(planType,'Please continue via WhatsApp while we check this.');
    goTo(targetScreen);
  }
}
async function submitLead(){
 if(saving)return;const notice=document.getElementById('saveNotice');
 const name=document.getElementById('leadName').value.trim();const email=document.getElementById('leadEmail').value.trim().toLowerCase();
 let phone=normalizePhone(document.getElementById('leadPhone').value);
 if(!phone||phone==='+91'){notice.textContent='Enter your WhatsApp number with +91.';return;}
 if(!name||name.length>100||!validateEmail(email)||!/^\+[1-9][0-9]{9,14}$/.test(phone)){notice.textContent='Enter your name, a valid email, and your WhatsApp number with country code.';return;}
 if(!document.getElementById('privacyConsent').checked){notice.textContent='Please read the privacy notice and consent to saving your answers.';return;}
 if(!intakeStatus?.enabled){notice.textContent='Online saving is being connected. Please contact us on WhatsApp.';return;}
 const turnstileToken=widgetId!==null&&window.turnstile?turnstile.getResponse(widgetId):'';if(!turnstileToken){notice.textContent='Please complete the verification.';return;}
 saving=true;document.getElementById('submitLeadBtn').disabled=true;notice.textContent='Saving your assessment…';
  try{const response=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({submissionId,version:'2026-09-09-v1',name,email,phone,answers,consentVersion:'2026-09-09',whatsappConsent:document.getElementById('whatsappConsent').checked,website:document.getElementById('leadWebsite').value,turnstileToken})});const result=await response.json();if(!response.ok||!result.saved)throw new Error(result.error||'Your submission could not be confirmed. Please retry.');leadData={name,email,phone};updateResultWhatsappLinks('plan',`Thanks for completing your assessment.`);showResult();}
 catch(error){notice.textContent=error.message||'Unable to connect. Please retry.';}
 finally{saving=false;document.getElementById('submitLeadBtn').disabled=false;if(widgetId!==null)turnstile.reset(widgetId);}
}

function buildDonut(){
  const dims = ['oil','dehydration','sensitivity','sun'];
  const colors = {oil:'#FFB020', dehydration:'#F0347D', sensitivity:'#0FA968', sun:'#B2A2FF'};
  const names = {oil:'Sebum Level',dehydration:'Hydration',sensitivity:'Reactivity',sun:'Sun Exposure'};
  const active = dims.filter(k => scores[k] > 0).sort((a,b) => scores[b] - scores[a]);
  const list = active.length ? active : ['oil'];
  const total = list.reduce((s,k) => s + (scores[k] || 1), 0) || 1;
  const r = 44, circ = 2 * Math.PI * r;
  let offset = 0, segs = '';

  list.forEach(k=>{
    const val = scores[k] || 1;
    const frac = val / total;
    const len = frac * circ - 2;
    segs += `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${colors[k]}" stroke-width="12" stroke-dasharray="${len} ${circ-len}" stroke-dashoffset="${-offset}" stroke-linecap="round" transform="rotate(-90 50 50)"/>`;
    offset += frac * circ;
  });

  document.getElementById('donutWrap').innerHTML = `<svg width="100" height="100" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--paper-deep)" stroke-width="12"/>
    ${segs}
  </svg>`;

  document.getElementById('legendWrap').innerHTML = list.map(k=>{
    const pct = Math.round(((scores[k] || 1) / total) * 100);
    return `<div class="legend-row"><span class="legend-dot" style="background:${colors[k]}"></span><span class="legend-label">${names[k]}</span><span class="legend-pct">${pct}%</span></div>`;
  }).join('');
}

function showResult(){
  computeScores();
  buildDonut();

  const dims = ['oil','dehydration','sensitivity','sun'];
  const sorted = dims.filter(k => scores[k] > 0).sort((a,b) => scores[b] - scores[a]);
  const primary = sorted[0] || 'oil';
  const template = ROUTINE_TEMPLATES[primary] || ROUTINE_TEMPLATES.oil;

  if(leadData.name){
    document.getElementById('userBadgeGreeting').textContent = `${leadData.name}'s Skin Quotient`;
  }
  if(leadData.email){
    document.getElementById('reportDeliveryTarget').textContent = 'Assessment saved';
  }

  document.getElementById('resultDesc').innerHTML = template.desc;

  const routineHtml = `
    <div class="routine-step">
      <div class="routine-num">1</div>
      <div>
        <div class="t1">${template.amCleanser}</div>
        <div class="t2">A gentle first step that cleans without leaving skin feeling tight.</div>
      </div>
    </div>
    <div class="routine-step blurred">
      <div class="routine-num">2</div>
      <div>
        <div class="t1">${template.activeTitle}</div>
        <div class="t2">${template.activeDesc}</div>
      </div>
      <span class="blur-tag">Full plan</span>
    </div>
    <div class="routine-step final-step">
      <div class="routine-num">3</div>
      <div>
        <div class="t1">${template.sunscreen}</div>
        <div class="t2">Daily sun protection chosen to fit your skin profile.</div>
      </div>
    </div>
  `;

  document.getElementById('routineList').innerHTML = routineHtml;
  goTo('screen-result');
  spawnConfetti();
}

function spawnConfetti(){
  const layer = document.getElementById('confettiLayer');
  const colors = ['#0FA968','#FF6FA5','#FFB020','#17C77D','#F0347D','#B2A2FF'];
  for(let i=0; i<32; i++){
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    const size = 6 + Math.random() * 6;
    el.style.left = (Math.random() * 100) + 'vw';
    el.style.width = size + 'px';
    el.style.height = (size * 0.45) + 'px';
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.animationDuration = (1.5 + Math.random() * 1.2) + 's';
    el.style.animationDelay = (Math.random() * 0.25) + 's';
    layer.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }
}

function resetProto(){
  if(saving)return;
  submissionId=crypto.randomUUID();
  document.getElementById('privacyConsent').checked=false;document.getElementById('whatsappConsent').checked=false;
  document.getElementById('saveNotice').textContent='';
  qIndex = 0; answers = {}; funShown = false;
  leadData = {name:'', email:'', phone:''};
  document.getElementById('leadName').value = '';
  document.getElementById('leadEmail').value = '';
  document.getElementById('leadPhone').value = '+91 ';
  goTo('screen-hero');
}

const actionHandlers=[function(event){resetProto()},function(event){startQuiz()},function(event){goTo('screen-result-direct')},function(event){prevQuestion()},function(event){nextQuestion()},function(event){afterFun()},function(event){submitLead()},function(event){startPayment('plan')},function(event){startPayment('consultation')},function(event){resetProto()}];
const safeActivate=(el)=>{const handler=actionHandlers[Number(el.dataset.action)];if(typeof handler==='function') handler({target:el});};
document.querySelectorAll('[data-action]').forEach(el=>{
  el.addEventListener('click', (event)=>{event.preventDefault(); safeActivate(el);});
  el.addEventListener('keydown', (event)=>{
    if(event.key === 'Enter' || event.key === ' '){
      event.preventDefault();
      safeActivate(el);
    }
  });
});
document.querySelectorAll('[data-action]').forEach(el=>{if(!el.hasAttribute('role'))el.setAttribute('role','button');if(!el.hasAttribute('tabindex'))el.setAttribute('tabindex','0');});
document.querySelector('[data-return]')?.addEventListener('click',()=>goTo('screen-result'));
const originalGoTo=goTo;goTo=function(id){document.body.classList.toggle('home-mode',id==='screen-hero');originalGoTo(id);if(id==='screen-lead')prepareIntake()};document.body.classList.add('home-mode');
