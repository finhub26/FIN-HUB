/* ===== supabase-sync.js ===== */
/* Supabase Cloud Sync for FinHub
   URL: https://uvfeswirizqaidzlnjcs.supabase.co
   Transactions sync across all devices per user_id
*/
(function(){
  const SB_URL = 'https://uvfeswirizqaidzlnjcs.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2ZmVzd2lyaXpxYWlkemxuamNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NTc1NjQsImV4cCI6MjEwNjMzMzU2NH0.jG1XMaeinSpfO_Vdt11zZNLX9mIGn6hMQ9bZGnDb9r0';
  const HEADERS = {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
    'Prefer': 'return=minimal'
  };

  // ── Fetch all transactions from Supabase for a user ──
  async function sbLoadTransactions(uid) {
    try {
      const res = await fetch(
        SB_URL + '/rest/v1/transactions?user_id=eq.' + encodeURIComponent(uid) + '&order=date.asc',
        { method: 'GET', headers: { ...HEADERS, 'Prefer': 'return=representation' } }
      );
      if (!res.ok) return null;
      const rows = await res.json();
      return rows.map(r => ({
        id: String(r.id),
        date: r.date,
        desc: r.description || '',
        description: r.description || '',
        category: r.category || '',
        note: r.note || '',
        amount: parseFloat(r.amount) || 0
      }));
    } catch(e) {
      console.warn('FinHub Supabase load error:', e);
      return null;
    }
  }

  // ── Save a single transaction to Supabase ──
  async function sbSaveTransaction(uid, tx) {
    try {
      const body = JSON.stringify({
        user_id: uid,
        description: tx.desc || tx.description || '',
        amount: parseFloat(tx.amount) || 0,
        category: tx.category || '',
        date: tx.date,
        note: tx.note || '',
        type: tx.amount > 0 ? 'income' : 'expense'
      });
      const res = await fetch(SB_URL + '/rest/v1/transactions', {
        method: 'POST',
        headers: HEADERS,
        body
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error('FinHub Supabase save error:', res.status, errText);
        return false;
      }
      return true;
    } catch(e) {
      console.warn('FinHub Supabase save error:', e);
      return false;
    }
  }

  // ── Delete a transaction from Supabase by matching user_id + desc + date + amount ──
  async function sbDeleteTransaction(uid, tx) {
    try {
      const res = await fetch(
        SB_URL + '/rest/v1/transactions?user_id=eq.' + encodeURIComponent(uid) +
        '&description=eq.' + encodeURIComponent(tx.desc) +
        '&date=eq.' + encodeURIComponent(tx.date) +
        '&amount=eq.' + encodeURIComponent(tx.amount),
        { method: 'DELETE', headers: HEADERS }
      );
      return res.ok;
    } catch(e) {
      console.warn('FinHub Supabase delete error:', e);
      return false;
    }
  }

  // ── Full sync: push all local transactions to Supabase ──
  async function sbFullSync(uid, localTransactions) {
    try {
      // Delete all existing rows for this user
      await fetch(
        SB_URL + '/rest/v1/transactions?user_id=eq.' + encodeURIComponent(uid),
        { method: 'DELETE', headers: HEADERS }
      );
      // Re-insert all
      if (!localTransactions.length) return true;
      const rows = localTransactions.map(tx => ({
        user_id: uid,
        description: tx.desc || tx.description || '',
        amount: parseFloat(tx.amount) || 0,
        category: tx.category || '',
        date: tx.date,
        note: tx.note || '',
        type: tx.amount > 0 ? 'income' : 'expense'
      }));
      const res = await fetch(SB_URL + '/rest/v1/transactions', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(rows)
      });
      if (!res.ok) {
        const err = await res.text();
        console.error('FinHub Supabase insert error:', res.status, err);
        return false;
      }
      console.log('FinHub: Synced', rows.length, 'rows to Supabase ☁️');
      return true;
    } catch(e) {
      console.warn('FinHub Supabase full sync error:', e);
      return false;
    }
  }

  // ── Save user hash+profile to Supabase users table ──
  async function sbSaveUser(uid, passhash, profile) {
    try {
      const body = JSON.stringify({
        user_id: uid,
        passhash: passhash,
        name: (profile && profile.name) || '',
        email: (profile && profile.email) || '',
        phone: (profile && profile.phone) || ''
      });
      // Upsert: insert or update if already exists
      const res = await fetch(SB_URL + '/rest/v1/users', {
        method: 'POST',
        headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body
      });
      return res.ok;
    } catch(e) {
      console.warn('FinHub Supabase saveUser error:', e);
      return false;
    }
  }

  // ── Load user hash+profile from Supabase ──
  async function sbLoadUser(uid) {
    try {
      const res = await fetch(
        SB_URL + '/rest/v1/users?user_id=eq.' + encodeURIComponent(uid) + '&limit=1',
        { method: 'GET', headers: { ...HEADERS, 'Prefer': 'return=representation' } }
      );
      if (!res.ok) return null;
      const rows = await res.json();
      if (!rows || !rows.length) return null;
      return rows[0]; // { user_id, passhash, name, email, phone }
    } catch(e) {
      console.warn('FinHub Supabase loadUser error:', e);
      return null;
    }
  }

  // Expose on window so app.js functions can call them
  window._sb = {
    load: sbLoadTransactions,
    save: sbSaveTransaction,
    delete: sbDeleteTransaction,
    fullSync: sbFullSync,
    saveUser: sbSaveUser,
    loadUser: sbLoadUser
  };
})();
/* ===== lang-page.js ===== */
// Standalone lang page open/close — zero dependencies, runs immediately
function _openLangPage() {
  var p = document.getElementById('langSettingsPage');
  if (!p) return;
  var cur = window._finhubLang || (function(){ try{ return localStorage.getItem('finhub_lang'); }catch(e){ return null; } })() || 'en';
  document.querySelectorAll('.lang-page-btn').forEach(function(b){ b.classList.toggle('active', b.dataset.lang === cur); });
  p.classList.add('visible');
  p.scrollTop = 0;
}
function _closeLangPage() {
  var p = document.getElementById('langSettingsPage');
  if (p) p.classList.remove('visible');
}
function _selectLang(lang) {
  // Save immediately so renderAll picks it up
  try { localStorage.setItem('finhub_lang', lang); } catch(e) {}
  window._finhubLang = lang;
  // Update button states immediately
  document.querySelectorAll('.lang-page-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.lang === lang);
  });
  document.querySelectorAll('.lang-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.lang === lang);
  });

  // Update label
  var names = {en:'English',hi:'हिंदी',ta:'தமிழ்',te:'తెలుగు',ml:'മലയാളം',kn:'ಕನ್ನಡ'};
  var lbl = document.getElementById('ppCurrentLangLabel');
  if (lbl) lbl.textContent = names[lang] || lang;

  // Close page and apply translation with proper timing
  setTimeout(function() {
    _closeLangPage();

  // Apply translation via i18n system
      if (window.finhubI18n && window.finhubI18n.apply) {
        window.finhubI18n.apply(lang);
        // Re-apply after delay to catch async-rendered content
        setTimeout(function(){ window.finhubI18n.apply(lang); }, 150);
        setTimeout(function(){ window.finhubI18n.apply(lang); }, 300);
      }

      // Show dashboard
      if (typeof window.switchView === 'function') {
        window.switchView('dashboard');
      } else {
        var view = document.getElementById('view-dashboard');
        if (view) view.classList.remove('hidden');
      }

      // Update greeting with new language
      if (typeof updateHeaderGreeting === 'function') {
        try { updateHeaderGreeting(); } catch(e) {}
      }

    // Toast
    if (window.showToast) window.showToast('Language changed ✓', 'success');
  }, 100);
}
window._openLangPage = _openLangPage;
window._closeLangPage = _closeLangPage;
window._selectLang = _selectLang;
document.addEventListener('DOMContentLoaded', function() {
  var ob = document.getElementById('ppOpenLangPage');
  if (ob) ob.addEventListener('click', _openLangPage);
  var cb = document.getElementById('langPageBackBtn');
  if (cb) cb.addEventListener('click', _closeLangPage);
});

/* ===== app.js ===== */
// ════════════════════════════════════════
//  PROFILE PAGE
// ════════════════════════════════════════
(function(){
  function $id(id){ return document.getElementById(id); }
  function fmtBytes(b){ if(b<1024) return b+'B'; if(b<1048576) return (b/1024).toFixed(1)+'KB'; return (b/1048576).toFixed(2)+'MB'; }

  function openProfilePage(){
    $id('appShell').classList.add('hidden');
    $id('graphSheetPage').classList.remove('visible');
    $id('profilePage').classList.add('visible');
    populateProfile();
  }
  function closeProfilePage(){
    $id('profilePage').classList.remove('visible');
    $id('appShell').classList.remove('hidden');
  }

  function populateProfile(){
    // Read uid from all possible sources
    const uid = (typeof currentUserId !== 'undefined' && currentUserId)
      || window.currentUserId
      || window._currentUserId
      || '—';

    if(!uid || uid === '—') return;

    // Load saved profile
    const profRaw = localStorage.getItem(`tally:user:${uid}:profile`);
    const prof = profRaw ? JSON.parse(profRaw) : {};
    const displayName = prof.name || uid;
    const initial = displayName[0].toUpperCase();

    // Avatar & name
    const av = $id('ppBigAvatar'); if(av) av.textContent = initial;
    if($id('ppDisplayName')) $id('ppDisplayName').textContent = displayName;
    if($id('ppUsernameTag')) $id('ppUsernameTag').textContent = `@${uid}`;
    if($id('ppUserIdText')) $id('ppUserIdText').textContent = uid;
    if($id('ppModalUsername')) $id('ppModalUsername').textContent = uid;

    // Contact pills in avatar card
    const ed = $id('ppEmailDisplay'), pt = $id('ppPhoneDisplay');
    if(ed) ed.style.display = prof.email ? 'inline-flex' : 'none';
    const et = $id('ppEmailText'); if(et) et.textContent = prof.email || '';
    if(pt) pt.style.display = prof.phone ? 'inline-flex' : 'none';
    const pht = $id('ppPhoneText'); if(pht) pht.textContent = prof.phone || '';

    // Info rows
    if($id('ppEmailRow')) $id('ppEmailRow').textContent = prof.email || '—';
    if($id('ppPhoneRow')) $id('ppPhoneRow').textContent = prof.phone || '—';

    // Edit fields pre-fill
    if($id('ppEditName')) $id('ppEditName').value = prof.name || '';
    if($id('ppEditEmail')) $id('ppEditEmail').value = prof.email || '';
    if($id('ppEditPhone')) $id('ppEditPhone').value = prof.phone || '';

    // Member since
    const joinKey = `tally:user:${uid}:joined`;
    let joined = localStorage.getItem(joinKey);
    if(!joined){ joined = new Date().toISOString().slice(0,10); localStorage.setItem(joinKey, joined); }
    if($id('ppMemberSince')) $id('ppMemberSince').textContent =
      new Date(joined).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});

    // Transactions & stats
    const txRaw = localStorage.getItem(`tally:user:${uid}:transactions`);
    const txList = txRaw ? JSON.parse(txRaw) : [];
    const income = txList.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount, 0);
    const spent  = txList.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount), 0);
    const net = income - spent;
    const fmt = v => '₹' + Math.abs(v).toLocaleString('en-IN', {maximumFractionDigits:0});

    if($id('ppStatIncome')) $id('ppStatIncome').textContent = fmt(income);
    if($id('ppStatSpent'))  $id('ppStatSpent').textContent  = fmt(spent);
    const netEl = $id('ppStatNet');
    if(netEl){ netEl.textContent = fmt(net); netEl.className = 'pp-stat-val ' + (net >= 0 ? 'pos' : 'neg'); }
    if($id('ppStatTx')) $id('ppStatTx').textContent = txList.length;

    // Storage
    let bytes = 0; const pfx = `tally:user:${uid}:`;
    for(let i=0; i<localStorage.length; i++){
      const k = localStorage.key(i);
      if(k && k.startsWith(pfx)) bytes += (localStorage.getItem(k)||'').length * 2;
    }
    if($id('ppStorageUsed')) $id('ppStorageUsed').textContent = fmtBytes(bytes);
  }

  const copyBtn=$id('ppCopyId');
  if(copyBtn) copyBtn.addEventListener('click',()=>{
    navigator.clipboard.writeText(window.currentUserId||'').catch(()=>{});
    copyBtn.textContent='✅'; setTimeout(()=>copyBtn.textContent='📋',1500);
  });

  const saveBtn=$id('ppSaveBtn');
  if(saveBtn) saveBtn.addEventListener('click',()=>{
    const uid = (typeof currentUserId !== 'undefined' && currentUserId) || window.currentUserId;
    if(!uid) return;
    const prof={name:($id('ppEditName').value||'').trim(),email:($id('ppEditEmail').value||'').trim(),phone:($id('ppEditPhone').value||'').trim()};
    localStorage.setItem(`tally:user:${uid}:profile`,JSON.stringify(prof));
    populateProfile();
    if(window.renderProfileStrip) window.renderProfileStrip(prof);
    if(window.showToast) window.showToast('Profile saved ✓','success'); else alert('Saved!');
  });

  const deleteBtn=$id('ppDeleteBtn'), modal=$id('ppDeleteModal'), cancelBtn=$id('ppModalCancel'), confirmBtn=$id('ppModalConfirm'), modalInput=$id('ppModalInput');
  if(deleteBtn) deleteBtn.addEventListener('click',()=>{ modal.classList.remove('hidden'); if(modalInput){modalInput.value='';modalInput.focus();} if(confirmBtn) confirmBtn.disabled=true; });
  if(cancelBtn) cancelBtn.addEventListener('click',()=>modal.classList.add('hidden'));
  if(modal) modal.addEventListener('click',e=>{ if(e.target===modal) modal.classList.add('hidden'); });
  if(modalInput) modalInput.addEventListener('input',()=>{ if(confirmBtn) confirmBtn.disabled=modalInput.value.trim()!==(window.currentUserId||''); });
  if(confirmBtn) confirmBtn.addEventListener('click',()=>{
    const uid = (typeof currentUserId !== 'undefined' && currentUserId) || window.currentUserId;
    if(!uid) return;
    const keys=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith(`tally:user:${uid}:`)) keys.push(k); }
    keys.forEach(k=>localStorage.removeItem(k));
    try{ const lr=localStorage.getItem('tally:users'); const l=lr?JSON.parse(lr):[]; localStorage.setItem('tally:users',JSON.stringify(l.filter(u=>u!==uid))); }catch(e){}
    modal.classList.add('hidden');
    window.currentUserId=null; currentUserId=null;
    $id('profilePage').classList.remove('visible');
    if(window.showToast) window.showToast('Account deleted. Goodbye 👋','success');
    setTimeout(()=>{ $id('appShell').classList.add('hidden'); const a=document.getElementById('authScreen')||document.getElementById('loginScreen'); if(a) a.classList.remove('hidden'); else location.reload(); },1200);
  });

  if($id('ppBackBtn')) $id('ppBackBtn').addEventListener('click',closeProfilePage);
  const sbBtn=$id('sbNavProfile');
  if(sbBtn) sbBtn.addEventListener('click',()=>{
    document.getElementById('sidebar').classList.remove('mobile-open');
    const ov=document.getElementById('sbMobileOverlay'); if(ov) ov.classList.remove('active');
    openProfilePage();
  });
  window.openProfilePage=openProfilePage;
})();

// ════════════════════════════════════════
//  GRAPH SHEET
// ════════════════════════════════════════
(function(){
  function fmtCur(v){ return '₹'+Math.abs(v).toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:0}); }
  function getISOWeek(d){ const date=new Date(d); date.setHours(0,0,0,0); date.setDate(date.getDate()+3-(date.getDay()+6)%7); const w1=new Date(date.getFullYear(),0,4); return [date.getFullYear(),1+Math.round(((date-w1)/86400000-3+(w1.getDay()+6)%7)/7)]; }
  function weekKey(ds){ const [y,w]=getISOWeek(new Date(ds)); return y+'-W'+(w<10?'0':'')+w; }
  function weekLabel(key){ const [yr,wn]=key.split('-W'); const j=new Date(parseInt(yr),0,4); const dw=(j.getDay()+6)%7; const mon=new Date(j); mon.setDate(j.getDate()-dw+(parseInt(wn)-1)*7); return 'W'+wn+' '+mon.toLocaleString('default',{month:'short'}); }
  const COLS=['#7C3AED','#0EA5E9','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#84CC16','#F97316'];
  const CATS=["Food","Groceries","Dining Out","Transport","Fuel","Housing","Utilities","Entertainment","Shopping","Clothing","Medical","Education","Subscriptions","Insurance","EMI / Loan","Personal Care","Travel","Gifts","Savings","Other"];
  function catColor(c){ return COLS[CATS.indexOf(c)%COLS.length]||COLS[0]; }

  function barPairChart(id,labels,incomes,expenses,showBal,balances){
    const wrap=document.getElementById(id); if(!wrap) return;
    const W=Math.max(wrap.clientWidth,500),H=200,PL=50,PR=14,PT=14,PB=26;
    const n=labels.length; const maxV=Math.max(1,...incomes,...expenses);
    const gW=(W-PL-PR)/n; const bw=Math.min(13,gW*0.28); const pH=H-PT-PB;
    const yB=v=>PT+pH-(v/maxV)*pH;
    let yL='',bars='',line='',dots='';
    for(let i=0;i<=4;i++){ const v=(maxV/4)*i; const y=yB(v); yL+=`<text x="${PL-4}" y="${y+3}" text-anchor="end" font-size="9" fill="var(--muted)" font-family="Space Mono,monospace">${fmtCur(v)}</text><line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" stroke="var(--paper-line)" stroke-width="0.5"/>`; }
    labels.forEach((l,i)=>{ const cx=PL+gW*i+gW/2; const ih=(incomes[i]/maxV)*pH; const eh=(expenses[i]/maxV)*pH; bars+=`<rect x="${cx-bw-1}" y="${yB(incomes[i])}" width="${bw}" height="${Math.max(1,ih)}" fill="var(--sage)" rx="1"/><rect x="${cx+1}" y="${yB(expenses[i])}" width="${bw}" height="${Math.max(1,eh)}" fill="var(--rust)" rx="1"/><text x="${cx}" y="${H-8}" text-anchor="middle" font-size="9" fill="var(--muted)" font-family="Space Mono,monospace">${l}</text>`; });
    if(showBal&&balances&&balances.length===n){ const mn=Math.min(0,...balances),mx=Math.max(1,...balances),r=(mx-mn)||1; const yBl=v=>PT+pH-((v-mn)/r)*pH; const pts=balances.map((b,i)=>[PL+gW*i+gW/2,yBl(b)]); line=`<path d="${pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ')}" fill="none" stroke="var(--brass)" stroke-width="2"/>`; dots=pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="var(--brass)"/>`).join(''); }
    wrap.innerHTML=`<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${yL}${bars}${line}${dots}</svg>`;
  }

  function lineChart(id,labels,values,color,fill){
    const wrap=document.getElementById(id); if(!wrap) return;
    const W=Math.max(wrap.clientWidth,500),H=150,PL=50,PR=14,PT=14,PB=26;
    const n=labels.length; if(!n) return;
    const mn=Math.min(0,...values),mx=Math.max(1,...values),r=(mx-mn)||1;
    const pH=H-PT-PB; const yL=v=>PT+pH-((v-mn)/r)*pH; const xL=i=>PL+((W-PL-PR)/(n-1||1))*i;
    let yLabels='';
    for(let i=0;i<=4;i++){ const v=mn+(r/4)*i; const y=yL(v); yLabels+=`<text x="${PL-4}" y="${y+3}" text-anchor="end" font-size="9" fill="var(--muted)" font-family="Space Mono,monospace">${v.toFixed(0)}${fill?'%':''}</text><line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" stroke="var(--paper-line)" stroke-width="0.5"/>`; }
    const pts=values.map((v,i)=>[xL(i),yL(v)]);
    const lp=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
    let areaPath=''; if(fill){ const by=yL(0); areaPath=`<path d="M${pts[0][0]} ${by} ${pts.map(p=>`L${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')} L${pts[pts.length-1][0]} ${by} Z" fill="${color}" opacity="0.12"/>`; }
    const xlbls=labels.map((l,i)=>`<text x="${xL(i)}" y="${H-8}" text-anchor="middle" font-size="9" fill="var(--muted)" font-family="Space Mono,monospace">${l}</text>`).join('');
    const ddots=pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${color}"/>`).join('');
    wrap.innerHTML=`<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${yLabels}${areaPath}<path d="${lp}" fill="none" stroke="${color}" stroke-width="2"/>${ddots}${xlbls}</svg>`;
  }

  function catCards(id,txList){
    const wrap=document.getElementById(id); if(!wrap) return;
    const totals={}; CATS.forEach(c=>totals[c]=0);
    txList.filter(t=>t.amount<0).forEach(t=>{ totals[t.category]=(totals[t.category]||0)+Math.abs(t.amount); });
    const max=Math.max(1,...Object.values(totals));
    wrap.innerHTML=CATS.filter(c=>totals[c]>0).map(c=>`<div class="gs-cat-card"><div class="gs-cat-name">${c}</div><div class="gs-cat-val">${fmtCur(totals[c])}</div><div class="gs-cat-bar-track"><div class="gs-cat-bar-fill" style="width:${(totals[c]/max*100).toFixed(1)}%;background:${catColor(c)};"></div></div></div>`).join('')||'<div style="color:var(--muted);font-size:13px;">No expenses yet.</div>';
  }

  function updateSummary(txList){
    const inc=txList.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
    const sp=txList.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
    const net=inc-sp; const rate=inc>0?((net/inc)*100):null;
    document.getElementById('gsSumIncome').textContent=inc?fmtCur(inc):'—';
    document.getElementById('gsSumSpent').textContent=sp?fmtCur(sp):'—';
    const ne=document.getElementById('gsSumNet'); ne.textContent=inc||sp?fmtCur(net):'—'; ne.className='gs-sum-val '+(net>=0?'pos':'neg');
    const re=document.getElementById('gsSumRate'); re.textContent=rate!==null?rate.toFixed(1)+'%':'—'; re.className='gs-sum-val '+(rate===null?'':rate>=20?'pos':rate>=0?'neutral':'neg');
  }

  function renderWeekly(){
    if(!window.transactions) return;
    const now=new Date(); const weeks=[];
    for(let i=11;i>=0;i--){ const d=new Date(now); d.setDate(now.getDate()-i*7); const [y,w]=getISOWeek(d); const key=y+'-W'+(w<10?'0':'')+w; if(!weeks.find(x=>x.key===key)) weeks.push({key,label:weekLabel(key)}); }
    const wd=weeks.map(({key,label})=>{ const tx=window.transactions.filter(t=>weekKey(t.date)===key); return {key,label,income:tx.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0),expense:tx.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0),tx}; });
    const all=[...window.transactions].sort((a,b)=>a.date.localeCompare(b.date)); let run=0,idx=0;
    const bals=wd.map(w=>{ while(idx<all.length&&weekKey(all[idx].date)<=w.key){run+=all[idx].amount;idx++;} return run; });
    barPairChart('gsWeeklyBarWrap',wd.map(d=>d.label),wd.map(d=>d.income),wd.map(d=>d.expense),false,null);
    lineChart('gsWeeklyBalWrap',wd.map(d=>d.label),bals,'var(--brass)',false);
    const twk=weekKey(now.toISOString().slice(0,10)); catCards('gsWeeklyCatGrid',window.transactions.filter(t=>weekKey(t.date)===twk));
    updateSummary(wd.flatMap(d=>d.tx));
  }

  function renderMonthly(){
    if(!window.transactions) return;
    const now=new Date(); const months=[];
    for(let i=11;i>=0;i--){ const d=new Date(now.getFullYear(),now.getMonth()-i,1); months.push(d.toISOString().slice(0,7)); }
    const md=months.map(m=>{ const tx=window.transactions.filter(t=>t.date.slice(0,7)===m); const d=new Date(m+'-01T00:00:00'); return {m,label:d.toLocaleString('default',{month:'short'}),income:tx.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0),expense:tx.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0),tx}; });
    const all=[...window.transactions].sort((a,b)=>a.date.localeCompare(b.date)); let run=0,idx=0;
    const bals=md.map(m=>{ while(idx<all.length&&all[idx].date.slice(0,7)<=m.m){run+=all[idx].amount;idx++;} return run; });
    barPairChart('gsMonthlyBarWrap',md.map(d=>d.label),md.map(d=>d.income),md.map(d=>d.expense),true,bals);
    lineChart('gsMonthlySavingsWrap',md.map(d=>d.label),md.map(d=>d.income>0?((d.income-d.expense)/d.income*100):0),'var(--brass)',true);
    catCards('gsMonthlyCatGrid',window.transactions.filter(t=>t.date.slice(0,7)===now.toISOString().slice(0,7)));
    updateSummary(md.flatMap(d=>d.tx));
  }

  function renderYearly(){
    if(!window.transactions) return;
    const now=new Date(); const years=[]; for(let i=4;i>=0;i--) years.push(now.getFullYear()-i);
    const yd=years.map(yr=>{ const tx=window.transactions.filter(t=>parseInt(t.date.slice(0,4))===yr); const inc=tx.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0); const exp=tx.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0); return {yr,label:String(yr),income:inc,expense:exp,net:inc-exp,tx}; });
    const wrap=document.getElementById('gsYearlyBarWrap'); if(!wrap) return;
    const W=Math.max(wrap.clientWidth,400),H=200,PL=50,PR=14,PT=14,PB=26;
    const n=yd.length; const maxV=Math.max(1,...yd.map(d=>Math.max(d.income,d.expense)));
    const gW=(W-PL-PR)/n; const bw=Math.min(12,gW*0.22); const pH=H-PT-PB; const yB=v=>PT+pH-(v/maxV)*pH;
    let yL='',bars='';
    for(let i=0;i<=4;i++){ const v=(maxV/4)*i; const y=yB(v); yL+=`<text x="${PL-4}" y="${y+3}" text-anchor="end" font-size="9" fill="var(--muted)" font-family="Space Mono,monospace">${fmtCur(v)}</text><line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" stroke="var(--paper-line)" stroke-width="0.5"/>`; }
    yd.forEach((d,i)=>{ const cx=PL+gW*i+gW/2; bars+=`<rect x="${cx-bw*1.5-2}" y="${yB(d.income)}" width="${bw}" height="${Math.max(1,(d.income/maxV)*pH)}" fill="var(--sage)" rx="1"/><rect x="${cx-bw/2}" y="${yB(d.expense)}" width="${bw}" height="${Math.max(1,(d.expense/maxV)*pH)}" fill="var(--rust)" rx="1"/><rect x="${cx+bw/2+2}" y="${d.net>=0?yB(d.net):yB(0)}" width="${bw}" height="${Math.max(1,Math.abs(d.net)/maxV*pH)}" fill="var(--brass)" rx="1"/><text x="${cx}" y="${H-8}" text-anchor="middle" font-size="10" fill="var(--muted)" font-family="Space Mono,monospace">${d.label}</text>`; });
    wrap.innerHTML=`<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${yL}${bars}</svg>`;
    const cw=document.getElementById('gsYearlyCatWrap'); if(!cw) return;
    const CW=Math.max(cw.clientWidth,400),CH=180; const catTotals={}; CATS.forEach(c=>{ catTotals[c]=yd.map(d=>d.tx.filter(t=>t.amount<0&&t.category===c).reduce((s,t)=>s+Math.abs(t.amount),0)); });
    const maxC=Math.max(1,...CATS.flatMap(c=>catTotals[c])); const cgW=(CW-PL-PR)/n; const cbw=Math.min(10,cgW*0.18); const cpH=CH-PT-PB; const cyB=v=>PT+cpH-(v/maxC)*cpH;
    let cyL='',cbars='';
    for(let i=0;i<=4;i++){ const v=(maxC/4)*i; const y=cyB(v); cyL+=`<text x="${PL-4}" y="${y+3}" text-anchor="end" font-size="9" fill="var(--muted)" font-family="Space Mono,monospace">${fmtCur(v)}</text><line x1="${PL}" y1="${y}" x2="${CW-PR}" y2="${y}" stroke="var(--paper-line)" stroke-width="0.5"/>`; }
    yd.forEach((d,i)=>{ const cx=PL+cgW*i+cgW/2; const off=-((CATS.length/2)*cbw+CATS.length-1); CATS.forEach((c,ci)=>{ const v=catTotals[c][i]; if(!v) return; cbars+=`<rect x="${cx+off+ci*(cbw+1)}" y="${cyB(v)}" width="${cbw}" height="${Math.max(1,(v/maxC)*cpH)}" fill="${catColor(c)}" rx="1"/>`; }); cbars+=`<text x="${cx}" y="${CH-8}" text-anchor="middle" font-size="10" fill="var(--muted)" font-family="Space Mono,monospace">${d.label}</text>`; });
    cw.innerHTML=`<svg width="100%" height="${CH}" viewBox="0 0 ${CW} ${CH}" xmlns="http://www.w3.org/2000/svg">${cyL}${cbars}</svg>`;
    const leg=document.getElementById('gsYearlyCatLegend'); if(leg) leg.innerHTML=CATS.map(c=>`<span><span class="swatch" style="background:${catColor(c)};"></span>${fhCatLabel(c)}</span>`).join('');
    updateSummary(yd.flatMap(d=>d.tx));
  }

  let activeTab='weekly';
  document.querySelectorAll('.gs-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      document.querySelectorAll('.gs-tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active'); activeTab=tab.dataset.gstab;
      document.querySelectorAll('.gs-panel').forEach(p=>p.classList.remove('active'));
      document.getElementById('gs'+activeTab[0].toUpperCase()+activeTab.slice(1)+'Panel').classList.add('active');
      renderActiveTab();
    });
  });

  function renderActiveTab(){ if(activeTab==='weekly') renderWeekly(); else if(activeTab==='monthly') renderMonthly(); else renderYearly(); }

  function openGraphSheet(){
    document.getElementById('appShell').classList.add('hidden');
    document.getElementById('profilePage').classList.remove('visible');
    document.getElementById('graphSheetPage').classList.add('visible');
    setTimeout(renderActiveTab,60);
  }
  function closeGraphSheet(){
    document.getElementById('graphSheetPage').classList.remove('visible');
    document.getElementById('appShell').classList.remove('hidden');
  }

  document.getElementById('gsBackBtn').addEventListener('click',closeGraphSheet);
  const sbBtn=document.getElementById('sbNavGraphSheet');
  if(sbBtn) sbBtn.addEventListener('click',()=>{
    document.getElementById('sidebar').classList.remove('mobile-open');
    const ov=document.getElementById('sbMobileOverlay'); if(ov) ov.classList.remove('active');
    openGraphSheet();
  });
  window.openGraphSheet=openGraphSheet;
  window.renderGraphSheet_full=renderActiveTab;
})();

// ═══════════════════════════════════════════════════════
//  FINHUB ENHANCED — Combined Script
// ═══════════════════════════════════════════════════════

const CATEGORIES = ["Food","Groceries","Dining Out","Transport","Fuel","Housing","Utilities","Entertainment","Shopping","Clothing","Medical","Education","Subscriptions","Insurance","EMI / Loan","Personal Care","Travel","Gifts","Savings","Other"];
let transactions = [];
let budgets = {};
let goals = [];
let recurringItems = [];
let entryType = "expense";
const $ = id => document.getElementById(id);
const fmt = n => (n<0?"-":"") + "₹" + Math.abs(n).toFixed(2);
let _currentUserId = null;
Object.defineProperty(window, 'currentUserId', {
  get(){ return _currentUserId; },
  set(v){ _currentUserId = v; }
});
// local alias used throughout this script
Object.defineProperty(window, '_getUID', { get(){ return _currentUserId; } });
// Patch: ensure 'currentUserId' local var always mirrors window
let currentUserId = null;
// We use a Proxy-like approach: reassign via setter below
function _setUID(v){ currentUserId = v; window.currentUserId = v; }

const CATEGORY_COLORS = {
  Food:"#F59E0B", Groceries:"#FBBF24", "Dining Out":"#F97316",
  Transport:"#10B981", Fuel:"#34D399",
  Housing:"#3B82F6", Utilities:"#06B6D4",
  Entertainment:"#EF4444", Shopping:"#D97706", Clothing:"#F43F5E",
  Medical:"#A855F7",
  Education:"#6366F1", Subscriptions:"#0EA5E9",
  Insurance:"#14B8A6", "EMI / Loan":"#DC2626",
  "Personal Care":"#EC4899", Travel:"#22D3EE",
  Gifts:"#E879F9", Savings:"#4ADE80", Other:"#64748B"
};
function categoryColor(c){ return CATEGORY_COLORS[c] || 'var(--brass)'; }

// ── Toast ──
let toastTimer;
function showToast(msg, type=''){
  const t = $('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ t.className = ''; }, 2600);
}

// ── localStorage helpers ──
function userKey(name){ return `tally:user:${window.currentUserId}:${name}`; }

async function loadData(){
  // Load budgets, goals, recurring from localStorage (device only)
  try{ const b = localStorage.getItem(userKey('budgets')); budgets = b ? JSON.parse(b) : {}; }catch(e){ budgets = {}; }
  await loadGoals();
  await loadRecurring();

  // Load transactions: try Supabase cloud first, fallback to localStorage
  const uid = window.currentUserId || currentUserId;
  if (uid && window._sb && navigator.onLine) {
    try {
      const cloudTx = await window._sb.load(uid);
      if (cloudTx !== null) {
        transactions = cloudTx;
        try { localStorage.setItem(userKey('transactions'), JSON.stringify(transactions)); } catch(e) {}
        console.log('FinHub: Loaded', transactions.length, 'transactions from Supabase ☁️');
        return;
      }
    } catch(e) { console.warn('Cloud load failed, using local:', e); }
  }
  // Fallback: localStorage
  try{ const t = localStorage.getItem(userKey('transactions')); transactions = t ? JSON.parse(t) : []; }catch(e){ transactions = []; }
  console.log('FinHub: Loaded', transactions.length, 'transactions from localStorage 📱');
}
async function saveTransactions(){
  // Always save to localStorage first (instant, works offline)
  try{ localStorage.setItem(userKey('transactions'), JSON.stringify(transactions)); }catch(e){}
  // Also sync to Supabase cloud (async, non-blocking)
  try {
    const uid = window.currentUserId;
    if (uid && window._sb && navigator.onLine) {
      window._sb.fullSync(uid, transactions).then(ok => {
        if (!ok) console.warn('FinHub: Supabase sync failed silently');
      });
    }
  } catch(e) { console.warn('FinHub: Supabase save error:', e); }
}
async function saveBudgets(){ try{ localStorage.setItem(userKey('budgets'), JSON.stringify(budgets)); }catch(e){} }

// ── SHA-256 ──
async function sha256Hex(text){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function sanitizeUserId(raw){ return raw.trim().toLowerCase().replace(/[^a-z0-9_.-]/g,''); }

// ── Category selects ──
function populateCategorySelect(){
  const sel = $('fCategory');
  sel.innerHTML = "";
  CATEGORIES.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); });
  // also populate edit modal and recurring
  ['editCat','recurCat'].forEach(id=>{
    const s = $(id); if(!s) return;
    s.innerHTML = "";
    CATEGORIES.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; s.appendChild(o); });
  });
}

function renderBudgetInputs(){
  const wrap = $('budgetInputs'); wrap.innerHTML = "";
  CATEGORIES.forEach(c=>{
    const row = document.createElement('div'); row.className='budget-row';
    row.innerHTML = `<span>${c}</span>`;
    const inp = document.createElement('input');
    inp.type='number'; inp.min='0'; inp.step='1'; inp.value=budgets[c]||''; inp.placeholder='—';
    inp.addEventListener('change', async ()=>{ budgets[c]=parseFloat(inp.value)||0; await saveBudgets(); renderAll(); });
    row.appendChild(inp); wrap.appendChild(row);
  });
}

// ── Entry type toggle ──
$('typeExpense').addEventListener('click', ()=>{
  entryType='expense';
  $('typeExpense').classList.add('active'); $('typeIncome').classList.remove('active');
  $('catLabel').textContent='Category'; $('fCategory').style.display='block';
});
$('typeIncome').addEventListener('click', ()=>{
  entryType='income';
  $('typeIncome').classList.add('active'); $('typeExpense').classList.remove('active');
  $('catLabel').textContent='Category (n/a for income)'; $('fCategory').style.display='none';
});

// ── Add entry ──
$('addBtn').addEventListener('click', async ()=>{
  const amt = parseFloat($('fAmount').value);
  if(!amt||amt<=0){ $('fAmount').focus(); return; }
  const desc = $('fDesc').value.trim() || (entryType==='income'?'Income':'Expense');
  const note = $('fNote').value.trim();
  const date = $('fDate').value || new Date().toISOString().slice(0,10);
  const category = entryType==='income' ? 'Income' : $('fCategory').value;
  const entry = {
    id: Date.now()+Math.random().toString(16).slice(2),
    date, desc, category, note,
    amount: entryType==='income' ? Math.abs(amt) : -Math.abs(amt)
  };
  transactions.push(entry);
  await saveTransactions();
  $('fAmount').value=''; $('fDesc').value=''; $('fNote').value='';
  renderAll();
  showToast('Entry added ✓', 'success');
});

// ── Ledger rendering ──
function monthKey(dateStr){ return dateStr.slice(0,7); }

function populateMonthFilter(){
  const sel = $('monthFilter');
  const months = Array.from(new Set(transactions.map(t=>monthKey(t.date))));
  const current = new Date().toISOString().slice(0,7);
  if(!months.includes(current)) months.push(current);
  months.sort().reverse();
  const prev = sel.value;
  sel.innerHTML = "";
  // "All months" option at the top
  const allOpt = document.createElement('option'); allOpt.value='all'; allOpt.textContent='\u{1F4C5} All Months'; sel.appendChild(allOpt);
  months.forEach(m=>{
    const o=document.createElement('option'); o.value=m;
    const d=new Date(m+"-01T00:00:00");
    o.textContent=d.toLocaleString('default',{month:'long',year:'numeric'});
    sel.appendChild(o);
  });
  if(prev && (prev==='all' || months.includes(prev))){
    sel.value = prev;
  } else {
    sel.value = 'all';
  }
}

function computeLedger(){
  const sorted = [...transactions].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  let bal=0;
  const withBal = sorted.map(t=>{ bal+=t.amount; return {...t,balance:bal}; });
  return withBal.reverse();
}

function renderLedger(){
  const selectedMonth = $('monthFilter').value;
  const query = ($('searchInput')||{value:''}).value.trim().toLowerCase();
  const withBal = computeLedger();
  let filtered = selectedMonth==='all' ? [...withBal] : withBal.filter(t=> monthKey(t.date)===selectedMonth);
  if(query) filtered = filtered.filter(t=>
    t.desc.toLowerCase().includes(query) ||
    t.category.toLowerCase().includes(query) ||
    (t.note||'').toLowerCase().includes(query)
  );
  const body = $('ledgerBody'); body.innerHTML="";
  $('emptyState').style.display = filtered.length?'none':'block';
  filtered.forEach(t=>{
    const tr=document.createElement('tr');
    const isExpense = t.amount<0;
    tr.innerHTML = `
      <td class="mono">${t.date}</td>
      <td>
        <div>${t.desc}</div>
        ${t.note ? `<div class="entry-note">📝 ${t.note}</div>` : ''}
      </td>
      <td class="ledger-col-cat"><span class="cat-pill">${t.category}</span></td>
      <td class="num mono amt ${isExpense?'expense':'income'}">${fmt(t.amount)}</td>
      <td class="num mono ledger-col-bal">${fmt(t.balance)}</td>
      <td style="white-space:nowrap;">
        <button class="edit-btn" data-id="${t.id}" title="Edit">✏️</button>
        <button class="del-btn"  data-id="${t.id}" title="Delete">✕</button>
      </td>
    `;
    body.appendChild(tr);
  });
  body.querySelectorAll('.del-btn').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      if(!confirm('Delete this entry?')) return;
      transactions = transactions.filter(t=>t.id!==btn.dataset.id);
      await saveTransactions(); renderAll();
      showToast('Entry deleted', 'error');
    });
  });
  body.querySelectorAll('.edit-btn').forEach(btn=>{
    btn.addEventListener('click', ()=> openEditModal(btn.dataset.id));
  });
}

// ── Quick Stats ──
function renderQuickStats(){
  const selectedMonth = $('monthFilter').value;
  const monthTx = (selectedMonth==='all' ? transactions : transactions.filter(t=>monthKey(t.date)===selectedMonth)).filter(t=>t.amount<0);
  if(!monthTx.length){
    $('qsBig').textContent='—'; $('qsAvg').textContent='—'; $('qsDays').textContent='—'; return;
  }
  const biggest = Math.max(...monthTx.map(t=>Math.abs(t.amount)));
  const bigEntry = monthTx.find(t=>Math.abs(t.amount)===biggest);
  $('qsBig').textContent = bigEntry ? `${fmt(-biggest)} (${bigEntry.desc.slice(0,14)})` : '—';
  const daysInMonth = new Date(selectedMonth.slice(0,4), parseInt(selectedMonth.slice(5))+1, 0).getDate();
  const today = new Date();
  const passedDays = (monthKey(today.toISOString().slice(0,10))===selectedMonth) ? today.getDate() : daysInMonth;
  const totalSpent = monthTx.reduce((s,t)=>s+Math.abs(t.amount),0);
  $('qsAvg').textContent = passedDays > 0 ? fmt(totalSpent/passedDays)+'/day' : '—';
  const lastDay = new Date(selectedMonth.slice(0,4), parseInt(selectedMonth.slice(5)), 0).getDate();
  const daysLeft = lastDay - today.getDate();
  $('qsDays').textContent = monthKey(today.toISOString().slice(0,10))===selectedMonth
    ? (daysLeft >= 0 ? daysLeft + ' days' : 'Last day') : '—';
}

// ── Top strip ──
function renderTopStrip(){
  const all = computeLedger();
  const totalBalance = all.length ? all[0].balance : 0;
  $('totalBalance').textContent = fmt(totalBalance);
  const selectedMonth = $('monthFilter').value;
  const monthTx = selectedMonth==='all' ? transactions : transactions.filter(t=>monthKey(t.date)===selectedMonth);
  const spent  = monthTx.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
  const income = monthTx.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
  $('monthSpent').textContent  = fmt(spent);
  $('monthIncome').textContent = fmt(income);
  const net = income - spent;
  const netEl = $('monthNet');
  netEl.textContent = fmt(net);
  netEl.className = 'val mono ' + (net >= 0 ? 'pos' : 'neg');
  // Update header label to always reflect selected month
  const greetSub = $('headerGreetingMonth');
  if(greetSub){
    if(selectedMonth==='all'){ greetSub.textContent = 'All Time'; }
    else { const d=new Date(selectedMonth+'-01T00:00:00'); greetSub.textContent=d.toLocaleString('default',{month:'long',year:'numeric'}); }
  }
}

// Width of the label column = widest (translated) category name, so long words (e.g. Tamil) never get clipped
function fhCatLabel(c){ try{ return window.__fhTr ? window.__fhTr(c) : c; }catch(e){ return c; } }
function fhLabelPad(base, cap){
  let m = 0;
  try{
    const cv = fhLabelPad._c || (fhLabelPad._c = document.createElement('canvas'));
    const cx = cv.getContext('2d');
    cx.font = '12px "Source Sans 3", "Noto Sans Tamil", sans-serif';
    CATEGORIES.forEach(c=>{ m = Math.max(m, cx.measureText(fhCatLabel(c)).width); });
  }catch(e){}
  return Math.min(Math.max(base, Math.ceil(m) + 18), cap || 230);
}

// ── Breakdown chart ──
function renderBreakdown(){
  const selectedMonth = $('monthFilter').value;
  const monthTx = (selectedMonth==='all' ? transactions : transactions.filter(t=>monthKey(t.date)===selectedMonth)).filter(t=>t.amount<0);
  const totals = {};
  CATEGORIES.forEach(c=>totals[c]=0);
  monthTx.forEach(t=>{ totals[t.category]=(totals[t.category]||0)+Math.abs(t.amount); });
  const wrap=$('breakdown');
  const w=wrap.clientWidth>0?wrap.clientWidth:500;
  const rowH=34, padL=fhLabelPad(100),padR=70,padT=10,padB=10;
  const h=padT+padB+rowH*CATEGORIES.length;
  const plotW=w-padL-padR;
  const maxVal=Math.max(1,...CATEGORIES.map(c=>Math.max(totals[c]||0,budgets[c]||0)));
  let rows="";
  CATEGORIES.forEach((c,i)=>{
    const spent=totals[c]||0; const limit=budgets[c]||0;
    const y=padT+i*rowH; const barY=y+rowH*0.22; const barH=rowH*0.5;
    const barW=(spent/maxVal)*plotW; const over=limit>0&&spent>limit;
    const color=categoryColor(c);
    rows+=`<text x="${padL-8}" y="${y+rowH*0.55}" font-size="12" fill="var(--charcoal)" font-family="Source Sans 3,sans-serif" text-anchor="end">${fhCatLabel(c)}</text>`;
    rows+=`<rect x="${padL}" y="${barY}" width="${plotW}" height="${barH}" fill="none" stroke="var(--paper-line)"></rect>`;
    rows+=`<rect x="${padL}" y="${barY}" width="${Math.max(1,barW)}" height="${barH}" fill="${color}" ${over?'stroke="var(--rust)" stroke-width="2"':''}></rect>`;

    rows+=`<text x="${padL+plotW+8}" y="${y+rowH*0.55}" font-size="11" fill="var(--muted)" font-family="Space Mono,monospace">${fmt(-spent)}</text>`;
  });
  wrap.innerHTML=`<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${rows}</svg>`;
  const legend=$('breakdownLegend');
  if(legend) legend.innerHTML=CATEGORIES.map(c=>`<span><span class="swatch" style="background:${categoryColor(c)};"></span>${fhCatLabel(c)}</span>`).join('')
    +`<span><span class="swatch" style="background:none;border:1.5px dashed var(--rust);width:8px;height:8px;"></span><span data-i18n="gs_budget_limit">${(window._finhubT&&window._finhubT.gs_budget_limit)||'Budget limit'}</span></span>`;
}

// ── Shared graph SVG builder ──
function buildBarLineSVG(wrap, buckets, labelFn, statsWrap, statsCards){
  const w = wrap.clientWidth > 0 ? wrap.clientWidth : 500;
  const h = 230;
  const padL = 46, padR = 14, padT = 16, padB = 28;
  const plotW = w - padL - padR, plotH = h - padT - padB;

  const allSorted = [...transactions].sort((a,b)=>a.date.localeCompare(b.date));
  let running = 0, sidx = 0;
  const balances = buckets.map(b => {
    while(sidx < allSorted.length && allSorted[sidx].date <= b.endKey){
      running += allSorted[sidx].amount; sidx++;
    }
    return running;
  });

  const maxBar = Math.max(1, ...buckets.map(b => Math.max(b.income, b.expense)));
  const minBal = Math.min(0, ...balances), maxBal = Math.max(1, ...balances);
  const balRange = (maxBal - minBal) || 1;
  const groupW = plotW / buckets.length;
  const barW = Math.max(2, Math.min(18, groupW * 0.3));
  const yBar = v => padT + plotH - (v / maxBar) * plotH;
  const yBal = v => padT + plotH - ((v - minBal) / balRange) * plotH;

  // Y-axis labels
  let yAxis = '';
  for(let i = 0; i <= 4; i++){
    const v = (maxBar / 4) * i;
    const y = yBar(v);
    const label = v >= 1000 ? '₹'+(v/1000).toFixed(0)+'k' : '₹'+v.toFixed(0);
    yAxis += `<text x="${padL-4}" y="${y+3}" text-anchor="end" font-size="9" fill="var(--muted)" font-family="Space Mono,monospace">${label}</text>`;
    yAxis += `<line x1="${padL}" y1="${y}" x2="${padL+plotW}" y2="${y}" stroke="var(--paper-line)" stroke-width="0.5"></line>`;
  }

  let bars = '', linePts = [];
  buckets.forEach((b, i) => {
    const cx = padL + groupW * i + groupW / 2;
    const incH = (b.income / maxBar) * plotH;
    const expH = (b.expense / maxBar) * plotH;
    if(incH > 0) bars += `<rect x="${cx-barW-1.5}" y="${yBar(b.income)}" width="${barW}" height="${incH}" fill="var(--sage)" rx="2" opacity="0.85"></rect>`;
    if(expH > 0) bars += `<rect x="${cx+1.5}" y="${yBar(b.expense)}" width="${barW}" height="${expH}" fill="var(--rust)" rx="2" opacity="0.85"></rect>`;
    const lbl = labelFn(b, i, buckets.length);
    if(lbl) bars += `<text x="${cx}" y="${h-8}" text-anchor="middle" font-size="9.5" fill="var(--muted)" font-family="Space Mono,monospace">${lbl}</text>`;
    linePts.push([cx, yBal(balances[i])]);
  });

  const linePath = linePts.map((p,i) => (i===0?'M':'L')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const areaPath = linePath + ` L${linePts[linePts.length-1][0].toFixed(1)} ${(padT+plotH).toFixed(1)} L${padL} ${(padT+plotH).toFixed(1)} Z`;
  const dots = linePts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="2.5" fill="var(--brass)" stroke="var(--surface)" stroke-width="1.5"></circle>`).join('');
  const zeroY = yBal(0);
  const zeroLine = minBal < 0 ? `<line x1="${padL}" y1="${zeroY}" x2="${padL+plotW}" y2="${zeroY}" stroke="var(--rust)" stroke-dasharray="3,3" stroke-width="1" opacity="0.5"></line>` : '';

  wrap.innerHTML = `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="balAreaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--brass)" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="var(--brass)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${yAxis}${zeroLine}${bars}
    <path d="${areaPath}" fill="url(#balAreaGrad)"></path>
    <path d="${linePath}" fill="none" stroke="var(--brass)" stroke-width="2" stroke-linejoin="round"></path>
    ${dots}
  </svg>`;

  if(statsWrap && statsCards){
    const statCard = (label, value, cls='neutral') =>
      `<div class="graph-stats-item"><span class="graph-stats-label">${label}</span><span class="graph-stats-value ${cls}">${value}</span></div>`;
    statsWrap.innerHTML = statsCards.map(s => statCard(s.label, s.value, s.cls||'neutral')).join('');
  }
}

// ── Weekly Graph (last 8 weeks) ──
function renderGraphWeekly(){
  const wrap = $('graphSheetWeekly'), statsWrap = $('graphStatsWeekly');
  if(!wrap) return;
  const now = new Date();
  const buckets = [];
  for(let i = 7; i >= 0; i--){
    const end = new Date(now); end.setDate(now.getDate() - i*7);
    const start = new Date(end); start.setDate(end.getDate() - 6);
    const startStr = start.toISOString().slice(0,10);
    const endStr   = end.toISOString().slice(0,10);
    const tx = transactions.filter(t => t.date >= startStr && t.date <= endStr);
    const income  = tx.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
    const expense = tx.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
    // week label: "W1", "W2"… or day-range
    const d = new Date(end);
    const label = d.toLocaleString('default',{month:'short',day:'numeric'});
    buckets.push({ startStr, endStr, endKey: endStr, income, expense, label });
  }
  const totalInc = buckets.reduce((s,b)=>s+b.income,0);
  const totalExp = buckets.reduce((s,b)=>s+b.expense,0);
  const avgWeekExp = totalExp / 8;
  const savRate = totalInc > 0 ? ((totalInc-totalExp)/totalInc*100) : null;
  const _T1 = window._finhubT || {};
  const statsCards = [
    { label: _T1.charts_total_income||'8-wk income',  value: fmt(totalInc),     cls: 'pos'     },
    { label: _T1.charts_total_spent||'8-wk spent',    value: fmt(-totalExp),    cls: 'neg'     },
    { label: 'Avg/week',                               value: fmt(-avgWeekExp),  cls: 'neutral' },
    { label: _T1.charts_savings_rate||'Savings rate',  value: savRate!==null ? savRate.toFixed(1)+'%':'—', cls: savRate>=20?'pos':savRate>=0?'neutral':'neg' },
  ];
  buildBarLineSVG(wrap, buckets, (b,i,len) => {
    // show label every 2nd bucket or first/last
    return (i===0||i===len-1||i%2===0) ? b.label : '';
  }, statsWrap, statsCards);
}

// ── Monthly Graph (last 12 months) ──
function renderGraphMonthly(){
  const wrap = $('graphSheetMonthly'), statsWrap = $('graphStatsMonthly');
  if(!wrap) return;
  const now = new Date();
  const buckets = [];
  for(let i = 11; i >= 0; i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const m = d.toISOString().slice(0,7);
    const endKey = new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().slice(0,10);
    const tx = transactions.filter(t => monthKey(t.date) === m);
    const income  = tx.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
    const expense = tx.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
    buckets.push({ m, endKey, income, expense });
  }
  const totalInc = buckets.reduce((s,b)=>s+b.income,0);
  const totalExp = buckets.reduce((s,b)=>s+b.expense,0);
  const avgMonExp = totalExp / 12;
  const savRate = totalInc > 0 ? ((totalInc-totalExp)/totalInc*100) : null;
  const activeMonths = buckets.filter(b=>b.income>0||b.expense>0).length;
  const _T2 = window._finhubT || {};
  const statsCards = [
    { label: _T2.charts_total_income||'12-mo income', value: fmt(totalInc),     cls: 'pos'     },
    { label: _T2.charts_total_spent||'12-mo spent',   value: fmt(-totalExp),    cls: 'neg'     },
    { label: 'Avg/month',                              value: fmt(-avgMonExp),   cls: 'neutral' },
    { label: _T2.charts_savings_rate||'Savings rate',  value: savRate!==null ? savRate.toFixed(1)+'%':'—', cls: savRate>=20?'pos':savRate>=0?'neutral':'neg' },
  ];
  buildBarLineSVG(wrap, buckets, (b,i,len) => {
    const d = new Date(b.m+'-01T00:00:00');
    return (i===0||i===len-1||i%2===0) ? d.toLocaleString('default',{month:'short'}) : '';
  }, statsWrap, statsCards);
}

// ── Yearly Graph (last 5 years) ──
function renderGraphYearly(){
  const wrap = $('graphSheetYearly'), statsWrap = $('graphStatsYearly');
  if(!wrap) return;
  const now = new Date();
  const buckets = [];
  for(let i = 4; i >= 0; i--){
    const yr = now.getFullYear() - i;
    const startKey = `${yr}-01-01`, endKey = `${yr}-12-31`;
    const tx = transactions.filter(t => t.date >= startKey && t.date <= endKey);
    const income  = tx.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
    const expense = tx.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
    buckets.push({ yr, endKey, income, expense });
  }
  const totalInc = buckets.reduce((s,b)=>s+b.income,0);
  const totalExp = buckets.reduce((s,b)=>s+b.expense,0);
  const net = totalInc - totalExp;
  const savRate = totalInc > 0 ? (net/totalInc*100) : null;
  const _T3 = window._finhubT || {};
  const statsCards = [
    { label: _T3.charts_total_income||'5-yr income', value: fmt(totalInc),  cls: 'pos'     },
    { label: _T3.charts_total_spent||'5-yr spent',   value: fmt(-totalExp), cls: 'neg'     },
    { label: _T3.charts_net_saved||'5-yr net',        value: fmt(net),       cls: net>=0?'pos':'neg' },
    { label: _T3.charts_savings_rate||'Overall save rate', value: savRate!==null ? savRate.toFixed(1)+'%':'—', cls: savRate>=20?'pos':savRate>=0?'neutral':'neg' },
  ];
  buildBarLineSVG(wrap, buckets, (b) => String(b.yr), statsWrap, statsCards);
}

// ── Tab switcher ──
let activeGraphTab = 'weekly';
function switchGraphTab(tab){
  activeGraphTab = tab;
  ['weekly','monthly','yearly'].forEach(t => {
    const btn = $('gtab' + t.charAt(0).toUpperCase() + t.slice(1));
    const panel = $('gpanel' + t.charAt(0).toUpperCase() + t.slice(1));
    if(btn)   btn.classList.toggle('active', t === tab);
    if(panel) panel.classList.toggle('hidden', t !== tab);
  });
  // Render on demand (wrap needs clientWidth, so render after panel is visible)
  requestAnimationFrame(() => {
    if(tab === 'weekly')  renderGraphWeekly();
    if(tab === 'monthly') renderGraphMonthly();
    if(tab === 'yearly')  renderGraphYearly();
  });
}

// Legacy alias so renderAll still works
function renderGraphSheet(){ renderGraphWeekly(); }

function renderAll(){
  window.transactions = transactions; // expose for sidebar and other consumers
  populateMonthFilter();
  renderLedger();
  renderTopStrip();
  renderBudgetInputs();
  renderGraphWeekly();
  renderGraphMonthly();
  renderGraphYearly();
  renderGoals();
  renderRecurring();
  renderQuickStats();
  // Refresh secondary views if they exist
  if(typeof renderLedgerFull === 'function') renderLedgerFull();
  if(typeof renderBreakdownBudget === 'function') renderBreakdownBudget();
  if(typeof updateHeaderInsight === 'function') updateHeaderInsight();
  if(typeof updateHeaderPills === 'function') updateHeaderPills();
  // Re-apply active language so dynamic content gets translated
  const _lang = window._finhubLang || (function(){ try{ return localStorage.getItem('finhub_lang'); }catch(e){ return null; } })();
  if(_lang && _lang !== 'en' && window.finhubI18n) {
    requestAnimationFrame(function(){ window.finhubI18n.apply(_lang); });
  }
}

// ── Full Ledger View (standalone ledger page) ──
function populateMonthFilterLedger(){
  const sel = $('monthFilterLedger');
  if(!sel) return;
  const months = Array.from(new Set(transactions.map(t=>monthKey(t.date))));
  const current = new Date().toISOString().slice(0,7);
  if(!months.includes(current)) months.push(current);
  months.sort().reverse();
  const mainSel = $('monthFilter');
  const currentVal = mainSel ? mainSel.value : 'all';
  sel.innerHTML = '';
  const allOpt = document.createElement('option'); allOpt.value='all'; allOpt.textContent='\u{1F4C5} All Months'; sel.appendChild(allOpt);
  months.forEach(m=>{
    const o=document.createElement('option'); o.value=m;
    const d=new Date(m+'-01T00:00:00');
    o.textContent=d.toLocaleString('default',{month:'long',year:'numeric'});
    sel.appendChild(o);
  });
  sel.value = (currentVal && (currentVal==='all' || months.includes(currentVal))) ? currentVal : 'all';
}

function renderLedgerFull(){
  populateMonthFilterLedger();
  const sel = $('monthFilterLedger');
  const selectedMonth = sel ? sel.value : ($('monthFilter') ? $('monthFilter').value : '');
  const query = ($('searchInputLedger')||{value:''}).value.trim().toLowerCase();
  const withBal = computeLedger();
  let filtered = selectedMonth==='all' ? [...withBal] : withBal.filter(t=> monthKey(t.date)===selectedMonth);
  if(query) filtered = filtered.filter(t=>
    t.desc.toLowerCase().includes(query) ||
    t.category.toLowerCase().includes(query) ||
    (t.note||'').toLowerCase().includes(query)
  );
  const body = $('ledgerBodyFull'); if(!body) return;
  body.innerHTML='';
  const emptyFull = $('emptyStateFull');
  if(emptyFull) emptyFull.style.display = filtered.length?'none':'block';
  filtered.forEach(t=>{
    const tr=document.createElement('tr');
    const isExpense = t.amount<0;
    tr.innerHTML = `
      <td class="mono">${t.date}</td>
      <td>
        <div>${t.desc}</div>
        ${t.note ? `<div class="entry-note">📝 ${t.note}</div>` : ''}
      </td>
      <td class="ledger-col-cat"><span class="cat-pill">${t.category}</span></td>
      <td class="num mono amt ${isExpense?'expense':'income'}">${fmt(t.amount)}</td>
      <td class="num mono ledger-col-bal">${fmt(t.balance)}</td>
      <td style="white-space:nowrap;">
        <button class="edit-btn" data-id="${t.id}" title="Edit">✏️</button>
        <button class="del-btn"  data-id="${t.id}" title="Delete">✕</button>
      </td>
    `;
    body.appendChild(tr);
  });
  body.querySelectorAll('.del-btn').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      if(!confirm('Delete this entry?')) return;
      transactions = transactions.filter(t=>t.id!==btn.dataset.id);
      await saveTransactions(); renderAll();
      renderLedgerFull();
      showToast('Entry deleted', 'error');
    });
  });
  body.querySelectorAll('.edit-btn').forEach(btn=>{
    btn.addEventListener('click', ()=> openEditModal(btn.dataset.id));
  });
}

// ── Budget Chart for Budgets view ──
function renderBreakdownBudget(){
  const wrap=$('breakdownBudget');
  const legend=$('breakdownBudgetLegend');
  if(!wrap) return;
  // If the panel is hidden (display:none ancestor) or mid-transition, clientWidth
  // can read as 0 or as a tiny transient value — that used to collapse the plot
  // area to ~0px and cram every label/value/tick on top of each other.
  // Skip rendering entirely while invisible; a later call (on view switch /
  // resize) will draw it correctly once real dimensions are available.
  if(wrap.offsetParent===null) return;
  const rawW = wrap.getBoundingClientRect().width || wrap.clientWidth;
  const padL=fhLabelPad(130), padR=90, padT=10, padB=10;
  const minPlot=120; // never let the plotting area collapse below this
  const w = rawW >= (padL+padR+minPlot) ? rawW : (padL+padR+minPlot);
  const rowH = 24;
  const selectedMonth = $('monthFilter') ? $('monthFilter').value : new Date().toISOString().slice(0,7);
  const monthTx = transactions.filter(t=>monthKey(t.date)===selectedMonth && t.amount<0);
  const totals = {};
  CATEGORIES.forEach(c=>totals[c]=0);
  monthTx.forEach(t=>{ totals[t.category]=(totals[t.category]||0)+Math.abs(t.amount); });
  const h = padT + padB + rowH * CATEGORIES.length;
  const plotW = w - padL - padR;
  const maxVal=Math.max(1,...CATEGORIES.map(c=>Math.max(totals[c]||0,budgets[c]||0)));
  let rows='';
  CATEGORIES.forEach((c,i)=>{
    const spent=totals[c]||0; const limit=budgets[c]||0;
    const y=padT+i*rowH; const barY=y+rowH*0.18; const barH=rowH*0.58;
    const barW=(spent/maxVal)*plotW; const over=limit>0&&spent>limit;
    const color=categoryColor(c);
    const isLight = document.documentElement.dataset.theme === 'light';
    const labelColor = isLight ? '#1e1b4b' : 'var(--charcoal)';
    const valueColor = isLight ? 'rgba(30,27,75,0.72)' : 'var(--muted)';
    rows+=`<text x="${padL-8}" y="${y+rowH*0.65}" font-size="12" fill="${labelColor}" font-family="Source Sans 3,sans-serif" text-anchor="end">${fhCatLabel(c)}</text>`;
    rows+=`<rect x="${padL}" y="${barY}" width="${plotW}" height="${barH}" fill="none" stroke="var(--paper-line)"></rect>`;
    rows+=`<rect x="${padL}" y="${barY}" width="${Math.max(1,barW)}" height="${barH}" fill="${color}" ${over?'stroke="var(--rust)" stroke-width="2"':''}></rect>`;

    rows+=`<text x="${padL+plotW+8}" y="${y+rowH*0.65}" font-size="11" fill="${valueColor}" font-family="Space Mono,monospace">${fmt(-spent)}</text>`;
  });
  wrap.innerHTML=`<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMinYMin meet" xmlns="http://www.w3.org/2000/svg">${rows}</svg>`;
  if(legend) legend.innerHTML=CATEGORIES.map(c=>`<span><span class="swatch" style="background:${categoryColor(c)};"></span>${fhCatLabel(c)}</span>`).join('')
    +`<span><span class="swatch" style="background:none;border:1.5px dashed var(--rust);width:8px;height:8px;"></span><span data-i18n="gs_budget_limit">${(window._finhubT&&window._finhubT.gs_budget_limit)||'Budget limit'}</span></span>`;
}
// Redraw the budget chart whenever its container actually changes size
// (covers: sidebar collapse/expand, window resize, becoming visible again).
if(typeof ResizeObserver!=='undefined'){
  const _bbEl=document.getElementById('breakdownBudget');
  if(_bbEl){
    let _bbRaf=null;
    new ResizeObserver(()=>{
      if(_bbRaf) cancelAnimationFrame(_bbRaf);
      _bbRaf=requestAnimationFrame(()=>renderBreakdownBudget());
    }).observe(_bbEl);
  }
}

// ── Edit Modal ──
function openEditModal(id){
  const t = transactions.find(tx=>tx.id===id);
  if(!t) return;
  $('editId').value   = t.id;
  $('editDesc').value = t.desc;
  $('editAmt').value  = Math.abs(t.amount);
  $('editDate').value = t.date;
  $('editNote').value = t.note||'';
  // set category select
  const sel = $('editCat');
  for(let o of sel.options) o.selected = o.value===t.category;
  $('editModal').classList.add('open');
}
$('editCancelBtn').addEventListener('click',()=>$('editModal').classList.remove('open'));
$('editModal').addEventListener('click',e=>{ if(e.target===$('editModal')) $('editModal').classList.remove('open'); });
$('editSaveBtn').addEventListener('click', async ()=>{
  const id = $('editId').value;
  const idx = transactions.findIndex(t=>t.id===id);
  if(idx<0) return;
  const orig = transactions[idx];
  const amt = parseFloat($('editAmt').value)||0;
  transactions[idx] = {
    ...orig,
    desc: $('editDesc').value.trim()||orig.desc,
    amount: orig.amount<0 ? -Math.abs(amt) : Math.abs(amt),
    category: $('editCat').value,
    note: $('editNote').value.trim(),
    date: $('editDate').value||orig.date,
  };
  await saveTransactions();
  $('editModal').classList.remove('open');
  renderAll();
  showToast('Entry updated ✓', 'success');
});

// ── Savings Goals ──
async function loadGoals(){ try{ const g=localStorage.getItem(userKey('goals')); goals=g?JSON.parse(g):[]; }catch(e){ goals=[]; } }
async function saveGoals(){ try{ localStorage.setItem(userKey('goals'),JSON.stringify(goals)); }catch(e){} }

function renderGoals(){
  const wrap=$('goalsList'); wrap.innerHTML='';
  const tableWrap=document.createElement('div'); tableWrap.className='goals-table-wrap';
  const tbl=document.createElement('table'); tbl.className='goals-table';
  tbl.innerHTML=`<thead><tr>
    <th>Goal Name</th>
    <th>Marychide</th>
    <th class="num">Saved (₹)</th>
    <th class="num">Target (₹)</th>
    <th class="col-progress">Progress</th>
    <th>Deposit</th>
    <th></th>
  </tr></thead>`;
  const tbody=document.createElement('tbody');
  if(!goals.length){
    tbody.innerHTML=`<tr><td colspan="7" style="font-size:12px;color:var(--muted);padding:14px 12px;">No goals yet — add one below.</td></tr>`;
  } else {
    goals.forEach((g,i)=>{
      const pct=Math.min(100,g.target>0?(g.saved/g.target)*100:0);
      const done=g.saved>=g.target&&g.target>0;
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td><strong>${g.name}</strong>${done?` <span class="gt-done-badge">✓ Reached</span>`:''}</td>
        <td class="col-marychide">${g.marychide||'—'}</td>
        <td class="num">${fmt(g.saved)}</td>
        <td class="num">${fmt(g.target)}</td>
        <td class="col-progress">
          <div class="gt-track"><div class="gt-fill ${done?'done':''}" style="width:${pct}%"></div></div>
          <div style="font-size:9px;font-family:var(--font-mono);color:var(--muted);margin-top:2px;">${pct.toFixed(0)}%</div>
        </td>
        <td>${!done?`<div class="gt-deposit">
          <input type="number" class="goal-deposit-input" placeholder="₹" min="0.01" step="0.01" data-idx="${i}">
          <button class="gt-deposit-btn" data-idx="${i}">Save</button>
        </div>`:'<span style="color:var(--brass);font-size:11px;">Complete</span>'}</td>
        <td><button class="goal-del-btn" data-idx="${i}" title="Delete" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;">✕</button></td>
      `;
      tbody.appendChild(tr);
    });
  }
  // tfoot — inline add row
  const tfoot=document.createElement('tfoot');
  tfoot.innerHTML=`<tr>
    <td><input type="text" id="goalName" placeholder="Goal name…"></td>
    <td><input type="text" id="goalMarychide" placeholder="Marychide…"></td>
    <td class="num" colspan="2"><input type="number" id="goalTarget" placeholder="Target ₹" min="0" step="1" style="text-align:right;"></td>
    <td></td>
    <td></td>
    <td><button class="tfoot-add-btn" id="addGoalBtn">+ Add</button></td>
  </tr>`;
  tbl.appendChild(tbody); tbl.appendChild(tfoot);
  tableWrap.appendChild(tbl); wrap.appendChild(tableWrap);

  wrap.querySelectorAll('.goal-del-btn').forEach(btn=>{ btn.addEventListener('click', async ()=>{ goals.splice(parseInt(btn.dataset.idx),1); await saveGoals(); renderGoals(); }); });
  wrap.querySelectorAll('.gt-deposit-btn').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const idx=parseInt(btn.dataset.idx);
      const inp=wrap.querySelector(`.goal-deposit-input[data-idx="${idx}"]`);
      const amt=parseFloat(inp.value);
      if(!amt||amt<=0){ inp.focus(); return; }
      goals[idx].saved=Math.round((goals[idx].saved+amt)*100)/100;
      await saveGoals(); inp.value=''; renderGoals();
      showToast('Deposit saved ✓', 'success');
    });
  });
  document.getElementById('addGoalBtn').addEventListener('click', async ()=>{
    const name=$('goalName').value.trim(); const target=parseFloat($('goalTarget').value);
    const marychide=$('goalMarychide').value.trim();
    if(!name){ $('goalName').focus(); return; }
    if(!target||target<=0){ $('goalTarget').focus(); return; }
    goals.push({name,target,saved:0,marychide}); await saveGoals();
    renderGoals();
    showToast('Goal added ✓', 'success');
  });
}

// ── Recurring Transactions ──
async function loadRecurring(){ try{ const r=localStorage.getItem(userKey('recurring')); recurringItems=r?JSON.parse(r):[]; }catch(e){ recurringItems=[]; } }
async function saveRecurring(){ try{ localStorage.setItem(userKey('recurring'),JSON.stringify(recurringItems)); }catch(e){} }

function renderRecurring(){
  const wrap=$('recurList'); wrap.innerHTML='';
  const tableWrap=document.createElement('div'); tableWrap.className='recur-table-wrap';
  const tbl=document.createElement('table'); tbl.className='recur-table';
  // Build category options
  const catOptions=CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join('');
  tbl.innerHTML=`<thead><tr>
    <th>Name</th>
    <th>Category</th>
    <th>Frequency</th>
    <th>Type</th>
    <th>Marychide</th>
    <th class="num">Amount (₹)</th>
    <th></th>
  </tr></thead>`;
  const tbody=document.createElement('tbody');
  if(!recurringItems.length){
    tbody.innerHTML=`<tr><td colspan="7" style="font-size:12px;color:var(--muted);padding:14px 12px;">No recurring items yet — add one below.</td></tr>`;
  } else {
    recurringItems.forEach((r,i)=>{
      const freqLabel={monthly:'Monthly',weekly:'Weekly',yearly:'Yearly'}[r.freq]||r.freq;
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td class="rt-name">${r.name}</td>
        <td><span class="cat-pill">${r.category}</span></td>
        <td style="font-size:12px;font-family:var(--font-mono);color:var(--muted);">${freqLabel}</td>
        <td><span style="font-size:11px;font-weight:600;color:${r.type==='income'?'var(--sage)':'var(--rust)'};">${r.type==='income'?'Income':'Expense'}</span></td>
        <td class="col-marychide">${r.marychide||'—'}</td>
        <td class="num rt-amt ${r.type}">${r.type==='expense'?'− ':'+ '}${fmt(r.amount)}</td>
        <td><div class="rt-actions">
          <button class="rt-post-btn" data-idx="${i}" title="Post now">Post</button>
          <button class="rt-del-btn" data-idx="${i}" title="Delete">✕</button>
        </div></td>
      `;
      tbody.appendChild(tr);
    });
  }
  // tfoot — inline add row
  const tfoot=document.createElement('tfoot');
  tfoot.innerHTML=`<tr>
    <td><input type="text" id="recurName" placeholder="Name…"></td>
    <td><select id="recurCat">${catOptions}</select></td>
    <td><select id="recurFreq">
      <option value="weekly">Weekly</option>
      <option value="monthly" selected>Monthly</option>
      <option value="yearly">Yearly</option>
    </select></td>
    <td><select id="recurType">
      <option value="expense">Expense</option>
      <option value="income">Income</option>
    </select></td>
    <td><input type="text" id="recurMarychide" placeholder="Marychide…"></td>
    <td class="num"><input type="number" id="recurAmt" placeholder="₹" min="0" step="0.01" style="text-align:right;"></td>
    <td><button class="tfoot-add-btn" id="addRecurBtn">+ Add</button></td>
  </tr>`;
  tbl.appendChild(tbody); tbl.appendChild(tfoot);
  tableWrap.appendChild(tbl); wrap.appendChild(tableWrap);

  wrap.querySelectorAll('.rt-post-btn').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const r=recurringItems[parseInt(btn.dataset.idx)];
      const entry={
        id: Date.now()+Math.random().toString(16).slice(2),
        date: new Date().toISOString().slice(0,10),
        desc: r.name + ' (recurring)',
        category: r.category,
        note: `${r.freq} recurring`,
        amount: r.type==='income'?Math.abs(r.amount):-Math.abs(r.amount)
      };
      transactions.push(entry); await saveTransactions(); renderAll();
      showToast(r.name + ' posted ✓', 'success');
    });
  });
  wrap.querySelectorAll('.rt-del-btn').forEach(btn=>{
    btn.addEventListener('click', async ()=>{ recurringItems.splice(parseInt(btn.dataset.idx),1); await saveRecurring(); renderRecurring(); });
  });
  document.getElementById('addRecurBtn').addEventListener('click', async ()=>{
    const name=$('recurName').value.trim(); const amt=parseFloat($('recurAmt').value);
    const marychide=$('recurMarychide').value.trim();
    if(!name){ $('recurName').focus(); return; }
    if(!amt||amt<=0){ $('recurAmt').focus(); return; }
    recurringItems.push({ name, amount:amt, category:$('recurCat').value, freq:$('recurFreq').value, type:$('recurType').value, marychide });
    await saveRecurring(); renderRecurring();
    showToast('Recurring item added ✓', 'success');
  });
}

// ── Search ──
if($('searchInput')) $('searchInput').addEventListener('input', renderLedger);
if($('searchInputLedger')) $('searchInputLedger').addEventListener('input', renderLedgerFull);

// ── Month filter ──
$('monthFilter').addEventListener('change', ()=>{ renderLedger(); renderTopStrip(); renderQuickStats(); });
// Sync the Ledger-view month filter with the main one
document.addEventListener('change', function(e){
  if(e.target && e.target.id === 'monthFilterLedger'){
    // Mirror to main filter
    const mainSel = $('monthFilter');
    if(mainSel){
      // Check if value exists in main filter (it also has 'all')
      const exists = Array.from(mainSel.options).some(o=>o.value===e.target.value);
      if(exists){ mainSel.value = e.target.value; mainSel.dispatchEvent(new Event('change')); }
    }
    renderLedgerFull();
  }
});

// ── Share / Export / Print / Clear ──
function buildShareText(){
  const selectedMonth=$('monthFilter').value;
  const d=new Date(selectedMonth+"-01T00:00:00");
  const monthLabel=d.toLocaleString('default',{month:'long',year:'numeric'});
  const monthTx=transactions.filter(t=>monthKey(t.date)===selectedMonth).sort((a,b)=>a.date.localeCompare(b.date));
  const spent=monthTx.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
  const income=monthTx.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
  const lines=[`FINHUB — ${monthLabel}`,`Income: ${fmt(income)}   Spent: ${fmt(spent)}`,''];
  if(!monthTx.length) lines.push('No entries this month.');
  else monthTx.forEach(t=>{ const sign=t.amount<0?'-':'+'; lines.push(`${t.date}  ${t.desc} (${t.category})  ${sign}${fmt(Math.abs(t.amount))}`); });
  return lines.join('\n');
}

// Portal dropdown to <body> so overflow:hidden on header/appBody can't clip it
(function(){
  const btn = $('menuBtn');
  const dropdown = $('menuDropdown');
  document.body.appendChild(dropdown);
  dropdown.style.cssText += ';position:fixed;display:none;z-index:99999;';
  function positionDropdown(){
    const r = btn.getBoundingClientRect();
    dropdown.style.top   = (r.bottom + 8) + 'px';
    dropdown.style.right = (window.innerWidth - r.right) + 'px';
    dropdown.style.left  = 'auto';
  }
  function openMenu(){ positionDropdown(); dropdown.style.display='block'; dropdown.classList.add('open'); btn.setAttribute('aria-expanded','true'); }
  window.closeMenu = function(){ dropdown.style.display='none'; dropdown.classList.remove('open'); btn.setAttribute('aria-expanded','false'); };
  function toggleMenu(e){ e.stopPropagation(); dropdown.classList.contains('open') ? closeMenu() : openMenu(); }
  btn.addEventListener('click', toggleMenu);
  window.addEventListener('resize', ()=>{ if(dropdown.classList.contains('open')) positionDropdown(); });
})();

$('shareBtn').addEventListener('click', async ()=>{
  const text=buildShareText(); const selectedMonth=$('monthFilter').value;
  const d=new Date(selectedMonth+"-01T00:00:00"); const title=`FinHub — ${d.toLocaleString('default',{month:'long',year:'numeric'})}`;
  if(navigator.share){ try{ await navigator.share({title,text}); }catch(e){} }
  else if(navigator.clipboard){ try{ await navigator.clipboard.writeText(text); showToast('Ledger copied to clipboard'); }catch(e){ alert(text); } }
  else { alert(text); }
  closeMenu();
});

$('exportCsvBtn').addEventListener('click', ()=>{
  const selectedMonth=$('monthFilter').value;
  const monthTx=transactions.filter(t=>monthKey(t.date)===selectedMonth).sort((a,b)=>a.date.localeCompare(b.date));
  const rows=[['Date','Description','Note','Category','Amount (₹)','Type']];
  monthTx.forEach(t=>rows.push([t.date,'"'+t.desc.replace(/"/g,'""')+'"','"'+(t.note||'').replace(/"/g,'""')+'"',t.category,Math.abs(t.amount).toFixed(2),t.amount>=0?'Income':'Expense']));
  const csv=rows.map(r=>r.join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download=`tally-${selectedMonth}.csv`; a.click(); URL.revokeObjectURL(url);
  closeMenu(); showToast('CSV exported ✓', 'success');
});

$('copySummaryBtn').addEventListener('click', ()=>{
  const selectedMonth=$('monthFilter').value;
  const d=new Date(selectedMonth+'-01T00:00:00');
  const label=d.toLocaleString('default',{month:'long',year:'numeric'});
  const monthTx=transactions.filter(t=>monthKey(t.date)===selectedMonth);
  const income=monthTx.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
  const spent=monthTx.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
  const net=income-spent;
  const savingsPct=income>0?((income-spent)/income*100).toFixed(1):'—';
  const catTotals={}; CATEGORIES.forEach(c=>catTotals[c]=0);
  monthTx.filter(t=>t.amount<0).forEach(t=>{ catTotals[t.category]=(catTotals[t.category]||0)+Math.abs(t.amount); });
  const catLines=CATEGORIES.filter(c=>catTotals[c]>0).map(c=>`  ${c.padEnd(16,' ')}${fmt(catTotals[c])}`);
  const summary=[`📊 FINHUB — ${label}`,`Income  : ${fmt(income)}`,`Spent   : ${fmt(spent)}`,`Net     : ${fmt(net)}`,`Savings : ${savingsPct}%`,catLines.length?`\nBy category:\n${catLines.join('\n')}`:''  ].filter(Boolean).join('\n');
  navigator.clipboard.writeText(summary).then(()=>showToast('Summary copied ✓')).catch(()=>alert(summary));
  closeMenu();
});

$('printBtn').addEventListener('click',()=>{ closeMenu(); window.print(); });

$('clearMonthBtn').addEventListener('click', async ()=>{
  const selectedMonth=$('monthFilter').value;
  const d=new Date(selectedMonth+'-01T00:00:00');
  const label=d.toLocaleString('default',{month:'long',year:'numeric'});
  if(!confirm(`Delete all entries for ${label}? This cannot be undone.`)) return;
  transactions=transactions.filter(t=>monthKey(t.date)!==selectedMonth);
  await saveTransactions(); closeMenu(); renderAll();
  showToast('Month cleared', 'error');
});

document.addEventListener('click', e=>{
  const dropdown=$('menuDropdown');
  if(dropdown.classList.contains('open')&&!dropdown.contains(e.target)&&e.target!==$('menuBtn')) closeMenu();
}, true);

// ── Auth ──
async function getStoredHash(uid){
  // 1. Check localStorage first (fast, offline)
  try {
    const local = localStorage.getItem(`tally:user:${uid}:passhash`);
    if (local) return local;
  } catch(e) {}
  // 2. Fallback: check Supabase cloud (cross-device login)
  if (window._sb && navigator.onLine) {
    try {
      const row = await window._sb.loadUser(uid);
      if (row && row.passhash) {
        // Cache locally for future offline use
        try { localStorage.setItem(`tally:user:${uid}:passhash`, row.passhash); } catch(e) {}
        // Also cache profile
        if (row.name || row.email || row.phone) {
          try {
            const existing = JSON.parse(localStorage.getItem(`tally:user:${uid}:profile`) || '{}');
            if (!existing.name) localStorage.setItem(`tally:user:${uid}:profile`, JSON.stringify({ name: row.name, email: row.email, phone: row.phone }));
          } catch(e) {}
        }
        return row.passhash;
      }
    } catch(e) {}
  }
  return null;
}

async function setStoredHash(uid, hash){
  // Save to localStorage
  try { localStorage.setItem(`tally:user:${uid}:passhash`, hash); } catch(e) {}
  // Save to Supabase for cross-device login
  if (window._sb && navigator.onLine) {
    try {
      const profRaw = localStorage.getItem(`tally:user:${uid}:profile`);
      const profile = profRaw ? JSON.parse(profRaw) : {};
      await window._sb.saveUser(uid, hash, profile);
    } catch(e) {}
  }
}
async function clearUserData(uid){
  ['passhash','transactions','budgets','profile','goals','recurring'].forEach(k=>{ try{ localStorage.removeItem(`tally:user:${uid}:${k}`); }catch(e){} });
}
async function setUserProfile(uid, profile) {
  try { localStorage.setItem(`tally:user:${uid}:profile`, JSON.stringify(profile)); } catch(e) {}
  // Also save to Supabase so other devices get the profile
  if (window._sb && navigator.onLine) {
    try {
      const hash = localStorage.getItem(`tally:user:${uid}:passhash`) || '';
      await window._sb.saveUser(uid, hash, profile);
    } catch(e) {}
  }
}
async function getUserProfile(uid) {
  // 1. Check localStorage first
  try {
    const p = localStorage.getItem(`tally:user:${uid}:profile`);
    if (p) {
      const parsed = JSON.parse(p);
      if (parsed && parsed.name) return parsed; // has name = good
    }
  } catch(e) {}
  // 2. Fallback: fetch from Supabase (cross-device)
  if (window._sb && navigator.onLine) {
    try {
      const row = await window._sb.loadUser(uid);
      if (row && (row.name || row.email || row.phone)) {
        const profile = { name: row.name || '', email: row.email || '', phone: row.phone || '' };
        // Cache locally
        try { localStorage.setItem(`tally:user:${uid}:profile`, JSON.stringify(profile)); } catch(e) {}
        return profile;
      }
    } catch(e) {}
  }
  return {};
}

function renderProfileStrip(profile){
  const strip=$('profileStrip'), avatarEl=$('profileAvatar'), nameEl=$('profileName'),
        idEl=$('headerUserTag'), emailEl=$('profileEmail'), phoneEl=$('profilePhone'),
        sepEmailEl=$('profileSepEmail'), sepPhoneEl=$('profileSepPhone');
  if(!strip || !avatarEl || !nameEl) return;
  const name=(profile&&profile.name)||''; const email=(profile&&profile.email)||''; const phone=(profile&&profile.phone)||'';
  strip.classList.remove('hidden-strip');
  if(name){ const parts=name.trim().split(/\s+/); avatarEl.textContent=parts.length>=2?(parts[0][0]+parts[parts.length-1][0]).toUpperCase():parts[0].slice(0,2).toUpperCase(); }
  else { avatarEl.textContent=currentUserId?currentUserId[0].toUpperCase():'?'; }
  nameEl.textContent=name||currentUserId||'—';
  idEl.textContent=currentUserId?`@${currentUserId}`:'';
  emailEl.textContent=email; phoneEl.textContent=phone;
  if(sepEmailEl) sepEmailEl.classList.toggle('hidden',!email);
  if(sepPhoneEl) sepPhoneEl.classList.toggle('hidden',!(email&&phone)&&!(!email&&phone));
}

function updateHeaderGreeting(userName){
  const now = new Date();
  const h = now.getHours();
  // Get current language translations
  const T = window._finhubT || {};
  // Use translated greetings if available, otherwise fall back to English
  const greetings = {
    morning: T.greeting_morning || 'Good morning',
    afternoon: T.greeting_afternoon || 'Good afternoon',
    evening: T.greeting_evening || 'Good evening',
    night: T.greeting_night || 'Good night'
  };
  const greeting = h < 12 ? greetings.morning : h < 17 ? greetings.afternoon : h < 21 ? greetings.evening : greetings.night;
  const _LOC={hi:'hi-IN',ta:'ta-IN',te:'te-IN',ml:'ml-IN',kn:'kn-IN'};
  const _loc=_LOC[window._finhubLang]||'en-US';
  const dayNames = [0,1,2,3,4,5,6].map(i=>new Date(2023,0,1+i).toLocaleDateString(_loc,{weekday:'long'}));
  const monthNames = [0,1,2,3,4,5,6,7,8,9,10,11].map(i=>new Date(2023,i,1).toLocaleDateString(_loc,{month:'long'}));
  const el = id => document.getElementById(id);
  if(userName !== undefined) window._greetingUser = userName;
  const user = (window._greetingUser !== undefined && window._greetingUser !== null) ? window._greetingUser : '';
  if(el('headerGreetingName')) {
    const firstName = user ? user.split(' ')[0] : '';
    if(firstName) {
      el('headerGreetingName').innerHTML = greeting + ', <span class="greeting-username">' + firstName + '</span>.';
    } else {
      el('headerGreetingName').textContent = greeting + '.';
    }
  }
  // Use translated "household ledger" text
  if(el('headerGreetingLine')) el('headerGreetingLine').textContent = T.header_greeting || 'Your household ledger';
  if(el('headerGreetingMonth')) el('headerGreetingMonth').textContent = monthNames[now.getMonth()] + ' ' + now.getFullYear();
  if(el('headerDateDay')) el('headerDateDay').textContent = now.getDate();
  if(el('headerDateLabel')) el('headerDateLabel').textContent = dayNames[now.getDay()];
  if(el('headerDateMonth')) el('headerDateMonth').textContent = now.toLocaleString(_loc==='en-US'?'default':_loc,{month:'long',year:'numeric'});
}
setInterval(() => updateHeaderGreeting(), 60000);
document.addEventListener('DOMContentLoaded', () => updateHeaderGreeting());

async function startApp(){
  currentUserId = window.currentUserId;
  $('loginOverlay').classList.add('hidden');
  $('appShell').classList.remove('hidden');
  $('fDate').value=new Date().toISOString().slice(0,10);
  populateCategorySelect();

  // Show name INSTANTLY from cache — before any async wait
  try {
    const cached = JSON.parse(localStorage.getItem(`tally:user:${currentUserId}:profile`) || '{}');
    const earlyName = cached.name || (currentUserId ? currentUserId.charAt(0).toUpperCase() + currentUserId.slice(1) : '');
    updateHeaderGreeting(earlyName);
  } catch(e) { updateHeaderGreeting(''); }
  // Also update sidebar bottom strip instantly
  if(typeof updateSbUser === 'function') updateSbUser(); else {
    const sbA = document.getElementById('sbAvatar'), sbN = document.getElementById('sbUserName');
    try {
      const cached = JSON.parse(localStorage.getItem(`tally:user:${currentUserId}:profile`) || '{}');
      const n = (cached && cached.name) ? cached.name : currentUserId;
      if(sbA) sbA.textContent = n ? n[0].toUpperCase() : '?';
      if(sbN) sbN.textContent = n || '—';
    } catch(e) {}
  }

  await loadData();
  window.transactions = transactions;

  const profile = await getUserProfile(currentUserId);
  renderProfileStrip(profile);
  const displayName = (profile && profile.name) ? profile.name : (currentUserId ? currentUserId.charAt(0).toUpperCase() + currentUserId.slice(1) : '');
  updateHeaderGreeting(displayName);

  // Update sidebar user strip with real profile name (after Supabase fetch)
  const sbA = document.getElementById('sbAvatar'), sbN = document.getElementById('sbUserName');
  if(sbA) sbA.textContent = displayName ? displayName[0].toUpperCase() : '?';
  if(sbN) sbN.textContent = displayName || currentUserId || '—';

  renderAll();
  if(typeof updateHeaderInsight === 'function') updateHeaderInsight();
  showToast('Welcome back' + (displayName ? ', ' + displayName : '') + ' 👋', 'success');
  setTimeout(() => updateHeaderGreeting(), 50);
}

function resetAuthForms(){
  _setUID(null);
  switchAuthTab('signin');
  ['suUserId','suPass','suPassConfirm','suFullName','suEmail','suPhone','siUserId','siPass'].forEach(id=>{ if($(id)) $(id).value=''; });
  $('suError').textContent=''; $('siError').textContent='';
  const strip=$('profileStrip'); if(strip) strip.classList.add('hidden-strip');
  const idEl=$('headerUserTag'); if(idEl) idEl.textContent='—';
}

async function handleSignUp(e){
  e.preventDefault();
  const err=$('suError'); err.textContent='';
  const uid=sanitizeUserId($('suUserId').value); const pass=$('suPass').value; const confirmPass=$('suPassConfirm').value;
  const name=$('suFullName').value.trim(); const email=$('suEmail').value.trim(); const phone=$('suPhone').value.trim();
  if(!name){ err.textContent='Please enter your full name.'; return; }
  if(!uid){ err.textContent='Enter a User ID (letters, numbers, . _ -).'; return; }
  if(pass.length<4){ err.textContent='Password must be at least 4 characters.'; return; }
  if(pass!==confirmPass){ err.textContent='Passwords do not match.'; return; }
  const existingHash=await getStoredHash(uid);
  if(existingHash){ err.textContent='That User ID is already taken — sign in instead.'; return; }
  const hash=await sha256Hex(pass);
  await setStoredHash(uid,hash); await setUserProfile(uid,{name,email,phone});
  _setUID(uid); await startApp();
}

async function handleSignIn(e){
  e.preventDefault();
  const err=$('siError'); err.textContent='';
  const uid=sanitizeUserId($('siUserId').value); const pass=$('siPass').value;
  if(!uid){ err.textContent='Enter your User ID.'; return; }
  if(!pass){ err.textContent='Enter your password.'; return; }
  const existingHash=await getStoredHash(uid);
  if(!existingHash){ err.textContent='No account with that User ID — sign up first.'; return; }
  const hash=await sha256Hex(pass);
  if(hash===existingHash){ _setUID(uid); await startApp(); }
  else { err.textContent='Incorrect password.'; $('siPass').value=''; }
}

function switchAuthTab(which){
  const isSignin=which==='signin';
  $('panelSignin').classList.toggle('login-panel-active',isSignin); $('panelSignin').hidden=!isSignin;
  $('panelSignup').classList.toggle('login-panel-active',!isSignin); $('panelSignup').hidden=isSignin;
  $('tabSignIn').classList.toggle('login-tab-active',isSignin); $('tabSignIn').setAttribute('aria-selected',isSignin?'true':'false');
  $('tabSignUp').classList.toggle('login-tab-active',!isSignin); $('tabSignUp').setAttribute('aria-selected',isSignin?'false':'true');
  if($('loginHeading')) $('loginHeading').textContent=isSignin?'Welcome back.':'Open a new ledger.';
  $('siError').textContent=''; $('suError').textContent='';
}

let _authInited = false;
function initAuth(){
  resetAuthForms();
  if(!_authInited){
    _authInited = true;
    $('signUpForm').addEventListener('submit',handleSignUp);
    $('signInForm').addEventListener('submit',handleSignIn);
    $('forgotLink').addEventListener('click', async ()=>{
      const uid=sanitizeUserId($('siUserId').value);
      if(!uid){ $('siError').textContent='— Enter your User ID first.'; return; }
      const existingHash=await getStoredHash(uid);
      if(!existingHash){ $('siError').textContent='— No account with that User ID.'; return; }
      if(confirm(`This clears the password and all data for "${uid}" on this device. Continue?`)){ await clearUserData(uid); resetAuthForms(); }
    });
  }
}

$('menuLogoutBtn').addEventListener('click', ()=>{
  closeMenu();
  $('appShell').classList.add('hidden');
  window._greetingUser = undefined;
  resetAuthForms();
  if(typeof initAuth === 'function') initAuth();
  const lo = $('loginOverlay');
  if(lo){
    lo.classList.remove('hidden');
    const loginCard = lo.querySelector('.ad-card');
    if(loginCard){ loginCard.classList.remove('ad-animate'); void loginCard.offsetWidth; loginCard.classList.add('ad-animate'); }
  }
  showToast('Logged out');
});

// ── Sparkline + Insight Panel ──
function updateHeaderInsight(){
  try {
    const now = new Date();
    // Use the same month the user has selected, not UTC now
    const selEl = $('monthFilter');
    const monthKey7 = (selEl && selEl.value && selEl.value !== 'all')
      ? selEl.value
      : `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    // Last 7 days buckets using LOCAL dates (not UTC)
    const buckets = [];
    for(let i=6;i>=0;i--){
      const d=new Date(now); d.setDate(d.getDate()-i);
      const localDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      buckets.push({ date: localDate, net: 0 });
    }
    const monthTx = (window.transactions||[]).filter(t=>t.date.slice(0,7)===monthKey7);
    monthTx.forEach(t=>{
      const b=buckets.find(b=>b.date===t.date);
      if(b) b.net += t.amount;
    });
    // Cumulative for sparkline
    let cum=0; const cums=buckets.map(b=>{ cum+=b.net; return cum; });
    const mn=Math.min(...cums), mx=Math.max(...cums);
    const range=mx-mn||1;
    const H=36, W=90, pad=4;
    const pts=cums.map((v,i)=>{
      const x=(i/(cums.length-1))*(W-pad*2)+pad;
      const y=H-pad-(((v-mn)/range)*(H-pad*2));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const line=$('headerSparklineLine');
    const fill=$('headerSparklineFill');
    if(line){ line.setAttribute('points', pts); }
    if(fill){ fill.setAttribute('points', pts+` ${W-pad},${H} ${pad},${H}`); }

    // Color based on trend
    const isDark = document.documentElement.getAttribute('data-theme')!=='light';
    const trendColor = cum>=0 ? (isDark?'#4ade80':'#059669') : (isDark?'#f87171':'#dc2626');
    if(line) line.setAttribute('stroke', trendColor);
    // Update gradient fill color too
    const grad = document.getElementById('sparkGrad');
    if(grad){
      grad.querySelectorAll('stop').forEach((s,i)=>{ if(i===0) s.setAttribute('stop-color', trendColor); else s.setAttribute('stop-color', trendColor); });
    }
    if(fill) fill.setAttribute('fill', 'url(#sparkGrad)');

    // Net KPI
    const netEl=$('headerInsightNet');
    const subEl=$('headerInsightSub');
    if(netEl){
      const income=monthTx.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
      const spent=monthTx.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
      const net=income-spent;
      netEl.textContent=`${net>=0?'':'-'}₹${Math.abs(net).toFixed(0)}`;
      netEl.className='header-insight-kpi-val'+(net<0?' neg':'');
      if(subEl){
        const txCount=monthTx.length;
        subEl.textContent=txCount>0?`${txCount} entr${txCount===1?'y':'ies'} this month`:'no entries yet';
      }
    }
  } catch(e){}
}

// ── Theme ──
function getSavedTheme(){ try{ const t=localStorage.getItem('tally:theme'); return t||'light'; }catch(e){ return 'light'; } }
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme',theme==='dark'?'dark':'light');
  const label=theme==='dark'?'☀️ White':'🌙 Dark';
  const tb=$('themeToggle'); if(tb) tb.textContent=label;
  // Update sparkline colors after theme change
  setTimeout(updateHeaderInsight, 50);
}
function toggleTheme(){ const next=getSavedTheme()==='dark'?'light':'dark'; try{ localStorage.setItem('tally:theme',next); }catch(e){} applyTheme(next); }
// Dark mode is the default for this build
applyTheme(getSavedTheme());
$('themeToggle').addEventListener('click',toggleTheme);

// ── Header Month Strip ──
function updateHeaderPills(){
  try {
    const now = new Date();
    const totalDays = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    const elapsed = now.getDate();
    const pct = Math.round((elapsed / totalDays) * 100);
    const daysLeft = totalDays - elapsed;

    const fill = document.getElementById('hmsBarFill');
    const glow = document.getElementById('hmsBarGlow');
    const pctEl = document.getElementById('hmsPct');
    const lblEl = document.getElementById('hmsLabel');

    if(fill) fill.style.width = pct + '%';
    if(glow) glow.style.right = (100 - pct) + '%';
    if(pctEl) pctEl.textContent = pct + '%';
    if(lblEl) lblEl.textContent = daysLeft === 0 ? 'last day of month' : daysLeft + ' days remaining';
  } catch(e){}
}

// ── Navigate to login ──
function homeToLogin(){
  if(typeof initAuth === 'function') initAuth();
  const lo = $('loginOverlay');
  if(lo) lo.classList.remove('hidden');
}

// ── Logout goes back to home ──
$('menuLogoutBtn').removeEventListener && null; // already bound above


// ── PDF Export ──
function buildPdfHtml(scope){
  const selectedMonth = $('monthFilter').value;
  const d = new Date(selectedMonth+'-01T00:00:00');
  const monthLabel = d.toLocaleString('default',{month:'long',year:'numeric'});

  let txList = scope === 'all'
    ? [...transactions].sort((a,b)=>a.date.localeCompare(b.date))
    : transactions.filter(t=>monthKey(t.date)===selectedMonth).sort((a,b)=>a.date.localeCompare(b.date));

  const income = txList.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
  const spent  = txList.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
  const net    = income - spent;

  const CATS = [...new Set(txList.filter(t=>t.amount<0).map(t=>t.category))];
  const catRows = CATS.map(c=>{
    const total = txList.filter(t=>t.amount<0&&t.category===c).reduce((s,t)=>s+Math.abs(t.amount),0);
    return `<tr><td>${c}</td><td style="text-align:right">₹${total.toFixed(2)}</td></tr>`;
  }).join('');

  const txRows = txList.map(t=>`
    <tr>
      <td>${t.date}</td>
      <td>${t.desc}${t.note?`<br><small style="color:#888">${t.note}</small>`:''}</td>
      <td>${t.category}</td>
      <td style="text-align:right;color:${t.amount>=0?'#059669':'#DC2626'};font-weight:600">
        ${t.amount>=0?'+':''}₹${Math.abs(t.amount).toFixed(2)}
      </td>
    </tr>`).join('');

  const title = scope==='all' ? 'Full Ledger' : monthLabel;
  const summarySection = scope==='summary' ? '' : `
    <h3>Transactions</h3>
    <table>
      <thead><tr><th>Date</th><th>Description</th><th>Category</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${txRows}</tbody>
    </table>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>FinHub — ${title}</title>
  <style>@page { margin: 0; size: A4; } html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }</style>
<style>
/* Dark mode login — labels and inputs match white theme purple */
html[data-theme="dark"] .login-label { color: rgba(167,139,250,0.75) !important; }
html[data-theme="dark"] .login-input { border-color: rgba(167,139,250,0.75) !important; }
html[data-theme="dark"] .login-input:focus { border-color: #7c3aed !important; box-shadow: 0 0 0 3px rgba(124,58,237,0.2) !important; }
html[data-theme="dark"] .login-input::placeholder { color: rgba(167,139,250,0.35) !important; }
</style>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Source+Sans+3:wght@300;400;600&family=Space+Mono&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Source Sans 3', sans-serif; color: #111; padding: 40px 48px; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #7C3AED; padding-bottom: 14px; margin-bottom: 24px; }
    .brand { font-family: 'Cormorant Garamond', serif; font-size: 32px; font-weight: 700; color: #7C3AED; }
    .brand span { color: #d4a017; }
    .meta { text-align: right; color: #555; font-size: 12px; line-height: 1.6; }
    h3 { font-family: 'Cormorant Garamond', serif; font-size: 18px; font-weight: 600; margin: 24px 0 10px; color: #1a1a2e; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .summary-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-bottom: 24px; }
    .summary-card { background: #f9f7ff; border: 1px solid #ede9fe; border-radius: 8px; padding: 14px 16px; }
    .summary-card .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
    .summary-card .val { font-family: 'Space Mono', monospace; font-size: 18px; font-weight: 700; }
    .val.inc { color: #059669; } .val.exp { color: #DC2626; } .val.net { color: #7C3AED; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #f5f3ff; color: #555; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; padding: 8px 10px; text-align: left; }
    td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    @media print { body { padding: 20px 28px; } @page { margin: 0; size: A4; } }
  </style>
<style>
/* Dark mode login — labels and inputs match white theme purple */
html[data-theme="dark"] .login-label { color: rgba(167,139,250,0.75) !important; }
html[data-theme="dark"] .login-input { border-color: rgba(167,139,250,0.75) !important; }
html[data-theme="dark"] .login-input:focus { border-color: #7c3aed !important; box-shadow: 0 0 0 3px rgba(124,58,237,0.2) !important; }
html[data-theme="dark"] .login-input::placeholder { color: rgba(167,139,250,0.35) !important; }
</style></head><body>
  <div class="header">
    <div class="brand">FinHub</div>
    <div class="meta">
      <div><strong>${title}</strong></div>
      <div>Generated ${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</div>
      <div>User: ${currentUserId||'—'}</div>
    </div>
  </div>
  <h3>Summary</h3>
  <div class="summary-grid">
    <div class="summary-card"><div class="label">Income</div><div class="val inc">₹${income.toFixed(2)}</div></div>
    <div class="summary-card"><div class="label">Spent</div><div class="val exp">₹${spent.toFixed(2)}</div></div>
    <div class="summary-card"><div class="label">Net</div><div class="val net">₹${net.toFixed(2)}</div></div>
  </div>
  ${catRows ? `<h3>By Category</h3><table><thead><tr><th>Category</th><th style="text-align:right">Total</th></tr></thead><tbody>${catRows}</tbody></table>` : ''}
  ${summarySection}
</body></html>`;
}

$('exportPdfBtn').addEventListener('click', ()=>{
  closeMenu();
  $('pdfOverlay').classList.add('active');
});

$('pdfCancelBtn').addEventListener('click', ()=>{
  $('pdfOverlay').classList.remove('active');
});

$('pdfGenerateBtn').addEventListener('click', ()=>{
  const scope = document.querySelector('input[name="pdfScope"]:checked').value;
  const html = buildPdfHtml(scope);
  const frame = $('pdfPrintFrame');
  frame.srcdoc = html;
  $('pdfOverlay').classList.remove('active');
  frame.onload = ()=>{
    setTimeout(()=>{
      frame.contentWindow.focus();
      frame.contentWindow.print();
    }, 300);
  };
});

$('pdfOverlay').addEventListener('click', e=>{
  if(e.target === $('pdfOverlay')) $('pdfOverlay').classList.remove('active');
});

// ── Home page ticker ──
(function initHomeTicker(){
  const tickerData = [
    { date:'01 Sep', desc:'Monthly Salary', sub:'Income', amt:'+₹52,000', type:'inc' },
    { date:'02 Sep', desc:'Rent – Housing', sub:'Housing', amt:'−₹14,500', type:'exp' },
    { date:'03 Sep', desc:'DMart Groceries', sub:'Food', amt:'−₹2,340', type:'exp' },
    { date:'04 Sep', desc:'Electricity Bill', sub:'Utilities', amt:'−₹1,820', type:'exp' },
    { date:'05 Sep', desc:'Freelance Project', sub:'Income', amt:'+₹8,000', type:'inc' },
    { date:'06 Sep', desc:'Jio Recharge', sub:'Utilities', amt:'−₹299', type:'exp' },
    { date:'07 Sep', desc:'Dinner – Zomato', sub:'Food', amt:'−₹640', type:'exp' },
    { date:'08 Sep', desc:'Petrol – BPCL', sub:'Transport', amt:'−₹1,200', type:'exp' },
    { date:'09 Sep', desc:'Netflix + Hotstar', sub:'Leisure', amt:'−₹649', type:'exp' },
    { date:'10 Sep', desc:'Medicine – Apollo', sub:'Medical', amt:'−₹450', type:'exp' },
    { date:'11 Sep', desc:'Kids School Fees', sub:'Education', amt:'−₹3,500', type:'exp' },
    { date:'12 Sep', desc:'SIP – Mutual Fund', sub:'Investment', amt:'−₹5,000', type:'exp' },
  ];

  const inner = document.getElementById('homeTickerInner');
  if(!inner) return;

  function makeRows(data){
    return data.map(r => `
      <div class="home-ticker-row ${r.type}">
        <span class="tkr-date">${r.date}</span>
        <span class="tkr-desc">${r.desc}<small>${r.sub}</small></span>
        <span class="tkr-amt">${r.amt}</span>
      </div>`).join('');
  }

  // Double for seamless loop
  const html = makeRows(tickerData) + makeRows(tickerData);
  inner.innerHTML = html;

  // Set animation duration based on row count
  const rowH = 46; // px per row approx
  const totalH = tickerData.length * rowH;
  inner.style.setProperty('--ticker-h', totalH + 'px');
})();

// ── Sidebar ──
(function initSidebar(){
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sbToggleBtn');
  const openBtn = document.getElementById('sbOpenBtn');
  const overlay = document.getElementById('sbMobileOverlay');

  // Collapse/expand (desktop)
  toggleBtn.addEventListener('click', ()=>{
    sidebar.classList.toggle('collapsed');
    toggleBtn.title = sidebar.classList.contains('collapsed') ? 'Expand sidebar' : 'Collapse sidebar';
  });

  // Mobile open/close
  if(openBtn) openBtn.addEventListener('click', ()=>{
    sidebar.classList.add('mobile-open');
    overlay.classList.add('active');
  });
  overlay.addEventListener('click', ()=>{
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('active');
  });

  // Section navigation
  function closeMobileSidebar(){ sidebar.classList.remove('mobile-open'); overlay.classList.remove('active'); }

  // ── View switching ──
  const viewMap = [
    { id: 'sbNavDashboard', view: 'dashboard' },
    { id: 'sbNavLedger',    view: 'ledger'    },
    { id: 'sbNavBudgets',   view: 'budgets'   },
    { id: 'sbNavGoals',     view: 'goals'     },
  ];
  const allViews = ['dashboard','ledger','budgets','goals','recurring','charts'];
  const allNavBtns = viewMap.map(n => document.getElementById(n.id)).filter(Boolean);

  function switchView(viewName) {
    // Show/hide view panels
    allViews.forEach(v => {
      const el = document.getElementById('view-' + v);
      if(el) el.classList.toggle('hidden', v !== viewName);
    });
    // Scroll to top of content
    const appBody = document.getElementById('appBody');
    if(appBody) appBody.scrollTop = 0;
    // Re-render dashboard when switching to it (Recent Entries, Spend by Category, Quick Stats)
    if(viewName === 'dashboard') {
      requestAnimationFrame(() => {
        renderLedger(); renderTopStrip(); renderQuickStats();
      });
    }
    // Re-render charts when switching to charts view (needs clientWidth)
    if(viewName === 'charts') {
      requestAnimationFrame(() => {
        renderGraphWeekly(); renderGraphMonthly(); renderGraphYearly();
      });
    }
    // Re-render breakdown when switching to budgets
    if(viewName === 'budgets') {
      try { if(typeof renderBudgetInputs === 'function') renderBudgetInputs(); } catch(e) {}
      setTimeout(() => renderBreakdownBudget(), 60);
    }
    // Sync the full ledger view
    if(viewName === 'ledger') {
      requestAnimationFrame(() => renderLedgerFull());
    }
    // Auto-collapse sidebar for ledger + budgets fullscreen, restore for others
    const sidebar = document.getElementById('sidebar');
    if(sidebar) {
      if(viewName === 'ledger' || viewName === 'budgets') {
        sidebar.classList.add('collapsed');
        sidebar._autoCollapsed = true;
      } else if(sidebar._autoCollapsed) {
        sidebar.classList.remove('collapsed');
        sidebar._autoCollapsed = false;
      }
    }
    // Re-apply active language after view renders
    const _lang = window._finhubLang || (function(){ try{ return localStorage.getItem('finhub_lang'); }catch(e){ return null; } })();
    if(_lang && _lang !== 'en' && window.finhubI18n) {
      setTimeout(function(){ window.finhubI18n.apply(_lang); }, 80);
    }
  }

  window.switchView = switchView;

  viewMap.forEach(({ id, view }) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', () => {
      allNavBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      closeMobileSidebar();
      switchView(view);
    });
  });

  // Charts button — opens fullscreen Graph Sheet
  const chartsBtn = document.getElementById('sbNavCharts');
  if(chartsBtn) chartsBtn.addEventListener('click', () => {
    closeMobileSidebar();
    if(window.openGraphSheet) window.openGraphSheet();
  });

  // New Entry button — go to dashboard and focus amount
  document.getElementById('sbNewEntryBtn').addEventListener('click', ()=>{
    closeMobileSidebar();
    // Switch to dashboard view first
    allNavBtns.forEach(b => b.classList.remove('active'));
    const dashBtn = document.getElementById('sbNavDashboard');
    if(dashBtn) dashBtn.classList.add('active');
    switchView('dashboard');
    setTimeout(() => {
      const amtEl = document.getElementById('fAmount');
      if(amtEl){ amtEl.focus(); }
    }, 80);
  });

  // Sidebar quick-access for logout
  document.getElementById('sbLogout').addEventListener('click', ()=>{
    closeMobileSidebar();
    document.getElementById('menuLogoutBtn').click();
  });

  // Populate recent months — store month value in a closure, no data attributes
  function renderSbMonths(){
    const list = document.getElementById('sbMonthList');
    if(!list) return;
    const months = [...new Set((window.transactions||[]).map(t=>t.date.slice(0,7)))].sort((a,b)=>b.localeCompare(a)).slice(0,6);
    if(!months.length){ list.innerHTML = '<div style="font-size:12px;color:rgba(255,255,255,0.25);padding:4px 16px;">No entries yet</div>'; return; }
    list.innerHTML = '';
    months.forEach(m => {
      const d = new Date(m+'-01T00:00:00');
      const label = d.toLocaleString('default',{month:'long',year:'numeric'});
      const btn = document.createElement('button');
      btn.className = 'sb-nav-item';
      btn.style.fontSize = '12.5px';
      btn.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.22);flex-shrink:0;display:inline-block;"></span><span class="sb-nav-text">${label}</span>`;
      btn.addEventListener('click', () => {
        const mf = document.getElementById('monthFilter');
        if(mf){ mf.value = m; mf.dispatchEvent(new Event('change')); }
        document.getElementById('ledgerBody').scrollIntoView({behavior:'smooth', block:'start'});
        closeMobileSidebar();
      });
      list.appendChild(btn);
    });
  }

  // Update sidebar user info — show real name instantly from cache
  function updateSbUser(){
    const uid = window.currentUserId || '';
    const sbAvatar = document.getElementById('sbAvatar');
    const sbName = document.getElementById('sbUserName');
    // Try to get real name from localStorage immediately (no async wait)
    let displayName = uid;
    try {
      const cached = JSON.parse(localStorage.getItem(`tally:user:${uid}:profile`) || '{}');
      if(cached && cached.name) displayName = cached.name;
    } catch(e){}
    const firstName = displayName ? displayName.split(' ')[0] : (uid || '—');
    if(sbAvatar) sbAvatar.textContent = firstName ? firstName[0].toUpperCase() : '?';
    if(sbName) sbName.textContent = displayName || uid || '—';
  }

  // Hook into renderAll to refresh sidebar months
  const origRenderAll = window.renderAll;
  if(typeof origRenderAll === 'function'){
    window.renderAll = function(){
      origRenderAll.apply(this, arguments);
      renderSbMonths();
      updateSbUser();
    };
  }

  // Also poll until transactions are populated (not just defined)
  const poll = setInterval(()=>{
    if(window.transactions && window.transactions.length > 0){
      clearInterval(poll);
      renderSbMonths();
      updateSbUser();
    }
  }, 300);
})();

// ══════════════════════════════════════════════════════
//  PWA: Service Worker + Install Prompt + Offline Toast
// ══════════════════════════════════════════════════════
(function initPWA() {

  // ── 1. Register Service Worker via Blob URL ─────────
  const CACHE_NAME = 'finhub-v1';

  const swCode = `
const CACHE = '${CACHE_NAME}';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first for same-origin, network-only for external (fonts, etc.)
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 408 })));
    return;
  }
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const network = fetch(e.request).then(resp => {
          if (resp && resp.status === 200) cache.put(e.request, resp.clone());
          return resp;
        }).catch(() => cached);
        return cached || network;
      })
    )
  );
});
`;

  if ('serviceWorker' in navigator) {
    const blob = new Blob([swCode], { type: 'application/javascript' });
    const swUrl = URL.createObjectURL(blob);
    navigator.serviceWorker.register(swUrl, { scope: './' })
      .then(reg => {
        console.log('[FinHub PWA] Service worker registered');
        // Cache the app HTML itself so it works offline
        if ('caches' in window) {
          caches.open(CACHE_NAME).then(c => c.add(location.href).catch(() => {}));
        }
      })
      .catch(err => console.warn('[FinHub PWA] SW failed:', err));
  }

  // ── 2. Install Banner (Android / Desktop Chrome) ────
  let deferredPrompt = null;
  const banner     = document.getElementById('pwaInstallBanner');
  const installBtn = document.getElementById('pwaInstallBtn');
  const dismissBtn = document.getElementById('pwaDismissBtn');

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone;
  const dismissed = localStorage.getItem('pwa_banner_dismissed');

  if (!isStandalone && !dismissed) {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredPrompt = e;
      setTimeout(() => banner && banner.classList.add('show'), 4500);
    });
  }

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      banner.classList.remove('show');
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (outcome === 'accepted') localStorage.setItem('pwa_banner_dismissed', '1');
      }
    });
  }

  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      banner.classList.remove('show');
      localStorage.setItem('pwa_banner_dismissed', '1');
    });
  }

  // ── 3. iOS Safari tip ──────────────────────────────
  const isIos     = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari  = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const iosTipDismissed = localStorage.getItem('pwa_ios_tip_dismissed');
  const iosTip      = document.getElementById('pwaIosTip');
  const iosTipClose = document.getElementById('pwaIosTipClose');

  if (isIos && isSafari && !isStandalone && !iosTipDismissed) {
    setTimeout(() => iosTip && iosTip.classList.add('show'), 4500);
  }
  if (iosTipClose) {
    iosTipClose.addEventListener('click', () => {
      iosTip.classList.remove('show');
      localStorage.setItem('pwa_ios_tip_dismissed', '1');
    });
  }

  // ── 4. Offline / Online toasts ─────────────────────
  const offlineToast = document.getElementById('pwaOfflineToast');
  const onlineToast  = document.getElementById('pwaOnlineToast');

  function showToast(el, ms) {
    if (!el) return;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), ms);
  }

  window.addEventListener('offline', () => showToast(offlineToast, 4000));
  window.addEventListener('online',  () => showToast(onlineToast,  3000));

})();

/* ===== guest-login.js ===== */
// ── Guest Login Handler ──
async function handleGuestLogin() {
  const GUEST_ID = 'guest';
  const GUEST_PASS = 'guest-local-only';
  let hash = await getStoredHash(GUEST_ID);
  if (!hash) {
    hash = await sha256Hex(GUEST_PASS);
    await setStoredHash(GUEST_ID, hash);
  }
  // Always ensure guest profile has a name
  const existingProfile = await getUserProfile(GUEST_ID);
  if (!existingProfile || !existingProfile.name) {
    await setUserProfile(GUEST_ID, { name: 'Guest', email: '', phone: '' });
  }
  window._greetingUser = undefined;
  _setUID(GUEST_ID);
  await startApp();
}

// ═══════════════════════════════════════════════════════
//  SPLASH SCREEN — Logo animation, NO sound
// ═══════════════════════════════════════════════════════
(function runSplash(){
  const bar = document.getElementById('splashBarFill');
  const txt = document.getElementById('splashLoadingText');
  const msgs = [
    'Opening the Ledger…',
    'Loading your data…',
    'Almost ready…',
    'Welcome to FinHub!'
  ];
  let progress = 0;
  let msgIdx = 0;

  const interval = setInterval(() => {
    progress += Math.random() * 8 + 4; // ~1.5 seconds
    if (progress > 100) progress = 100;
    if (bar) bar.style.width = progress + '%';

    const newIdx = Math.min(Math.floor(progress / 26), msgs.length - 1);
    if (newIdx !== msgIdx) {
      msgIdx = newIdx;
      if (txt) txt.textContent = msgs[msgIdx];
    }

    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        if (splash) {
          splash.classList.add('fade-out');
          setTimeout(() => {
            splash.classList.add('hidden');
            const hp = document.getElementById('homePage');
            if (hp) hp.style.display = 'none';
            if (typeof initAuth === 'function') initAuth();
            const lo = document.getElementById('loginOverlay');
            if (lo) {
              lo.classList.remove('hidden');
              const loginCard = lo.querySelector('.ad-card');
              if (loginCard) {
                loginCard.classList.remove('ad-animate');
                void loginCard.offsetWidth;
                loginCard.classList.add('ad-animate');
              }
            }
          }, 900);
        }
      }, 400);
    }
  }, 150); // ~1.5s fill + 0.4s wait + 0.9s fade = ~2.8s total
})();

// ── Orbit Canvas Animation ──
(function initOrbitCanvas(){
  const canvas = document.getElementById('splashOrbitCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, cx, cy, raf;
  let t = 0;

  function resize(){
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    cx = W/2; cy = H/2;
  }
  resize();
  window.addEventListener('resize', resize);

  const rings = [
    { r:210, speed:0.004,  tilt:12,  color:'rgba(212,160,23,',  dash:[18,10], width:1.2, glowColor:'rgba(212,160,23,0.35)' },
    { r:175, speed:-0.007, tilt:-20, color:'rgba(64,145,108,',  dash:[6,14],  width:0.8, glowColor:'rgba(64,145,108,0.25)' },
    { r:245, speed:0.0025, tilt:30,  color:'rgba(212,160,23,',  dash:[2,20],  width:0.6, glowColor:'rgba(212,160,23,0.15)' },
    { r:145, speed:-0.012, tilt:-8,  color:'rgba(167,139,250,', dash:[10,8],  width:0.7, glowColor:'rgba(167,139,250,0.2)' },
  ];

  const stars = Array.from({length:12}, ()=>({
    x: Math.random()*800-400,
    y: Math.random()*600-300,
    r: Math.random()*0.6+0.2,
    twinkle: Math.random()*Math.PI*2,
    speed: Math.random()*0.02+0.008
  }));

  function drawStars(time){
    stars.forEach(s => {
      s.twinkle += s.speed;
      const alpha = 0.08 + 0.10*Math.abs(Math.sin(s.twinkle));
      ctx.beginPath();
      ctx.arc(cx + s.x, cy + s.y, s.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(212,160,23,${alpha})`;
      ctx.fill();
    });
  }

  function drawCenterGlow(time){
    const pulse = 0.6 + 0.4*Math.sin(time*1.8);
    const grad = ctx.createRadialGradient(cx,cy,0, cx,cy,130);
    grad.addColorStop(0,   `rgba(212,160,23,${0.06*pulse})`);
    grad.addColorStop(0.5, `rgba(64,145,108,${0.03*pulse})`);
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, 130, 0, Math.PI*2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  function frame(){
    ctx.clearRect(0,0,W,H);
    drawStars(t);
    drawCenterGlow(t);
    t += 0.016;
    const splash = document.getElementById('splashScreen');
    if (splash && (splash.classList.contains('hidden') || splash.style.display==='none')) {
      cancelAnimationFrame(raf);
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
})();

// ── Navigate to login ──
function homeToLogin(){
  if (typeof initAuth === 'function') initAuth();
  const lo = document.getElementById('loginOverlay');
  if (lo) lo.classList.remove('hidden');
}

/* ===== i18n.js ===== */
// ══════════════════════════════════════════════════════════
//  FINHUB i18n — Full Language System
// ══════════════════════════════════════════════════════════
(function() {

  const TRANSLATIONS = {
    en: {
      dir: 'ltr',
      // Nav
      nav_dashboard:  'Dashboard',
      nav_ledger:     'Ledger',
      nav_budgets:    'Budgets',
      nav_goals:      'Goals & Recurring',
      nav_charts:     'Charts',
      nav_profile:    'Profile & Account',
      nav_logout:     'Log out',
      nav_account:    'Account',
      nav_recent_months: 'Recent Months',
      // Header
      header_greeting: 'Your household ledger',
      greeting_morning: 'Good morning',
      greeting_afternoon: 'Good afternoon',
      greeting_evening: 'Good evening',
      greeting_night: 'Good night',
      header_theme_dark:  '🌙 Dark',
      header_theme_light: '☀️ White',
      header_7day_flow:  '7-day flow',
      header_net_month:  'Net this month',
      header_no_entries: 'no entries yet',
      header_month_elapsed: 'of month elapsed',
      // Balance strip
      card_balance:      'Balance',
      card_month_spent:  'Month Spent',
      card_month_income: 'Month Income',
      card_net_saved:    'Net Saved',
      // Quick stats
      qs_biggest_expense: 'Biggest Expense',
      qs_avg_daily:       'Avg Daily Spend',
      qs_days_payday:     'Days to Payday',
      // Entry form
      form_new_entry:    'New Entry',
      form_expense:      'Expense',
      form_income:       'Income',
      form_amount:       'Amount (₹)',
      form_description:  'Description',
      form_category:     'Category',
      form_category_na:  'Category (n/a for income)',
      form_note:         'Note (optional)',
      form_date:         'Date',
      form_add_btn:      'Add to Ledger',
      form_desc_ph:      'e.g. Groceries at DMart',
      form_note_ph:      'Any extra detail…',
      // Ledger
      ledger_recent:     'Recent Entries',
      ledger_title:      'The Ledger',
      ledger_search_ph:  'Search entries…',
      ledger_col_date:   'Date',
      ledger_col_desc:   'Description',
      ledger_col_cat:    'Category',
      ledger_col_amt:    'Amount (₹)',
      ledger_col_bal:    'Balance (₹)',
      ledger_empty:      'No entries yet — add one on the left.',
      ledger_empty_full: 'No entries this month. Switch to Dashboard to add one.',
      // Budgets
      budget_title:      'Monthly Budgets',
      budget_chart_title:'Spend vs Budget — Chart',
      budget_footnote:   'Set a monthly limit per category. Bars turn red when you exceed the budget.',
      // Goals
      goals_savings:     'Savings Goals',
      goals_deposit_footnote: 'Deposit amounts from your balance toward any goal.',
      recurring_title:   'Recurring Transactions',
      recurring_footnote:'Post a recurring entry to today\'s date anytime.',
      // Charts
      charts_title:       'Graph Sheet',
      charts_back:        '← Back to Ledger',
      charts_weekly:      'Weekly',
      charts_monthly:     'Monthly',
      charts_yearly:      'Yearly',
      charts_total_income:'Total Income',
      charts_total_spent: 'Total Spent',
      charts_net_saved:   'Net Saved',
      charts_savings_rate:'Savings Rate',
      charts_income_lbl:  'Income',
      charts_expense_lbl: 'Expense',
      charts_balance_lbl: 'Balance',
      charts_net_lbl:     'Net',
      // Profile
      pp_title:         'Profile & Account',
      pp_back:          '← Back',
      pp_account_info:  '🪪 Account Info',
      pp_user_id:       '🆔 User ID',
      pp_email:         '✉️ Email',
      pp_phone:         '📞 Phone',
      pp_member_since:  '📅 Member Since',
      pp_storage:       '💾 Storage Used',
      pp_edit_profile:  '✏️ Edit Profile',
      pp_display_name:  'Display Name',
      pp_save_btn:      '💾 Save Changes',
      pp_lang_head:     '🌐 Language / भाषा / மொழி',
      pp_danger_head:   '⚠️ Danger Zone',
      pp_danger_desc:   'Deleting your account will permanently erase all your transactions, budgets, goals, and settings on this device. This cannot be undone.',
      pp_delete_btn:    '🗑️ Delete My Account',
      // Stats
      pp_total_income:  'Total Income',
      pp_total_spent:   'Total Spent',
      pp_net_saved:     'Net Saved',
      pp_entries:       'Entries',
      // Menu
      menu_share:       '📤 Share this month',
      menu_export_csv:  '📥 Export CSV',
      menu_copy_summary:'📋 Copy summary',
      menu_export_pdf:  '📄 Export PDF',
      menu_print:       '🖨️ Print view',
      menu_clear_month: '🗑️ Clear this month',
      menu_logout:      '↩ Log out',
      // Edit modal
      edit_title:       'Edit Entry',
      edit_cancel:      'Cancel',
      edit_save:        'Save Changes',
      // Delete modal
      del_title:        'Delete Account?',
      del_confirm_btn:  'Delete Forever',
      del_cancel:       'Cancel',
      // PDF overlay
      pdf_title:        '📄 Export PDF',
      pdf_opt_month:    'Current month transactions',
      pdf_opt_summary:  'Monthly summary (income, spent, by category)',
      pdf_opt_all:      'All transactions (full ledger)',
      pdf_cancel:       'Cancel',
      pdf_generate:     'Generate PDF',
      // Toast
      toast_added:      'Entry added ✓',
      toast_saved:      'Changes saved ✓',
      toast_deleted:    'Entry deleted',
      // Offline
      offline_msg:      '📵 Offline — all data still saved locally',
      online_msg:       '✓ Back online',
      // Graph Sheet section titles
      gs_weekly_title:        'Last 12 Weeks — Income vs Expense',
      gs_weekly_label:        'Green = income · Red = expense · Each pair = one week',
      gs_weekly_bal_title:    'Weekly Running Balance',
      gs_weekly_cat_title:    'This Week — Spend by Category',
      gs_monthly_title:       '12-Month Overview — Income vs Expense',
      gs_monthly_label:       'Bar pairs per month · Line = running balance',
      gs_monthly_savrate_title: 'Monthly Savings Rate',
      gs_monthly_savrate_label: '% of income saved each month',
      gs_monthly_cat_title:   'This Month — Spend by Category',
      gs_yearly_title:        'Year-on-Year Overview',
      gs_yearly_label:        'Income · Expense · Net per year',
      gs_yearly_cat_title:    'Year-by-Year Category Breakdown',
      gs_savrate_lbl:         'Savings Rate %',
      gs_budget_limit:        'Budget limit',
    },

    hi: {
      dir: 'ltr',
      greeting_morning: 'सुप्रभात',
      greeting_afternoon: 'शुभ दोपहर',
      greeting_evening: 'शुभ संध्या',
      greeting_night: 'शुभ रात्रि',
      nav_dashboard:  'डैशबोर्ड',
      nav_ledger:     'खाता बही',
      nav_budgets:    'बजट',
      nav_goals:      'लक्ष्य और आवर्ती',
      nav_charts:     'चार्ट',
      nav_profile:    'प्रोफ़ाइल और खाता',
      nav_logout:     'लॉग आउट',
      nav_account:    'खाता',
      nav_recent_months: 'हाल के महीने',
      header_greeting: 'आपकी घरेलू खाता बही',
      header_theme_dark:  '🌙 डार्क',
      header_theme_light: '☀️ White',
      header_7day_flow:  '7-दिन का प्रवाह',
      header_net_month:  'इस माह का शुद्ध',
      header_no_entries: 'अभी कोई प्रविष्टि नहीं',
      header_month_elapsed: 'माह बीत चुका',
      card_balance:      'शेष',
      card_month_spent:  'माह व्यय',
      card_month_income: 'माह आय',
      card_net_saved:    'शुद्ध बचत',
      qs_biggest_expense: 'सबसे बड़ा खर्च',
      qs_avg_daily:       'औसत दैनिक खर्च',
      qs_days_payday:     'वेतन दिन तक',
      form_new_entry:    'नई प्रविष्टि',
      form_expense:      'व्यय',
      form_income:       'आय',
      form_amount:       'राशि (₹)',
      form_description:  'विवरण',
      form_category:     'श्रेणी',
      form_category_na:  'श्रेणी (आय के लिए लागू नहीं)',
      form_note:         'नोट (वैकल्पिक)',
      form_date:         'तारीख',
      form_add_btn:      'खाता बही में जोड़ें',
      form_desc_ph:      'जैसे DMart पर किराना',
      form_note_ph:      'कोई अतिरिक्त विवरण…',
      ledger_recent:     'हाल की प्रविष्टियाँ',
      ledger_title:      'खाता बही',
      ledger_search_ph:  'प्रविष्टियाँ खोजें…',
      ledger_col_date:   'तारीख',
      ledger_col_desc:   'विवरण',
      ledger_col_cat:    'श्रेणी',
      ledger_col_amt:    'राशि (₹)',
      ledger_col_bal:    'शेष (₹)',
      ledger_empty:      'अभी कोई प्रविष्टि नहीं — बाईं ओर जोड़ें।',
      ledger_empty_full: 'इस माह कोई प्रविष्टि नहीं। जोड़ने के लिए डैशबोर्ड पर जाएं।',
      budget_title:      'मासिक बजट',
      budget_chart_title:'खर्च बनाम बजट — चार्ट',
      budget_footnote:   'प्रत्येक श्रेणी के लिए मासिक सीमा निर्धारित करें।',
      goals_savings:     'बचत लक्ष्य',
      goals_deposit_footnote: 'किसी भी लक्ष्य की ओर राशि जमा करें।',
      recurring_title:   'आवर्ती लेनदेन',
      recurring_footnote:'कभी भी आवर्ती प्रविष्टि पोस्ट करें।',
      charts_title:       'ग्राफ शीट',
      charts_back:        '← वापस खाता बही',
      charts_weekly:      'साप्ताहिक',
      charts_monthly:     'मासिक',
      charts_yearly:      'वार्षिक',
      charts_total_income:'कुल आय',
      charts_total_spent: 'कुल व्यय',
      charts_net_saved:   'शुद्ध बचत',
      charts_savings_rate:'बचत दर',
      charts_income_lbl:  'आय',
      charts_expense_lbl: 'व्यय',
      charts_balance_lbl: 'शेष',
      charts_net_lbl:     'शुद्ध',
      pp_title:         'प्रोफ़ाइल और खाता',
      pp_back:          '← वापस',
      pp_account_info:  '🪪 खाता जानकारी',
      pp_user_id:       '🆔 उपयोगकर्ता ID',
      pp_email:         '✉️ ईमेल',
      pp_phone:         '📞 फ़ोन',
      pp_member_since:  '📅 सदस्यता तिथि',
      pp_storage:       '💾 संग्रहण उपयोग',
      pp_edit_profile:  '✏️ प्रोफ़ाइल संपादित करें',
      pp_display_name:  'प्रदर्शन नाम',
      pp_save_btn:      '💾 परिवर्तन सहेजें',
      pp_lang_head:     '🌐 भाषा',
      pp_danger_head:   '⚠️ खतरनाक क्षेत्र',
      pp_danger_desc:   'खाता हटाने से सभी डेटा स्थायी रूप से मिट जाएगा। यह पूर्ववत नहीं किया जा सकता।',
      pp_delete_btn:    '🗑️ मेरा खाता हटाएं',
      pp_total_income:  'कुल आय',
      pp_total_spent:   'कुल व्यय',
      pp_net_saved:     'शुद्ध बचत',
      pp_entries:       'प्रविष्टियाँ',
      menu_share:       '📤 इस माह साझा करें',
      menu_export_csv:  '📥 CSV निर्यात',
      menu_copy_summary:'📋 सारांश कॉपी करें',
      menu_export_pdf:  '📄 PDF निर्यात',
      menu_print:       '🖨️ प्रिंट व्यू',
      menu_clear_month: '🗑️ यह माह साफ करें',
      menu_logout:      '↩ लॉग आउट',
      edit_title:       'प्रविष्टि संपादित करें',
      edit_cancel:      'रद्द करें',
      edit_save:        'परिवर्तन सहेजें',
      del_title:        'खाता हटाएं?',
      del_confirm_btn:  'हमेशा के लिए हटाएं',
      del_cancel:       'रद्द करें',
      pdf_title:        '📄 PDF निर्यात',
      pdf_opt_month:    'वर्तमान माह के लेनदेन',
      pdf_opt_summary:  'मासिक सारांश',
      pdf_opt_all:      'सभी लेनदेन',
      pdf_cancel:       'रद्द करें',
      pdf_generate:     'PDF बनाएं',
      offline_msg:      '📵 ऑफ़लाइन — डेटा सुरक्षित है',
      online_msg:       '✓ वापस ऑनलाइन',
      gs_weekly_title:        'पिछले 12 सप्ताह — आय बनाम व्यय',
      gs_weekly_label:        'हरा = आय · लाल = व्यय · प्रत्येक जोड़ी = एक सप्ताह',
      gs_weekly_bal_title:    'साप्ताहिक चालू शेष',
      gs_weekly_cat_title:    'इस सप्ताह — श्रेणी वार खर्च',
      gs_monthly_title:       '12 महीने का अवलोकन — आय बनाम व्यय',
      gs_monthly_label:       'प्रति माह बार जोड़ी · रेखा = चालू शेष',
      gs_monthly_savrate_title: 'मासिक बचत दर',
      gs_monthly_savrate_label: 'प्रत्येक माह बचाई गई आय का %',
      gs_monthly_cat_title:   'इस माह — श्रेणी वार खर्च',
      gs_yearly_title:        'वर्ष-दर-वर्ष अवलोकन',
      gs_yearly_label:        'आय · व्यय · शुद्ध प्रति वर्ष',
      gs_yearly_cat_title:    'वर्ष-दर-वर्ष श्रेणी विभाजन',
      gs_savrate_lbl:         'बचत दर %',
      gs_budget_limit:        'बजट सीमा',
    },

    ta: {
      dir: 'ltr',
      greeting_morning: 'காலை வணக்கம்',
      greeting_afternoon: 'மதிய வணக்கம்',
      greeting_evening: 'மாலை வணக்கம்',
      greeting_night: 'இனிய இரவு',
      nav_dashboard:  'டாஷ்போர்டு',
      nav_ledger:     'கணக்கேடு',
      nav_budgets:    'பட்ஜெட்',
      nav_goals:      'இலக்குகள் & தொடர்',
      nav_charts:     'விளக்கப்படங்கள்',
      nav_profile:    'சுயவிவரம் & கணக்கு',
      nav_logout:     'வெளியேறு',
      nav_account:    'கணக்கு',
      nav_recent_months: 'சமீபத்திய மாதங்கள்',
      header_greeting: 'உங்கள் குடும்ப கணக்கேடு',
      header_theme_dark:  '🌙 இருட்டு',
      header_theme_light: '☀️ White',
      header_7day_flow:  '7-நாள் ஓட்டம்',
      header_net_month:  'இம்மாத நிகர',
      header_no_entries: 'இன்னும் பதிவுகள் இல்லை',
      header_month_elapsed: 'மாதம் கடந்தது',
      card_balance:      'இருப்பு',
      card_month_spent:  'மாத செலவு',
      card_month_income: 'மாத வருமானம்',
      card_net_saved:    'நிகர சேமிப்பு',
      qs_biggest_expense: 'மிகப்பெரிய செலவு',
      qs_avg_daily:       'சராசரி தினசரி செலவு',
      qs_days_payday:     'சம்பள நாள் வரை',
      form_new_entry:    'புதிய பதிவு',
      form_expense:      'செலவு',
      form_income:       'வருமானம்',
      form_amount:       'தொகை (₹)',
      form_description:  'விளக்கம்',
      form_category:     'வகை',
      form_category_na:  'வகை (வருமானத்திற்கு பொருந்தாது)',
      form_note:         'குறிப்பு (விருப்பத்திற்கு)',
      form_date:         'தேதி',
      form_add_btn:      'கணக்கேட்டில் சேர்க்கவும்',
      form_desc_ph:      'எ.கா. DMart கடையில் மளிகை',
      form_note_ph:      'கூடுதல் விவரங்கள்…',
      ledger_recent:     'சமீபத்திய பதிவுகள்',
      ledger_title:      'கணக்கேடு',
      ledger_search_ph:  'பதிவுகளை தேடுக…',
      ledger_col_date:   'தேதி',
      ledger_col_desc:   'விளக்கம்',
      ledger_col_cat:    'வகை',
      ledger_col_amt:    'தொகை (₹)',
      ledger_col_bal:    'இருப்பு (₹)',
      ledger_empty:      'இன்னும் பதிவுகள் இல்லை — இடது பக்கம் சேர்க்கவும்.',
      ledger_empty_full: 'இம்மாதம் பதிவுகள் இல்லை. டாஷ்போர்டுக்கு செல்லவும்.',
      budget_title:      'மாதாந்திர பட்ஜெட்',
      budget_chart_title:'செலவு vs பட்ஜெட் — விளக்கப்படம்',
      budget_footnote:   'ஒவ்வொரு வகைக்கும் மாதாந்திர வரம்பு அமைக்கவும்.',
      goals_savings:     'சேமிப்பு இலக்குகள்',
      goals_deposit_footnote: 'உங்கள் இருப்பிலிருந்து இலக்கை நோக்கி தொகையை வைப்பிடுங்கள்.',
      recurring_title:   'தொடர் பரிவர்த்தனைகள்',
      recurring_footnote:'எந்த நேரத்திலும் தொடர் பதிவை இடுங்கள்.',
      charts_title:       'வரைபட தாள்',
      charts_back:        '← கணக்கேட்டுக்கு திரும்பு',
      charts_weekly:      'வாராந்திர',
      charts_monthly:     'மாதாந்திர',
      charts_yearly:      'வருடாந்திர',
      charts_total_income:'மொத்த வருமானம்',
      charts_total_spent: 'மொத்த செலவு',
      charts_net_saved:   'நிகர சேமிப்பு',
      charts_savings_rate:'சேமிப்பு விகிதம்',
      charts_income_lbl:  'வருமானம்',
      charts_expense_lbl: 'செலவு',
      charts_balance_lbl: 'இருப்பு',
      charts_net_lbl:     'நிகர',
      pp_title:         'சுயவிவரம் & கணக்கு',
      pp_back:          '← திரும்பு',
      pp_account_info:  '🪪 கணக்கு தகவல்',
      pp_user_id:       '🆔 பயனர் ID',
      pp_email:         '✉️ மின்னஞ்சல்',
      pp_phone:         '📞 தொலைபேசி',
      pp_member_since:  '📅 உறுப்பினர் தொடங்கிய நாள்',
      pp_storage:       '💾 சேமிப்பு பயன்பாடு',
      pp_edit_profile:  '✏️ சுயவிவரம் திருத்து',
      pp_display_name:  'காட்சி பெயர்',
      pp_save_btn:      '💾 மாற்றங்களை சேமிக்கவும்',
      pp_lang_head:     '🌐 மொழி',
      pp_danger_head:   '⚠️ ஆபத்தான பகுதி',
      pp_danger_desc:   'கணக்கை நீக்குவதால் அனைத்து தரவும் நிரந்தரமாக அழிக்கப்படும்.',
      pp_delete_btn:    '🗑️ என் கணக்கை நீக்கு',
      pp_total_income:  'மொத்த வருமானம்',
      pp_total_spent:   'மொத்த செலவு',
      pp_net_saved:     'நிகர சேமிப்பு',
      pp_entries:       'பதிவுகள்',
      menu_share:       '📤 இம்மாதத்தை பகிர்',
      menu_export_csv:  '📥 CSV ஏற்றுமதி',
      menu_copy_summary:'📋 சுருக்கம் நகலெடு',
      menu_export_pdf:  '📄 PDF ஏற்றுமதி',
      menu_print:       '🖨️ அச்சு காட்சி',
      menu_clear_month: '🗑️ இம்மாதத்தை அழி',
      menu_logout:      '↩ வெளியேறு',
      edit_title:       'பதிவை திருத்து',
      edit_cancel:      'ரத்து',
      edit_save:        'மாற்றங்களை சேமிக்கவும்',
      del_title:        'கணக்கை நீக்கவுமா?',
      del_confirm_btn:  'எப்போதும் நீக்கு',
      del_cancel:       'ரத்து',
      pdf_title:        '📄 PDF ஏற்றுமதி',
      pdf_opt_month:    'தற்போதைய மாத பரிவர்த்தனைகள்',
      pdf_opt_summary:  'மாதாந்திர சுருக்கம்',
      pdf_opt_all:      'அனைத்து பரிவர்த்தனைகள்',
      pdf_cancel:       'ரத்து',
      pdf_generate:     'PDF உருவாக்கு',
      offline_msg:      '📵 ஆஃப்லைன் — தரவு பாதுகாப்பாக உள்ளது',
      online_msg:       '✓ மீண்டும் ஆன்லைன்',
      gs_weekly_title:        'கடந்த 12 வாரங்கள் — வருமானம் vs செலவு',
      gs_weekly_label:        'பச்சை = வருமானம் · சிவப்பு = செலவு · ஒவ்வொரு ஜோடியும் = ஒரு வாரம்',
      gs_weekly_bal_title:    'வாராந்திர ஓடும் இருப்பு',
      gs_weekly_cat_title:    'இந்த வாரம் — வகை வாரியாக செலவு',
      gs_monthly_title:       '12 மாத கண்ணோட்டம் — வருமானம் vs செலவு',
      gs_monthly_label:       'மாதத்திற்கு பட்டை ஜோடிகள் · கோடு = ஓடும் இருப்பு',
      gs_monthly_savrate_title: 'மாதாந்திர சேமிப்பு விகிதம்',
      gs_monthly_savrate_label: 'ஒவ்வொரு மாதமும் சேமிக்கப்பட்ட வருமானத்தின் %',
      gs_monthly_cat_title:   'இம்மாதம் — வகை வாரியாக செலவு',
      gs_yearly_title:        'ஆண்டு வாரியான கண்ணோட்டம்',
      gs_yearly_label:        'வருமானம் · செலவு · நிகர ஆண்டுதோறும்',
      gs_yearly_cat_title:    'ஆண்டு வாரியான வகை பிரிப்பு',
      gs_savrate_lbl:         'சேமிப்பு விகிதம் %',
      gs_budget_limit:        'பட்ஜெட் வரம்பு',
    },

    te: {
      dir: 'ltr',
      greeting_morning: 'శుభోదయం',
      greeting_afternoon: 'శుభ మధ్యాహ్నం',
      greeting_evening: 'శుభ సాయంత్రం',
      greeting_night: 'శుభ రాత్రి',
      nav_dashboard:  'డాష్‌బోర్డ్',
      nav_ledger:     'లెడ్జర్',
      nav_budgets:    'బడ్జెట్‌లు',
      nav_goals:      'లక్ష్యాలు & పునరావృత',
      nav_charts:     'చార్ట్‌లు',
      nav_profile:    'ప్రొఫైల్ & ఖాతా',
      nav_logout:     'లాగ్ అవుట్',
      nav_account:    'ఖాతా',
      nav_recent_months: 'ఇటీవలి నెలలు',
      header_greeting: 'మీ గృహ లెడ్జర్',
      header_theme_dark:  '🌙 డార్క్',
      header_theme_light: '☀️ White',
      header_7day_flow:  '7-రోజుల ప్రవాహం',
      header_net_month:  'ఈ నెల నికర',
      header_no_entries: 'ఇంకా నమోదులు లేవు',
      header_month_elapsed: 'నెల గడిచింది',
      card_balance:      'నిల్వ',
      card_month_spent:  'నెల ఖర్చు',
      card_month_income: 'నెల ఆదాయం',
      card_net_saved:    'నికర పొదుపు',
      qs_biggest_expense: 'అతిపెద్ద ఖర్చు',
      qs_avg_daily:       'సగటు రోజువారీ ఖర్చు',
      qs_days_payday:     'జీతం రోజుకు',
      form_new_entry:    'కొత్త నమోదు',
      form_expense:      'ఖర్చు',
      form_income:       'ఆదాయం',
      form_amount:       'మొత్తం (₹)',
      form_description:  'వివరణ',
      form_category:     'వర్గం',
      form_category_na:  'వర్గం (ఆదాయానికి వర్తించదు)',
      form_note:         'గమనిక (ఐచ్ఛికం)',
      form_date:         'తేదీ',
      form_add_btn:      'లెడ్జర్‌కు జోడించు',
      form_desc_ph:      'ఉదా. DMart లో కిరాన',
      form_note_ph:      'అదనపు వివరాలు…',
      ledger_recent:     'ఇటీవలి నమోదులు',
      ledger_title:      'లెడ్జర్',
      ledger_search_ph:  'నమోదులు వెతకండి…',
      ledger_col_date:   'తేదీ',
      ledger_col_desc:   'వివరణ',
      ledger_col_cat:    'వర్గం',
      ledger_col_amt:    'మొత్తం (₹)',
      ledger_col_bal:    'నిల్వ (₹)',
      ledger_empty:      'ఇంకా నమోదులు లేవు — ఎడమవైపు జోడించండి.',
      ledger_empty_full: 'ఈ నెల నమోదులు లేవు. డాష్‌బోర్డ్‌కు వెళ్ళండి.',
      budget_title:      'నెలవారీ బడ్జెట్‌లు',
      budget_chart_title:'ఖర్చు vs బడ్జెట్ — చార్ట్',
      budget_footnote:   'ప్రతి వర్గానికి నెలవారీ పరిమితి నిర్ణయించండి.',
      goals_savings:     'పొదుపు లక్ష్యాలు',
      goals_deposit_footnote: 'మీ నిల్వ నుండి లక్ష్యానికి జమ చేయండి.',
      recurring_title:   'పునరావృత లావాదేవీలు',
      recurring_footnote:'ఎప్పుడైనా పునరావృత నమోదు పోస్ట్ చేయండి.',
      charts_title:       'గ్రాఫ్ షీట్',
      charts_back:        '← లెడ్జర్‌కు తిరిగి',
      charts_weekly:      'వారపు',
      charts_monthly:     'నెలవారీ',
      charts_yearly:      'వార్షిక',
      charts_total_income:'మొత్తం ఆదాయం',
      charts_total_spent: 'మొత్తం ఖర్చు',
      charts_net_saved:   'నికర పొదుపు',
      charts_savings_rate:'పొదుపు రేటు',
      charts_income_lbl:  'ఆదాయం',
      charts_expense_lbl: 'ఖర్చు',
      charts_balance_lbl: 'నిల్వ',
      charts_net_lbl:     'నికర',
      pp_title:         'ప్రొఫైల్ & ఖాతా',
      pp_back:          '← వెనుకకు',
      pp_account_info:  '🪪 ఖాతా సమాచారం',
      pp_user_id:       '🆔 వినియోగదారు ID',
      pp_email:         '✉️ ఇమెయిల్',
      pp_phone:         '📞 ఫోన్',
      pp_member_since:  '📅 సభ్యత్వ తేదీ',
      pp_storage:       '💾 నిల్వ వినియోగం',
      pp_edit_profile:  '✏️ ప్రొఫైల్ సవరించు',
      pp_display_name:  'ప్రదర్శన పేరు',
      pp_save_btn:      '💾 మార్పులు సేవ్ చేయి',
      pp_lang_head:     '🌐 భాష',
      pp_danger_head:   '⚠️ ప్రమాద మండలం',
      pp_danger_desc:   'ఖాతాను తొలగించడం వల్ల అన్ని డేటా శాశ్వతంగా తొలగించబడుతుంది.',
      pp_delete_btn:    '🗑️ నా ఖాతాను తొలగించు',
      pp_total_income:  'మొత్తం ఆదాయం',
      pp_total_spent:   'మొత్తం ఖర్చు',
      pp_net_saved:     'నికర పొదుపు',
      pp_entries:       'నమోదులు',
      menu_share:       '📤 ఈ నెల పంచుకో',
      menu_export_csv:  '📥 CSV ఎగుమతి',
      menu_copy_summary:'📋 సారాంశం కాపీ చేయి',
      menu_export_pdf:  '📄 PDF ఎగుమతి',
      menu_print:       '🖨️ ముద్రణ వీక్షణ',
      menu_clear_month: '🗑️ ఈ నెల తొలగించు',
      menu_logout:      '↩ లాగ్ అవుట్',
      edit_title:       'నమోదు సవరించు',
      edit_cancel:      'రద్దు',
      edit_save:        'మార్పులు సేవ్ చేయి',
      del_title:        'ఖాతా తొలగించాలా?',
      del_confirm_btn:  'శాశ్వతంగా తొలగించు',
      del_cancel:       'రద్దు',
      pdf_title:        '📄 PDF ఎగుమతి',
      pdf_opt_month:    'ప్రస్తుత నెల లావాదేవీలు',
      pdf_opt_summary:  'నెలవారీ సారాంశం',
      pdf_opt_all:      'అన్ని లావాదేవీలు',
      pdf_cancel:       'రద్దు',
      pdf_generate:     'PDF రూపొందించు',
      offline_msg:      '📵 ఆఫ్‌లైన్ — డేటా సురక్షితం',
      online_msg:       '✓ తిరిగి ఆన్‌లైన్',
      gs_weekly_title:        'గత 12 వారాలు — ఆదాయం vs ఖర్చు',
      gs_weekly_label:        'ఆకుపచ్చ = ఆదాయం · ఎరుపు = ఖర్చు · ప్రతి జత = ఒక వారం',
      gs_weekly_bal_title:    'వారపు నడుస్తున్న నిల్వ',
      gs_weekly_cat_title:    'ఈ వారం — వర్గం వారీగా ఖర్చు',
      gs_monthly_title:       '12 నెలల అవలోకనం — ఆదాయం vs ఖర్చు',
      gs_monthly_label:       'నెలకు బార్ జతలు · రేఖ = నడుస్తున్న నిల్వ',
      gs_monthly_savrate_title: 'నెలవారీ పొదుపు రేటు',
      gs_monthly_savrate_label: 'ప్రతి నెల ఆదాయంలో పొదుపు చేసిన %',
      gs_monthly_cat_title:   'ఈ నెల — వర్గం వారీగా ఖర్చు',
      gs_yearly_title:        'సంవత్సరం వారీగా అవలోకనం',
      gs_yearly_label:        'ఆదాయం · ఖర్చు · నికర సంవత్సరానికి',
      gs_yearly_cat_title:    'సంవత్సరం వారీగా వర్గం విభజన',
      gs_savrate_lbl:         'పొదుపు రేటు %',
      gs_budget_limit:        'బడ్జెట్ పరిమితి',
    },

    ml: {
      dir: 'ltr',
      greeting_morning: 'സുപ്രഭാതം',
      greeting_afternoon: 'ശുഭ മധ്യാഹ്നം',
      greeting_evening: 'ശുഭ സായാഹ്നം',
      greeting_night: 'ശുഭ രാത്രി',
      nav_dashboard:  'ഡാഷ്‌ബോർഡ്',
      nav_ledger:     'ലെഡ്ജർ',
      nav_budgets:    'ബജറ്റുകൾ',
      nav_goals:      'ലക്ഷ്യങ്ങളും ആവർത്തനങ്ങളും',
      nav_charts:     'ചാർട്ടുകൾ',
      nav_profile:    'പ്രൊഫൈലും അക്കൗണ്ടും',
      nav_logout:     'ലോഗ് ഔട്ട്',
      nav_account:    'അക്കൗണ്ട്',
      nav_recent_months: 'സമീപ മാസങ്ങൾ',
      header_greeting: 'നിങ്ങളുടെ ഗൃഹ ലെഡ്ജർ',
      header_theme_dark:  '🌙 ഇരുണ്ടത്',
      header_theme_light: '☀️ White',
      header_7day_flow:  '7-ദിവസ പ്രവാഹം',
      header_net_month:  'ഈ മാസം നെറ്റ്',
      header_no_entries: 'ഇതുവരെ എൻട്രികൾ ഇല്ല',
      header_month_elapsed: 'മാസം കഴിഞ്ഞു',
      card_balance:      'ബാലൻസ്',
      card_month_spent:  'മാസ ചെലവ്',
      card_month_income: 'മാസ വരുമാനം',
      card_net_saved:    'നെറ്റ് സേവിംഗ്',
      qs_biggest_expense: 'ഏറ്റവും വലിയ ചെലവ്',
      qs_avg_daily:       'ശരാശരി ദൈനിക ചെലവ്',
      qs_days_payday:     'ശമ്പള ദിവസത്തിലേക്ക്',
      form_new_entry:    'പുതിയ എൻട്രി',
      form_expense:      'ചെലവ്',
      form_income:       'വരുമാനം',
      form_amount:       'തുക (₹)',
      form_description:  'വിവരണം',
      form_category:     'വിഭാഗം',
      form_category_na:  'വിഭാഗം (വരുമാനത്തിന് ബാധകമല്ല)',
      form_note:         'കുറിപ്പ് (ഐച്ഛികം)',
      form_date:         'തീയതി',
      form_add_btn:      'ലെഡ്ജറിൽ ചേർക്കുക',
      form_desc_ph:      'ഉദാ. DMart-ൽ നിന്ന് പലചരക്ക്',
      form_note_ph:      'അധിക വിശദാംശങ്ങൾ…',
      ledger_recent:     'സമീപകാല എൻട്രികൾ',
      ledger_title:      'ലെഡ്ജർ',
      ledger_search_ph:  'എൻട്രികൾ തിരയുക…',
      ledger_col_date:   'തീയതി',
      ledger_col_desc:   'വിവരണം',
      ledger_col_cat:    'വിഭാഗം',
      ledger_col_amt:    'തുക (₹)',
      ledger_col_bal:    'ബാലൻസ് (₹)',
      ledger_empty:      'ഇതുവരെ എൻട്രികൾ ഇല്ല — ഇടത്ത് ചേർക്കുക.',
      ledger_empty_full: 'ഈ മാസം എൻട്രികൾ ഇല്ല. ഡാഷ്‌ബോർഡിലേക്ക് പോകുക.',
      budget_title:      'മാസിക ബജറ്റുകൾ',
      budget_chart_title:'ചെലവ് vs ബജറ്റ് — ചാർട്ട്',
      budget_footnote:   'ഓരോ വിഭാഗത്തിനും മാസിക പരിധി നിർണ്ണയിക്കുക.',
      goals_savings:     'സേവിംഗ്സ് ലക്ഷ്യങ്ങൾ',
      goals_deposit_footnote: 'നിങ്ങളുടെ ബാലൻസിൽ നിന്ന് ലക്ഷ്യത്തിലേക്ക് തുക നിക്ഷേപിക്കുക.',
      recurring_title:   'ആവർത്തിക്കുന്ന ഇടപാടുകൾ',
      recurring_footnote:'ഏത് സമയത്തും ആവർത്തിക്കുന്ന എൻട്രി പോസ്റ്റ് ചെയ്യുക.',
      charts_title:       'ഗ്രാഫ് ഷീറ്റ്',
      charts_back:        '← ലെഡ്ജറിലേക്ക് മടങ്ങുക',
      charts_weekly:      'പ്രതിവാര',
      charts_monthly:     'മാസിക',
      charts_yearly:      'വാർഷിക',
      charts_total_income:'മൊത്തം വരുമാനം',
      charts_total_spent: 'മൊത്തം ചെലവ്',
      charts_net_saved:   'നെറ്റ് സേവിംഗ്',
      charts_savings_rate:'സേവിംഗ് നിരക്ക്',
      charts_income_lbl:  'വരുമാനം',
      charts_expense_lbl: 'ചെലവ്',
      charts_balance_lbl: 'ബാലൻസ്',
      charts_net_lbl:     'നെറ്റ്',
      pp_title:         'പ്രൊഫൈലും അക്കൗണ്ടും',
      pp_back:          '← മടങ്ങുക',
      pp_account_info:  '🪪 അക്കൗണ്ട് വിവരം',
      pp_user_id:       '🆔 ഉപയോക്തൃ ID',
      pp_email:         '✉️ ഇ-മെയിൽ',
      pp_phone:         '📞 ഫോൺ',
      pp_member_since:  '📅 അംഗം മുതൽ',
      pp_storage:       '💾 സ്റ്റോറേജ് ഉപയോഗം',
      pp_edit_profile:  '✏️ പ്രൊഫൈൽ എഡിറ്റ് ചെയ്യുക',
      pp_display_name:  'പ്രദർശന നാമം',
      pp_save_btn:      '💾 മാറ്റങ്ങൾ സേവ് ചെയ്യുക',
      pp_lang_head:     '🌐 ഭാഷ',
      pp_danger_head:   '⚠️ അപകട മേഖല',
      pp_danger_desc:   'അക്കൗണ്ട് ഇല്ലാതാക്കിയാൽ എല്ലാ ഡേറ്റയും ശാശ്വതമായി നഷ്ടപ്പെടും.',
      pp_delete_btn:    '🗑️ എന്റെ അക്കൗണ്ട് ഇല്ലാതാക്കുക',
      pp_total_income:  'മൊത്തം വരുമാനം',
      pp_total_spent:   'മൊത്തം ചെലവ്',
      pp_net_saved:     'നെറ്റ് സേവിംഗ്',
      pp_entries:       'എൻട്രികൾ',
      menu_share:       '📤 ഈ മാസം പങ്കിടുക',
      menu_export_csv:  '📥 CSV എക്‌സ്‌പോർട്ട്',
      menu_copy_summary:'📋 സംഗ്രഹം പകർത്തുക',
      menu_export_pdf:  '📄 PDF എക്‌സ്‌പോർട്ട്',
      menu_print:       '🖨️ പ്രിന്റ് കാഴ്ച',
      menu_clear_month: '🗑️ ഈ മാസം മായ്ക്കുക',
      menu_logout:      '↩ ലോഗ് ഔട്ട്',
      edit_title:       'എൻട്രി എഡിറ്റ് ചെയ്യുക',
      edit_cancel:      'റദ്ദാക്കുക',
      edit_save:        'മാറ്റങ്ങൾ സേവ് ചെയ്യുക',
      del_title:        'അക്കൗണ്ട് ഇല്ലാതാക്കണോ?',
      del_confirm_btn:  'ശാശ്വതമായി ഇല്ലാതാക്കുക',
      del_cancel:       'റദ്ദാക്കുക',
      pdf_title:        '📄 PDF എക്‌സ്‌പോർട്ട്',
      pdf_opt_month:    'നിലവിലെ മാസ ഇടപാടുകൾ',
      pdf_opt_summary:  'മാസിക സംഗ്രഹം',
      pdf_opt_all:      'എല്ലാ ഇടപാടുകളും',
      pdf_cancel:       'റദ്ദാക്കുക',
      pdf_generate:     'PDF ഉണ്ടാക്കുക',
      offline_msg:      '📵 ഓഫ്‌ലൈൻ — ഡേറ്റ സുരക്ഷിതം',
      online_msg:       '✓ വീണ്ടും ഓൺലൈൻ',
      gs_weekly_title:        'കഴിഞ്ഞ 12 ആഴ്ചകൾ — വരുമാനം vs ചെലവ്',
      gs_weekly_label:        'പച്ച = വരുമാനം · ചുവപ്പ് = ചെലവ് · ഓരോ ജോഡിയും = ഒരാഴ്ച',
      gs_weekly_bal_title:    'ആഴ്ചതോറുമുള്ള ബാലൻസ്',
      gs_weekly_cat_title:    'ഈ ആഴ്ച — വിഭാഗം അനുസരിച്ച് ചെലവ്',
      gs_monthly_title:       '12 മാസ അവലോകനം — വരുമാനം vs ചെലവ്',
      gs_monthly_label:       'മാസത്തിന് ബാർ ജോഡികൾ · രേഖ = നടന്നുകൊണ്ടിരിക്കുന്ന ബാലൻസ്',
      gs_monthly_savrate_title: 'മാസേനയുള്ള സേവിംഗ്സ് നിരക്ക്',
      gs_monthly_savrate_label: 'എല്ലാ മാസവും ലാഭിക്കുന്ന വരുമാനത്തിന്റെ %',
      gs_monthly_cat_title:   'ഈ മാസം — വിഭാഗം അനുസരിച്ച് ചെലവ്',
      gs_yearly_title:        'വർഷം തോറുമുള്ള അവലോകനം',
      gs_yearly_label:        'വരുമാനം · ചെലവ് · അറ്റ ആണ്ടിൽ',
      gs_yearly_cat_title:    'വർഷം തോറുമുള്ള വിഭാഗ വിഭജനം',
      gs_savrate_lbl:         'സേവിംഗ്സ് നിരക്ക് %',
      gs_budget_limit:        'ബജറ്റ് പരിധി',
    },

    kn: {
      dir: 'ltr',
      greeting_morning: 'ಶುಭೋದಯ',
      greeting_afternoon: 'ಶುಭ ಮಧ್ಯಾಹ್ನ',
      greeting_evening: 'ಶುಭ ಸಂಜೆ',
      greeting_night: 'ಶುಭ ರಾತ್ರಿ',
      nav_dashboard:  'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
      nav_ledger:     'ಲೆಡ್ಜರ್',
      nav_budgets:    'ಬಜೆಟ್‌ಗಳು',
      nav_goals:      'ಗುರಿಗಳು ಮತ್ತು ಪುನರಾವರ್ತಿತ',
      nav_charts:     'ಚಾರ್ಟ್‌ಗಳು',
      nav_profile:    'ಪ್ರೊಫೈಲ್ ಮತ್ತು ಖಾತೆ',
      nav_logout:     'ಲಾಗ್ ಔಟ್',
      nav_account:    'ಖಾತೆ',
      nav_recent_months: 'ಇತ್ತೀಚಿನ ತಿಂಗಳುಗಳು',
      header_greeting: 'ನಿಮ್ಮ ಮನೆಯ ಲೆಡ್ಜರ್',
      header_theme_dark:  '🌙 ಡಾರ್ಕ್',
      header_theme_light: '☀️ White',
      header_7day_flow:  '7-ದಿನ ಹರಿವು',
      header_net_month:  'ಈ ತಿಂಗಳ ನಿವ್ವಳ',
      header_no_entries: 'ಇನ್ನೂ ನಮೂದುಗಳಿಲ್ಲ',
      header_month_elapsed: 'ತಿಂಗಳು ಕಳೆದಿದೆ',
      card_balance:      'ಬ್ಯಾಲೆನ್ಸ್',
      card_month_spent:  'ತಿಂಗಳ ಖರ್ಚು',
      card_month_income: 'ತಿಂಗಳ ಆದಾಯ',
      card_net_saved:    'ನಿವ್ವಳ ಉಳಿತಾಯ',
      qs_biggest_expense: 'ಅತಿದೊಡ್ಡ ಖರ್ಚು',
      qs_avg_daily:       'ಸರಾಸರಿ ದೈನಿಕ ಖರ್ಚು',
      qs_days_payday:     'ಸಂಬಳ ದಿನಕ್ಕೆ',
      form_new_entry:    'ಹೊಸ ನಮೂದು',
      form_expense:      'ಖರ್ಚು',
      form_income:       'ಆದಾಯ',
      form_amount:       'ಮೊತ್ತ (₹)',
      form_description:  'ವಿವರಣೆ',
      form_category:     'ವರ್ಗ',
      form_category_na:  'ವರ್ಗ (ಆದಾಯಕ್ಕೆ ಅನ್ವಯಿಸದು)',
      form_note:         'ಟಿಪ್ಪಣಿ (ಐಚ್ಛಿಕ)',
      form_date:         'ದಿನಾಂಕ',
      form_add_btn:      'ಲೆಡ್ಜರ್‌ಗೆ ಸೇರಿಸಿ',
      form_desc_ph:      'ಉದಾ. DMart ನಲ್ಲಿ ದಿನಸಿ',
      form_note_ph:      'ಹೆಚ್ಚುವರಿ ವಿವರಗಳು…',
      ledger_recent:     'ಇತ್ತೀಚಿನ ನಮೂದುಗಳು',
      ledger_title:      'ಲೆಡ್ಜರ್',
      ledger_search_ph:  'ನಮೂದುಗಳನ್ನು ಹುಡುಕಿ…',
      ledger_col_date:   'ದಿನಾಂಕ',
      ledger_col_desc:   'ವಿವರಣೆ',
      ledger_col_cat:    'ವರ್ಗ',
      ledger_col_amt:    'ಮೊತ್ತ (₹)',
      ledger_col_bal:    'ಬ್ಯಾಲೆನ್ಸ್ (₹)',
      ledger_empty:      'ಇನ್ನೂ ನಮೂದುಗಳಿಲ್ಲ — ಎಡಭಾಗದಲ್ಲಿ ಸೇರಿಸಿ.',
      ledger_empty_full: 'ಈ ತಿಂಗಳು ನಮೂದುಗಳಿಲ್ಲ. ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಹೋಗಿ.',
      budget_title:      'ಮಾಸಿಕ ಬಜೆಟ್‌ಗಳು',
      budget_chart_title:'ಖರ್ಚು vs ಬಜೆಟ್ — ಚಾರ್ಟ್',
      budget_footnote:   'ಪ್ರತಿ ವರ್ಗಕ್ಕೆ ಮಾಸಿಕ ಮಿತಿ ನಿಗದಿ ಮಾಡಿ.',
      goals_savings:     'ಉಳಿತಾಯ ಗುರಿಗಳು',
      goals_deposit_footnote: 'ನಿಮ್ಮ ಬ್ಯಾಲೆನ್ಸ್‌ನಿಂದ ಗುರಿಯೆಡೆ ಠೇವಣಿ ಮಾಡಿ.',
      recurring_title:   'ಪುನರಾವರ್ತಿತ ವಹಿವಾಟುಗಳು',
      recurring_footnote:'ಯಾವಾಗ ಬೇಕಾದರೂ ಪುನರಾವರ್ತಿತ ನಮೂದು ಪೋಸ್ಟ್ ಮಾಡಿ.',
      charts_title:       'ಗ್ರಾಫ್ ಶೀಟ್',
      charts_back:        '← ಲೆಡ್ಜರ್‌ಗೆ ಹಿಂತಿರುಗಿ',
      charts_weekly:      'ಸಾಪ್ತಾಹಿಕ',
      charts_monthly:     'ಮಾಸಿಕ',
      charts_yearly:      'ವಾರ್ಷಿಕ',
      charts_total_income:'ಒಟ್ಟು ಆದಾಯ',
      charts_total_spent: 'ಒಟ್ಟು ಖರ್ಚು',
      charts_net_saved:   'ನಿವ್ವಳ ಉಳಿತಾಯ',
      charts_savings_rate:'ಉಳಿತಾಯ ದರ',
      charts_income_lbl:  'ಆದಾಯ',
      charts_expense_lbl: 'ಖರ್ಚು',
      charts_balance_lbl: 'ಬ್ಯಾಲೆನ್ಸ್',
      charts_net_lbl:     'ನಿವ್ವಳ',
      pp_title:         'ಪ್ರೊಫೈಲ್ ಮತ್ತು ಖಾತೆ',
      pp_back:          '← ಹಿಂತಿರುಗಿ',
      pp_account_info:  '🪪 ಖಾತೆ ಮಾಹಿತಿ',
      pp_user_id:       '🆔 ಬಳಕೆದಾರ ID',
      pp_email:         '✉️ ಇಮೇಲ್',
      pp_phone:         '📞 ಫೋನ್',
      pp_member_since:  '📅 ಸದಸ್ಯರಾದ ದಿನ',
      pp_storage:       '💾 ಸಂಗ್ರಹ ಬಳಕೆ',
      pp_edit_profile:  '✏️ ಪ್ರೊಫೈಲ್ ಸಂಪಾದಿಸಿ',
      pp_display_name:  'ಪ್ರದರ್ಶನ ಹೆಸರು',
      pp_save_btn:      '💾 ಬದಲಾವಣೆಗಳನ್ನು ಉಳಿಸಿ',
      pp_lang_head:     '🌐 ಭಾಷೆ',
      pp_danger_head:   '⚠️ ಅಪಾಯ ವಲಯ',
      pp_danger_desc:   'ಖಾತೆ ಅಳಿಸಿದರೆ ಎಲ್ಲಾ ಡೇಟಾ ಶಾಶ್ವತವಾಗಿ ನಾಶವಾಗುತ್ತದೆ.',
      pp_delete_btn:    '🗑️ ನನ್ನ ಖಾತೆ ಅಳಿಸಿ',
      pp_total_income:  'ಒಟ್ಟು ಆದಾಯ',
      pp_total_spent:   'ಒಟ್ಟು ಖರ್ಚು',
      pp_net_saved:     'ನಿವ್ವಳ ಉಳಿತಾಯ',
      pp_entries:       'ನಮೂದುಗಳು',
      menu_share:       '📤 ಈ ತಿಂಗಳು ಹಂಚಿಕೊಳ್ಳಿ',
      menu_export_csv:  '📥 CSV ರಫ್ತು',
      menu_copy_summary:'📋 ಸಾರಾಂಶ ನಕಲಿಸಿ',
      menu_export_pdf:  '📄 PDF ರಫ್ತು',
      menu_print:       '🖨️ ಮುದ್ರಣ ನೋಟ',
      menu_clear_month: '🗑️ ಈ ತಿಂಗಳು ಅಳಿಸಿ',
      menu_logout:      '↩ ಲಾಗ್ ಔಟ್',
      edit_title:       'ನಮೂದು ಸಂಪಾದಿಸಿ',
      edit_cancel:      'ರದ್ದುಮಾಡಿ',
      edit_save:        'ಬದಲಾವಣೆಗಳನ್ನು ಉಳಿಸಿ',
      del_title:        'ಖಾತೆ ಅಳಿಸಬೇಕೇ?',
      del_confirm_btn:  'ಶಾಶ್ವತವಾಗಿ ಅಳಿಸಿ',
      del_cancel:       'ರದ್ದುಮಾಡಿ',
      pdf_title:        '📄 PDF ರಫ್ತು',
      pdf_opt_month:    'ಪ್ರಸ್ತುತ ತಿಂಗಳ ವಹಿವಾಟುಗಳು',
      pdf_opt_summary:  'ಮಾಸಿಕ ಸಾರಾಂಶ',
      pdf_opt_all:      'ಎಲ್ಲಾ ವಹಿವಾಟುಗಳು',
      pdf_cancel:       'ರದ್ದುಮಾಡಿ',
      pdf_generate:     'PDF ರಚಿಸಿ',
      offline_msg:      '📵 ಆಫ್‌ಲೈನ್ — ಡೇಟಾ ಸುರಕ್ಷಿತ',
      online_msg:       '✓ ಮತ್ತೆ ಆನ್‌ಲೈನ್',
      gs_weekly_title:        'ಕಳೆದ 12 ವಾರಗಳು — ಆದಾಯ vs ವೆಚ್ಚ',
      gs_weekly_label:        'ಹಸಿರು = ಆದಾಯ · ಕೆಂಪು = ವೆಚ್ಚ · ಪ್ರತಿ ಜೋಡಿ = ಒಂದು ವಾರ',
      gs_weekly_bal_title:    'ಸಾಪ್ತಾಹಿಕ ಚಾಲ್ತಿ ಶಿಲ್ಕು',
      gs_weekly_cat_title:    'ಈ ವಾರ — ವರ್ಗ ವಾರು ವೆಚ್ಚ',
      gs_monthly_title:       '12 ತಿಂಗಳ ಅವಲೋಕನ — ಆದಾಯ vs ವೆಚ್ಚ',
      gs_monthly_label:       'ತಿಂಗಳಿಗೆ ಬಾರ್ ಜೋಡಿಗಳು · ರೇಖೆ = ಚಾಲ್ತಿ ಶಿಲ್ಕು',
      gs_monthly_savrate_title: 'ಮಾಸಿಕ ಉಳಿತಾಯ ದರ',
      gs_monthly_savrate_label: 'ಪ್ರತಿ ತಿಂಗಳು ಉಳಿತಾಯ ಮಾಡಿದ ಆದಾಯದ %',
      gs_monthly_cat_title:   'ಈ ತಿಂಗಳು — ವರ್ಗ ವಾರು ವೆಚ್ಚ',
      gs_yearly_title:        'ವರ್ಷ ವರ್ಷದ ಅವಲೋಕನ',
      gs_yearly_label:        'ಆದಾಯ · ವೆಚ್ಚ · ನಿವ್ವಳ ವಾರ್ಷಿಕ',
      gs_yearly_cat_title:    'ವರ್ಷ ವರ್ಷದ ವರ್ಗ ವಿಭಜನೆ',
      gs_savrate_lbl:         'ಉಳಿತಾಯ ದರ %',
      gs_budget_limit:        'ಬಜೆಟ್ ಮಿತಿ',
    },
  };

  // ── Element → key map ──────────────────────────────────
  const ELEM_MAP = [
    // Sidebar nav
    ['#sbNavDashboard .sb-nav-text',  'nav_dashboard'],
    ['#sbNavLedger .sb-nav-text',     'nav_ledger'],
    ['#sbNavBudgets .sb-nav-text',    'nav_budgets'],
    ['#sbNavGoals .sb-nav-text',      'nav_goals'],
    ['#sbNavCharts .sb-nav-text',     'nav_charts'],
    ['#sbNavProfile .sb-nav-text',    'nav_profile'],
    ['#sbLogout .sb-nav-text',        'nav_logout'],
    // Sidebar section labels
    ['.sb-section-label:last-of-type',       'nav_account'],
    // Header
    ['#headerGreetingLine',                  'header_greeting'],
    ['#hmsLabel',                            'header_month_elapsed'],
    ['.header-sparkline-label',              'header_7day_flow'],
    ['.header-insight-kpi-label',            'header_net_month'],
    // Balance strip
    ['.item-balance .label',                 'card_balance'],
    ['.item-spent .label',                   'card_month_spent'],
    ['.item-income .label',                  'card_month_income'],
    ['.item-savings .label',                 'card_net_saved'],
    // Quick stats
    ['.qs-item:nth-child(1) .qs-label',     'qs_biggest_expense'],
    ['.qs-item:nth-child(2) .qs-label',     'qs_avg_daily'],
    ['.qs-item:nth-child(3) .qs-label',     'qs_days_payday'],
    // Entry form
    ['.card-entry h2',                       'form_new_entry'],
    ['#typeExpense',                         'form_expense'],
    ['#typeIncome',                          'form_income'],
    ['#addBtn',                              'form_add_btn'],
    // Ledger
    ['.ledger-head h2',                      'ledger_recent'],
    ['#view-ledger .ledger-head h2',         'ledger_title'],
    // Budgets
    // Goals
    ['#view-goals .card:first-child h2',     'goals_savings'],
    ['#view-goals .card:first-child .footnote', 'goals_deposit_footnote'],
    ['#view-goals .card:nth-child(2) h2',    'recurring_title'],
    ['#view-goals .card:nth-child(2) .footnote', 'recurring_footnote'],
    // Charts
    ['#view-charts h2',                      'charts_title'],
    ['#gtabWeekly',                          'charts_weekly'],
    ['#gtabMonthly',                         'charts_monthly'],
    ['#gtabYearly',                          'charts_yearly'],
    // Graph sheet page
    ['.gs-title',                            'charts_title'],
    ['#gsBackBtn',                           'charts_back'],
    ['.gs-tab:nth-child(1)',                 'charts_weekly'],
    ['.gs-tab:nth-child(2)',                 'charts_monthly'],
    ['.gs-tab:nth-child(3)',                 'charts_yearly'],
    ['.gs-sum-card:nth-child(1) .gs-sum-label', 'charts_total_income'],
    ['.gs-sum-card:nth-child(2) .gs-sum-label', 'charts_total_spent'],
    ['.gs-sum-card:nth-child(3) .gs-sum-label', 'charts_net_saved'],
    ['.gs-sum-card:nth-child(4) .gs-sum-label', 'charts_savings_rate'],
    // Profile
    ['#profilePage .pp-title',               'pp_title'],
    ['#ppBackBtn',                           'pp_back'],
    ['#ppSaveBtn',                           'pp_save_btn'],
    ['#ppDeleteBtn',                         'pp_delete_btn'],
    ['.pp-stat-label:nth-child(1)',          'pp_total_income'],
    // Stats
    ['.pp-stat-item:nth-child(1) .pp-stat-label', 'pp_total_income'],
    ['.pp-stat-item:nth-child(3) .pp-stat-label', 'pp_total_spent'],
    ['.pp-stat-item:nth-child(5) .pp-stat-label', 'pp_net_saved'],
    ['.pp-stat-item:nth-child(7) .pp-stat-label', 'pp_entries'],
    // Lang section head
    // Menu
    ['#shareBtn',                            'menu_share'],
    ['#exportCsvBtn',                        'menu_export_csv'],
    ['#copySummaryBtn',                      'menu_copy_summary'],
    ['#exportPdfBtn',                        'menu_export_pdf'],
    ['#printBtn',                            'menu_print'],
    ['#clearMonthBtn',                       'menu_clear_month'],
    ['#menuLogoutBtn',                       'menu_logout'],
    // Edit modal
    ['#editModal h3',                        'edit_title'],
    ['#editCancelBtn',                       'edit_cancel'],
    ['#editSaveBtn',                         'edit_save'],
    // Delete modal
    ['.pp-modal-title',                      'del_title'],
    ['#ppModalConfirm',                      'del_confirm_btn'],
    ['#ppModalCancel',                       'del_cancel'],
    // PDF overlay
    ['#pdfBox h2',                           'pdf_title'],
    ['#pdfCancelBtn',                        'pdf_cancel'],
    ['#pdfGenerateBtn',                      'pdf_generate'],
    // PWA
    ['#pwaOfflineToast',                     'offline_msg'],
    ['#pwaOnlineToast',                      'online_msg'],
  ];

  // Placeholder map: [selector, attr, key]
  const PH_MAP = [
    ['#searchInput',      'placeholder', 'ledger_search_ph'],
    ['#searchInputLedger','placeholder', 'ledger_search_ph'],
    ['#fDesc',            'placeholder', 'form_desc_ph'],
    ['#fNote',            'placeholder', 'form_note_ph'],
    ['#editDesc',         'placeholder', 'form_description'],
    ['#editNote',         'placeholder', 'form_note_ph'],
  ];

  // ── Apply translations to DOM ───────────────────────────
  function applyLang(lang) {
    const T = TRANSLATIONS[lang] || TRANSLATIONS['en'];

    // Text content
    ELEM_MAP.forEach(([sel, key]) => {
      const els = document.querySelectorAll(sel);
      els.forEach(el => {
        if (T[key] !== undefined) el.textContent = T[key];
      });
    });

    // Placeholders
    PH_MAP.forEach(([sel, attr, key]) => {
      const el = document.querySelector(sel);
      if (el && T[key]) el.setAttribute(attr, T[key]);
    });

    // Form labels (special handling)
    const fAmtLabel = document.querySelector('.card-entry label:nth-of-type(1)');
    if (fAmtLabel) fAmtLabel.textContent = T.form_amount;

    const fDescLabel = document.querySelector('.card-entry label:nth-of-type(2)');
    if (fDescLabel) fDescLabel.textContent = T.form_description;

    const fNoteLabel = document.querySelector('.card-entry label:nth-of-type(4)');
    if (fNoteLabel) fNoteLabel.textContent = T.form_note;

    const fDateLabel = document.querySelector('.card-entry label:nth-of-type(5)');
    if (fDateLabel) fDateLabel.textContent = T.form_date;

    // Ledger table headers
    const thEls = document.querySelectorAll('#view-dashboard thead th, #view-ledger thead th');
    thEls.forEach(th => {
      const txt = th.textContent.trim();
      if (txt === 'Date' || th.dataset.i18n === 'date') { th.textContent = T.ledger_col_date; th.dataset.i18n = 'date'; }
      else if (txt === 'Description' || th.dataset.i18n === 'desc') { th.textContent = T.ledger_col_desc; th.dataset.i18n = 'desc'; }
      else if (txt === 'Category' || th.dataset.i18n === 'cat') { th.textContent = T.ledger_col_cat; th.dataset.i18n = 'cat'; }
    });

    // RTL support
    document.documentElement.dir = T.dir || 'ltr';
    document.documentElement.lang = lang;

    // Theme button
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      themeBtn.textContent = isDark ? T.header_theme_light : T.header_theme_dark;
    }

    // Update lang buttons active state
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Generic data-i18n attribute handler — catches all elements tagged with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (T[key] !== undefined) el.textContent = T[key];
    });

    // Budget chart legend "Budget limit" label
    if (typeof renderBreakdownBudget === 'function') {
      try { renderBreakdownBudget(); } catch(e) {}
    }

    // Persist
    try { localStorage.setItem('finhub_lang', lang); } catch(e) {}

    // Expose for dynamic JS (greetings etc)
    window._finhubT = T;
    window._finhubLang = lang;
  }

  // ── Wire up language buttons ────────────────────────────
  function initLangButtons() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => applyLang(btn.dataset.lang));
    });
  }

  // ── Auto-apply sidebar nav data attributes ──────────────
  function tagSidebarItems() {
    const map = {
      sbNavDashboard: 'dashboard',
      sbNavLedger:    'ledger',
      sbNavBudgets:   'budgets',
      sbNavGoals:     'goals',
      sbNavCharts:    'charts',
      sbNavProfile:   'profile',
    };
    Object.entries(map).forEach(([id, nav]) => {
      const el = document.getElementById(id);
      if (el) el.setAttribute('data-nav', nav);
    });
  }

  // ── Boot ────────────────────────────────────────────────
  function boot() {
    tagSidebarItems();
    initLangButtons();
    const saved = (() => { try { return localStorage.getItem('finhub_lang'); } catch(e) { return null; } })();
    applyLang(saved && TRANSLATIONS[saved] ? saved : 'en');
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    // Re-apply after a short delay so dynamic elements render first
    setTimeout(boot, 800);
  }

  // Public API
  window.finhubI18n = { apply: applyLang, t: (k) => (window._finhubT || TRANSLATIONS.en)[k] || k };

  // ── Language Settings Page ───────────────────────────
  const LANG_NAMES = {
    en: 'English', hi: 'हिंदी', ta: 'தமிழ்', te: 'తెలుగు',
    ml: 'മലയാളം', kn: 'ಕನ್ನಡ'
  };

  // openLangPage / closeLangPage defined in standalone script above langSettingsPage HTML
  var openLangPage = window._openLangPage || function(){};
  var closeLangPage = window._closeLangPage || function(){};

  function updateLangNavLabel(lang) {
    const el = document.getElementById('ppCurrentLangLabel');
    if (el) el.textContent = LANG_NAMES[lang] || 'English';
  }

  // Patch applyLang to also update the nav button label
  const _origApply = window.finhubI18n.apply;
  window.finhubI18n.apply = function(lang) {
    _origApply(lang);
    updateLangNavLabel(lang);
  };

  function initLangPage() {
    // Language buttons inside the page
    document.querySelectorAll('.lang-page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;
        applyLang(lang);
        updateLangNavLabel(lang);
        document.querySelectorAll('.lang-page-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
        document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
        if (window.showToast) window.showToast('Language changed ✓', 'success');
      });
    });

    // Set initial label
    const saved = (() => { try { return localStorage.getItem('finhub_lang'); } catch(e) { return null; } })();
    updateLangNavLabel(saved || 'en');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLangPage);
  } else {
    initLangPage();
  }
  window._initLangPage = initLangPage;

})();

/* ===== i18n-extension.js ===== */
// ══════════════════════════════════════════════════════════
//  FINHUB i18n EXTENSION — dynamic content (categories, months,
//  goals/recurring text, placeholders). Re-applies after every re-render.
// ══════════════════════════════════════════════════════════
(function () {
  var LANGS = ['hi','ta','te','ml','kn'];
  // rows: [English, hi, ta, te, ml, kn]
  var ROWS = [
    ["Food", "भोजन", "உணவு", "ఆహారం", "ഭക്ഷണം", "ಆಹಾರ"],
    ["Groceries", "किराना", "மளிகை", "కిరాణా", "പലചരക്ക്", "ದಿನಸಿ"],
    ["Dining Out", "बाहर खाना", "வெளியே சாப்பிடுதல்", "బయట భోజనం", "പുറത്തു ഭക്ഷണം", "ಹೊರಗೆ ಊಟ"],
    ["Transport", "परिवहन", "போக்குவரத்து", "రవాణా", "ഗതാഗതം", "ಸಾರಿಗೆ"],
    ["Fuel", "ईंधन", "எரிபொருள்", "ఇంధనం", "ഇന്ധനം", "ಇಂಧನ"],
    ["Housing", "आवास", "வீட்டுவசதி", "నివాసం", "പാർപ്പിടം", "ವಸತಿ"],
    ["Utilities", "उपयोगिताएँ", "பயன்பாட்டு கட்டணங்கள்", "యుటిలిటీలు", "യൂട്ടിലിറ്റികൾ", "ಉಪಯುಕ್ತತೆಗಳು"],
    ["Entertainment", "मनोरंजन", "பொழுதுபோக்கு", "వినోదం", "വിനോദം", "ಮನರಂಜನೆ"],
    ["Shopping", "खरीदारी", "ஷாப்பிங்", "షాపింగ్", "ഷോപ്പിംഗ്", "ಶಾಪಿಂಗ್"],
    ["Clothing", "कपड़े", "ஆடைகள்", "దుస్తులు", "വസ്ത്രങ്ങൾ", "ಬಟ್ಟೆ"],
    ["Medical", "चिकित्सा", "மருத்துவம்", "వైద్యం", "വൈദ്യം", "ವೈದ್ಯಕೀಯ"],
    ["Health", "स्वास्थ्य", "சுகாதாரம்", "ఆరోగ్యం", "ആരോഗ്യം", "ಆರೋಗ್ಯ"],
    ["Education", "शिक्षा", "கல்வி", "విద్య", "വിദ്യാഭ്യാസം", "ಶಿಕ್ಷಣ"],
    ["Subscriptions", "सदस्यताएँ", "சந்தாக்கள்", "చందాలు", "സബ്സ്ക്രിപ്ഷനുകൾ", "ಚಂದಾದಾರಿಕೆಗಳು"],
    ["Insurance", "बीमा", "காப்பீடு", "బీమా", "ഇൻഷുറൻസ്", "ವಿಮೆ"],
    ["EMI / Loan", "ईएमआई / ऋण", "EMI / கடன்", "EMI / రుణం", "EMI / വായ്പ", "EMI / ಸಾಲ"],
    ["Personal Care", "व्यक्तिगत देखभाल", "தனிப்பட்ட பராமரிப்பு", "వ్యక్తిగత సంరక్షణ", "വ്യക്തിഗത പരിചരണം", "ವೈಯಕ್ತಿಕ ಆರೈಕೆ"],
    ["Travel", "यात्रा", "பயணம்", "ప్రయాణం", "യാത്ര", "ಪ್ರಯಾಣ"],
    ["Gifts", "उपहार", "பரிசுகள்", "బహుమతులు", "സമ്മാനങ്ങൾ", "ಉಡುಗೊರೆಗಳು"],
    ["Savings", "बचत", "சேமிப்பு", "పొదుపు", "സമ്പാദ്യം", "ಉಳಿತಾಯ"],
    ["Other", "अन्य", "மற்றவை", "ఇతరాలు", "മറ്റുള്ളവ", "ಇತರೆ"],
    ["Income", "आय", "வருமானம்", "ఆదాయం", "വരുമാനം", "ಆದಾಯ"],
    ["Expense", "खर्च", "செலவு", "ఖర్చు", "ചെലവ്", "ಖರ್ಚು"],
    ["All Months", "सभी महीने", "அனைத்து மாதங்கள்", "అన్ని నెలలు", "എല്ലാ മാസങ്ങളും", "ಎಲ್ಲಾ ತಿಂಗಳುಗಳು"],
    ["no entries yet", "अभी कोई प्रविष्टि नहीं", "இன்னும் பதிவுகள் இல்லை", "ఇంకా ఎంట్రీలు లేవు", "എൻട്രികളൊന്നുമില്ല", "ಇನ್ನೂ ನಮೂದುಗಳಿಲ್ಲ"],
    ["No entries yet", "अभी कोई प्रविष्टि नहीं", "இன்னும் பதிவுகள் இல்லை", "ఇంకా ఎంట్రీలు లేవు", "എൻട്രികളൊന്നുമില്ല", "ಇನ್ನೂ ನಮೂದುಗಳಿಲ್ಲ"],
    ["Deposit", "जमा करें", "டெபாசிட்", "డిపాజిట్", "നിക്ഷേപിക്കുക", "ಜಮಾ ಮಾಡಿ"],
    ["Post", "पोस्ट करें", "பதிவிடு", "పోస్ట్", "പോസ്റ്റ്", "ಪೋಸ್ಟ್"],
    ["Save", "सहेजें", "சேமி", "సేవ్", "സേവ്", "ಉಳಿಸಿ"],
    ["Complete", "पूर्ण", "முடிந்தது", "పూర్తయింది", "പൂർത്തിയായി", "ಪೂರ್ಣ"],
    ["Progress", "प्रगति", "முன்னேற்றம்", "పురోగతి", "പുരോഗതി", "ಪ್ರಗತಿ"],
    ["Goal Name", "लक्ष्य का नाम", "இலக்கின் பெயர்", "లక్ష్యం పేరు", "ലക്ഷ്യത്തിന്റെ പേര്", "ಗುರಿಯ ಹೆಸರು"],
    ["Target (₹)", "लक्ष्य (₹)", "இலக்கு (₹)", "లక్ష్యం (₹)", "ലക്ഷ്യം (₹)", "ಗುರಿ (₹)"],
    ["Saved (₹)", "बचाए (₹)", "சேமித்தது (₹)", "పొదుపు (₹)", "സമ്പാദിച്ചത് (₹)", "ಉಳಿಸಿದ್ದು (₹)"],
    ["Name", "नाम", "பெயர்", "పేరు", "പേര്", "ಹೆಸರು"],
    ["Type", "प्रकार", "வகை", "రకం", "തരം", "ಪ್ರಕಾರ"],
    ["Frequency", "आवृत्ति", "அதிர்வெண்", "ఫ్రీక్వెన్సీ", "ആവൃത്തി", "ಆವರ್ತನ"],
    ["Amount (₹)", "राशि (₹)", "தொகை (₹)", "మొత్తం (₹)", "തുക (₹)", "ಮೊತ್ತ (₹)"],
    ["Balance (₹)", "शेष (₹)", "இருப்பு (₹)", "నిల్వ (₹)", "ബാലൻസ് (₹)", "ಬಾಕಿ (₹)"],
    ["Category", "श्रेणी", "வகை", "వర్గం", "വിഭാഗം", "ವರ್ಗ"],
    ["Monthly", "मासिक", "மாதாந்திரம்", "నెలవారీ", "പ്രതിമാസം", "ಮಾಸಿಕ"],
    ["Weekly", "साप्ताहिक", "வாராந்திரம்", "వారానికి", "പ്രതിവാരം", "ವಾರಕ್ಕೊಮ್ಮೆ"],
    ["Yearly", "वार्षिक", "ஆண்டுதோறும்", "వార్షికం", "വാർഷികം", "ವಾರ್ಷಿಕ"],
    ["No goals yet — add one below.", "अभी कोई लक्ष्य नहीं — नीचे जोड़ें।", "இன்னும் இலக்குகள் இல்லை — கீழே சேர்க்கவும்.", "ఇంకా లక్ష్యాలు లేవు — క్రింద జోడించండి.", "ലക്ഷ്യങ്ങളൊന്നുമില്ല — താഴെ ചേർക്കുക.", "ಇನ್ನೂ ಗುರಿಗಳಿಲ್ಲ — ಕೆಳಗೆ ಸೇರಿಸಿ."],
    ["No recurring items yet — add one below.", "अभी कोई आवर्ती आइटम नहीं — नीचे जोड़ें।", "இன்னும் தொடர் பதிவுகள் இல்லை — கீழே சேர்க்கவும்.", "ఇంకా పునరావృత అంశాలు లేవు — క్రింద జోడించండి.", "ആവർത്തന ഇനങ്ങളൊന്നുമില്ല — താഴെ ചേർക്കുക.", "ಇನ್ನೂ ಮರುಕಳಿಸುವ ಅಂಶಗಳಿಲ್ಲ — ಕೆಳಗೆ ಸೇರಿಸಿ."],
    ["Goal name…", "लक्ष्य का नाम…", "இலக்கின் பெயர்…", "లక్ష్యం పేరు…", "ലക്ഷ്യത്തിന്റെ പേര്…", "ಗುರಿಯ ಹೆಸರು…"],
    ["Name…", "नाम…", "பெயர்…", "పేరు…", "പേര്…", "ಹೆಸರು…"],
    ["Email", "ईमेल", "மின்னஞ்சல்", "ఇమెయిల్", "ഇമെയിൽ", "ಇಮೇಲ್"],
    ["Phone", "फ़ोन", "தொலைபேசி", "ఫోన్", "ഫോൺ", "ಫೋನ್"],
    ["Your name", "आपका नाम", "உங்கள் பெயர்", "మీ పేరు", "നിങ്ങളുടെ പേര്", "ನಿಮ್ಮ ಹೆಸರು"],
    ["Language", "भाषा", "மொழி", "భాష", "ഭാഷ", "ಭಾಷೆ"],
    ["Settings", "सेटिंग्स", "அமைப்புகள்", "సెట్టింగ్‌లు", "ക്രമീകരണങ്ങൾ", "ಸೆಟ್ಟಿಂಗ್‌ಗಳು"],
    ["Language Settings", "भाषा सेटिंग्स", "மொழி அமைப்புகள்", "భాషా సెట్టింగ్‌లు", "ഭാഷാ ക്രമീകരണങ്ങൾ", "ಭಾಷಾ ಸೆಟ್ಟಿಂಗ್‌ಗಳು"],
    ["Choose Your Language", "अपनी भाषा चुनें", "உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்", "మీ భాషను ఎంచుకోండి", "നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക", "ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ"],
    ["Select the language for the entire app. Your choice is saved automatically.", "पूरे ऐप के लिए भाषा चुनें। आपकी पसंद अपने-आप सहेज ली जाती है।", "முழு பயன்பாட்டிற்கும் மொழியைத் தேர்ந்தெடுக்கவும். உங்கள் தேர்வு தானாகவே சேமிக்கப்படும்.", "మొత్తం యాప్‌కు భాషను ఎంచుకోండి. మీ ఎంపిక స్వయంచాలకంగా సేవ్ అవుతుంది.", "ആപ്പിനുള്ള ഭാഷ തിരഞ്ഞെടുക്കുക. നിങ്ങളുടെ തിരഞ്ഞെടുപ്പ് സ്വയം സേവ് ആകും.", "ಇಡೀ ಆ್ಯಪ್‌ಗೆ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ. ನಿಮ್ಮ ಆಯ್ಕೆ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಉಳಿಯುತ್ತದೆ."],
    ["Back", "वापस", "திரும்பு", "వెనుకకు", "തിരികെ", "ಹಿಂದೆ"],
    ["Target ₹", "लक्ष्य ₹", "இலக்கு ₹", "లక్ష్యం ₹", "ലക്ഷ്യം ₹", "ಗುರಿ ₹"]
  ];
  var DICT = {};
  LANGS.forEach(function (l, i) {
    DICT[l] = {};
    ROWS.forEach(function (r) { DICT[l][r[0]] = r[i + 1]; });
  });
  var LOC = {hi:'hi-IN',ta:'ta-IN',te:'te-IN',ml:'ml-IN',kn:'kn-IN'};
  var EN_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var MONTH_RE = new RegExp('^(' + EN_MONTHS.join('|') + ') (\\d{4})$');

  var touched = [];            // text nodes we changed: {n, orig}
  var touchedPh = [];          // placeholder elements: {el, orig}
  var appliedLang = 'en';
  var busy = false;

  function curLang() {
    var l = window._finhubLang;
    if (!l) { try { l = localStorage.getItem('finhub_lang'); } catch (e) {} }
    return l || 'en';
  }

  function translateText(txt, lang) {
    var d = DICT[lang]; if (!d) return null;
    var t = txt.trim(); if (!t) return null;
    if (d[t] !== undefined) return txt.replace(t, d[t]);
    var pm = /^([^A-Za-z0-9]+\s)(.+)$/.exec(t);
    if (pm && d[pm[2]] !== undefined) return txt.replace(t, pm[1] + d[pm[2]]);
    var m = MONTH_RE.exec(t);
    if (m) {
      var dt = new Date(parseInt(m[2], 10), EN_MONTHS.indexOf(m[1]), 1);
      return txt.replace(t, dt.toLocaleDateString(LOC[lang], {month: 'long', year: 'numeric'}));
    }
    return null;
  }

  function walk(root, lang) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode; if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.nodeName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = w.nextNode())) {
      var out = translateText(n.nodeValue, lang);
      if (out !== null && out !== n.nodeValue) {
        touched.push({n: n, orig: n.nodeValue});
        n.nodeValue = out;
      }
    }
    if (root.querySelectorAll) {
      root.querySelectorAll('[placeholder]').forEach(function (el) {
        var ph = el.getAttribute('placeholder');
        var d = DICT[lang];
        if (d && d[ph] !== undefined) {
          touchedPh.push({el: el, orig: ph});
          el.setAttribute('placeholder', d[ph]);
        }
      });
    }
  }

  function restore() {
    touched.forEach(function (t) { if (t.n.isConnected) t.n.nodeValue = t.orig; });
    touchedPh.forEach(function (t) { if (t.el.isConnected) t.el.setAttribute('placeholder', t.orig); });
    touched = []; touchedPh = [];
  }

  function run() {
    if (busy) return;
    busy = true;
    if (observer) observer.disconnect();
    try {
      var lang = curLang();
      if (lang !== appliedLang) { restore(); appliedLang = lang; }
      if (lang !== 'en' && DICT[lang]) walk(document.body, lang);
    } catch (e) { console.warn('i18n ext:', e); }
    if (observer) observer.observe(document.body, {childList: true, subtree: true, characterData: true});
    busy = false;
  }

  var pending = false;
  var observer = new MutationObserver(function () {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; run(); });
  });

  window.__fhTr = function (txt) {
    var l = curLang(); if (l === 'en' || !DICT[l]) return txt;
    var r = translateText(txt, l); return r === null ? txt : r;
  };

  function refreshGreeting() {
    if (typeof updateHeaderGreeting === 'function') { try { updateHeaderGreeting(); } catch (e) {} }
  }

  // Wrap public apply() so changing language re-runs everything
  function hook() {
    if (!window.finhubI18n || window.finhubI18n.__ext) return !!(window.finhubI18n && window.finhubI18n.__ext);
    var orig = window.finhubI18n.apply;
    window.finhubI18n.apply = function (lang) {
      orig(lang);
      window._finhubLang = lang;
      run();
      refreshGreeting();
    };
    window.finhubI18n.__ext = true;
    return true;
  }

  // Safety net: notice language changes made through any path
  var lastSeen = curLang();
  setInterval(function () {
    var l = curLang();
    if (l !== lastSeen) { lastSeen = l; run(); refreshGreeting(); }
  }, 400);

  function start() {
    hook();
    observer.observe(document.body, {childList: true, subtree: true, characterData: true});
    run();
    setTimeout(function () { run(); refreshGreeting(); }, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
