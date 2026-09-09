
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

async function submitLead(){
 if(saving)return;
 const notice=document.getElementById('saveNotice');
 const name=document.getElementById('leadName').value.trim();
 const email=document.getElementById('leadEmail').value.trim().toLowerCase();
 const phone=document.getElementById('leadPhone').value.replace(/[\s()-]/g,'');
 notice.textContent='';
 if(!name||name.length>100||!validateEmail(email)||!/^$|^\+?[0-9]{10,15}$/.test(phone)){notice.textContent='Enter your name, signed-in email, and a valid phone number if provided.';return;}
 if(!document.getElementById('privacyConsent').checked){notice.textContent='Please read the privacy notice and consent to saving your answers.';return;}
 saving=true;document.getElementById('submitLeadBtn').disabled=true;
 try{
  const session=await fetch('/api/me',{cache:'no-store'});const user=await session.json();
  if(!session.ok)throw new Error(user.error||'Sign in before saving your assessment.');
  if(user.email.toLowerCase()!==email)throw new Error('Use the email address you signed in with.');
  const response=await fetch('/api/assessments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({submissionId,version:'2026-09-09-v1',name,phone,answers,consentVersion:'2026-09-09'})});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Your assessment could not be saved. Please retry.');
  leadData={name,email,phone};showResult();
 }catch(error){notice.textContent=error.message||'Unable to connect. Your assessment has not been confirmed saved. Please retry.';}
 finally{saving=false;document.getElementById('submitLeadBtn').disabled=false;}
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
    document.getElementById('reportDeliveryTarget').textContent = 'Saved to your account';
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
    <div class="routine-step">
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
  document.getElementById('privacyConsent').checked=false;
  document.getElementById('saveNotice').textContent='';
  qIndex = 0; answers = {}; funShown = false;
  leadData = {name:'', email:'', phone:''};
  document.getElementById('leadName').value = '';
  document.getElementById('leadEmail').value = '';
  document.getElementById('leadPhone').value = '';
  goTo('screen-hero');
}

const actionHandlers=[function(event){resetProto()},function(event){startQuiz()},function(event){goTo('screen-result-direct')},function(event){prevQuestion()},function(event){nextQuestion()},function(event){afterFun()},function(event){submitLead()},function(event){goTo('screen-confirm-plan')},function(event){goTo('screen-confirm-call')},function(event){resetProto()}];
document.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',actionHandlers[Number(el.dataset.action)]));
document.querySelector('[data-return]')?.addEventListener('click',()=>goTo('screen-result'));
const originalGoTo=goTo;goTo=function(id){document.body.classList.toggle('home-mode',id==='screen-hero');originalGoTo(id)};document.body.classList.add('home-mode');
