
"use strict";
var TG = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
if (TG) { try { TG.ready(); TG.expand(); } catch(e){} }

function dkey(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function today(){ return dkey(new Date()); }
function addDays(key,n){ var p=key.split('-'); var d=new Date(+p[0],+p[1]-1,+p[2]); d.setDate(d.getDate()+n); return dkey(d); }
function weekdayShort(key){ var p=key.split('-'); return ['вс','пн','вт','ср','чт','пт','сб'][new Date(+p[0],+p[1]-1,+p[2]).getDay()]; }

var DEFAULTS = {
  tasks: [],
  hist: {},
  xp: 0,
  frozen: [],
  lastFreeze: null,
  mood: {},
  bosses: { b7:{start:null,done:false}, b14:{start:null,done:false}, b30:{start:null,done:false} },
  settings: { morning:'Доброе утро! Маленькие шаги — большие результаты 🌻', evening:'Вечерний чек: закрыл(а) день?', personal:'' },
  seenMsgDate: null
};
var KEY='lifeTrackerV4';
function load(){ try{ var raw=localStorage.getItem(KEY); if(!raw) return JSON.parse(JSON.stringify(DEFAULTS)); var s=JSON.parse(raw); for(var k in DEFAULTS){ if(!(k in s)) s[k]=JSON.parse(JSON.stringify(DEFAULTS[k])); } return s; }catch(e){ return JSON.parse(JSON.stringify(DEFAULTS)); } }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} }
var S = load();

var TITLES=[[0,'Стажёр 🌱'],[50,'Боец 💪'],[150,'Дисциплинированный ⚡'],[350,'Мастер режима 🎯'],[700,'Титан дисциплины 🛡️'],[1200,'Легенда 👑'],[2000,'Легенда 👑']];
function titleInfo(xp){
  var idx=0; for(var i=0;i<TITLES.length;i++){ if(xp>=TITLES[i][0]) idx=i; }
  var cur=TITLES[idx], next=TITLES[idx+1]||null;
  var lo=cur[0], hi=next?next[0]:cur[0]+1;
  var pct= next? Math.min(100,Math.round((xp-lo)/(hi-lo)*100)) : 100;
  return {name:cur[1], pct:pct, toNext: next? (hi-xp):0, nextName: next? next[1]:null};
}
function streak(){
  var s=0, d=new Date(); var k=dkey(d);
  if(!(S.hist[k]&&S.hist[k].c)) d.setDate(d.getDate()-1);
  while(true){ k=dkey(d); if((S.hist[k]&&S.hist[k].c)||S.frozen.indexOf(k)>=0){ s++; d.setDate(d.getDate()-1); } else break; }
  return s;
}
function fireFor(n){ if(n>=30) return '🐉'; if(n>=7) return '🔥🔥'; if(n>=3) return '🔥'; return '⭐'; }

var PHRASES=['Дисциплина — это выбор между тем, что хочешь сейчас, и тем, чего хочешь больше всего.','Сделай сегодня то, за что завтра скажешь себе спасибо.','Мотивация приходит после начала, а не до.','Ты не обязан(а) быть идеальным(ой) — просто не сдавайся.','Один день за раз. Сегодняшний — этот.'];

function ensureToday(){
  var t=today();
  if(!S.hist[t]) S.hist[t]={d:0,t:S.tasks.length,c:false};
  S.hist[t].t=S.tasks.length;
}
function doneCount(){ ensureToday(); return S.hist[today()].d; }

/* ---------- конфетти ---------- */
function confetti(){
  var colors=['#FFD54F','#FFB300','#FF8F00','#4FC3F7','#81C784','#F06292'];
  for(var i=0;i<60;i++){
    var c=document.createElement('div');
    c.className='confetti';
    c.style.left=Math.random()*100+'vw';
    c.style.background=colors[i%colors.length];
    c.style.animationDelay=(Math.random()*0.4)+'s';
    c.style.animationDuration=(1.6+Math.random()*1.4)+'s';
    c.style.transform='rotate('+Math.random()*360+'deg)';
    document.body.appendChild(c);
    setTimeout(function(){ if(c.parentNode) c.parentNode.removeChild(c); },3400);
  }
}
function toast(msg){
  var t=document.createElement('div'); t.className='toast'; t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(function(){ t.classList.add('show'); },10);
  setTimeout(function(){ t.classList.remove('show'); setTimeout(function(){ if(t.parentNode)t.parentNode.removeChild(t); },300); },2200);
}

/* ---------- вкладки ---------- */
function showTab(name){
  ['habits','rating','quests','mood','profile'].forEach(function(t){
    document.getElementById('tab-'+t).style.display = (t===name)?'block':'none';
    var b=document.getElementById('btn-'+t); if(b) b.classList.toggle('active', t===name);
  });
  if(name==='habits') renderHabits();
  if(name==='rating') renderRating();
  if(name==='quests') renderQuests();
  if(name==='mood') renderMood();
  if(name==='profile') renderProfile();
  window.scrollTo(0,0);
}

/* ---------- задачи ---------- */
function addTask(){
  var inp=document.getElementById('new-task');
  var v=inp.value.trim(); if(!v) return;
  S.tasks.push({id:Date.now(),text:v,done:false});
  inp.value=''; ensureToday(); save(); renderHabits();
}
function toggleTask(id,ev){
  for(var i=0;i<S.tasks.length;i++){
    if(S.tasks[i].id===id){
      S.tasks[i].done=!S.tasks[i].done;
      if(S.tasks[i].done){ S.xp+=10; S.hist[today()].d++; maybeGold(); }
      else { S.xp=Math.max(0,S.xp-10); S.hist[today()].d=Math.max(0,S.hist[today()].d-1); }
    }
  }
  save(); renderHabits(); checkDayClosed();
}
function maybeGold(){ /* случайные монеты убраны по просьбе */ }

function checkDayClosed(){
  ensureToday();
  var h=S.hist[today()];
  if(S.tasks.length>0 && h.d>=S.tasks.length && !h.c){
    h.c=true; S.xp+=30; save(); confetti(); showSummary();
  }
}
function showSummary(){
  var t=today(); var h=S.hist[t];
  var st=streak(); var info=titleInfo(S.xp);
  document.getElementById('sum-tasks').textContent=h.d+' из '+h.t;
  document.getElementById('sum-streak').textContent=st+' '+fireFor(st);
  document.getElementById('sum-title').textContent=info.name;
  document.getElementById('sum-xp').textContent='+'+(h.t*10+30)+' XP сегодня · всего '+S.xp+' XP';
  document.getElementById('summary-modal').style.display='flex';
}
function closeSummary(){ document.getElementById('summary-modal').style.display='none'; }

/* ---------- рендер главной ---------- */
function renderHabits(){
  ensureToday();
  var st=streak();
  document.getElementById('morning-msg').textContent=S.settings.morning;
  document.getElementById('streak-fire').textContent=fireFor(st);
  document.getElementById('streak-num').textContent=st;
  document.getElementById('streak-word').textContent=plural(st,'день','дня','дней')+' в дисциплине';
  var info=titleInfo(S.xp);
  document.getElementById('xp-title').textContent=info.name;
  document.getElementById('xp-num').textContent=S.xp+' XP';
  document.getElementById('xp-bar').style.width=info.pct+'%';
  document.getElementById('xp-next').textContent= info.nextName? ('до «'+info.nextName+'»: '+info.toNext+' XP') : 'максимальный титул!';
  // задачи
  var list=document.getElementById('task-list'); list.innerHTML='';
  S.tasks.forEach(function(task){
    var li=document.createElement('li'); li.className='task'+(task.done?' done':'');
    li.innerHTML='<span class="check">'+(task.done?'✓':'')+'</span><span class="txt"></span>';
    li.querySelector('.txt').textContent=task.text;
    li.onclick=function(){ toggleTask(task.id); };
    list.appendChild(li);
  });
  document.getElementById('day-progress').textContent=doneCount()+' / '+S.tasks.length;
  var days=['пн','вт','ср','чт','пт','сб','вс'];
  var monday=new Date(); monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
  var w=document.getElementById('week-strip'); w.innerHTML='';
  for(var i=0;i<7;i++){
    var k=dkey(monday);
    var el=document.createElement('div');
    var h=S.hist[k];
    var cls='wd'+((h&&h.c)?' closed':((h&&h.t>0)?' partial':''));
    if(k===today()) cls+=' today';
    el.className=cls;
    el.innerHTML='<div class="wd-l">'+days[i]+'</div><div class="wd-d">'+(h&&h.c?'✓':(h&&h.t>0? h.d+'/'+h.t:'·'))+'</div>';
    w.appendChild(el);
    monday.setDate(monday.getDate()+1);
  }
  document.getElementById('phrase-day').textContent=PHRASES[new Date().getDate()%PHRASES.length];
  renderFreeze();
  maybePersonal();
}
function plural(n,a,b,c){ var m=n%10, h=n%100; if(m===1&&h!==11) return a; if(m>=2&&m<=4&&(h<12||h>14)) return b; return c; }

function renderFreeze(){
  var box=document.getElementById('freeze-box'); box.style.display='none';
  var y=addDays(today(),-1);
  var yh=S.hist[y];
  if(yh && yh.t>0 && !yh.c && S.frozen.indexOf(y)<0 && streak()===0 || (yh && yh.t>0 && !yh.c && S.frozen.indexOf(y)<0)){
    var ok= !S.lastFreeze || (new Date()-new Date(S.lastFreeze))>=7*24*3600*1000;
    if(ok){ box.style.display='block'; }
  }
}
function doFreeze(){
  var y=addDays(today(),-1);
  S.frozen.push(y); S.lastFreeze=today(); save(); renderHabits();
  toast('Вчерашний день заморожен ❄️ Серия сохранена!');
}

function maybePersonal(){
  var y=addDays(today(),-1);
  var yh=S.hist[y];
  var failed= yh && yh.t>0 && !yh.c && S.frozen.indexOf(y)<0;
  if(failed && S.settings.personal && S.seenMsgDate!==today()){
    S.seenMsgDate=today(); save();
    document.getElementById('pm-text').textContent=S.settings.personal;
    document.getElementById('personal-modal').style.display='flex';
  }
}
function closePersonal(){ document.getElementById('personal-modal').style.display='none'; renderFreeze(); }

/* ---------- рейтинг ---------- */
function renderRating(){
  var t=today(), y=addDays(t,-1);
  var hT=S.hist[t]||{d:0,t:0,c:false}, hY=S.hist[y]||{d:0,t:0,c:false};
  document.getElementById('r-y-val').textContent=hY.d;
  document.getElementById('r-t-val').textContent=hT.d;
  var race=document.getElementById('race-msg');
  if(hY.t>0 && hT.d<=hY.d && hY.c){
    race.textContent='Осталось закрыть '+(hY.d-hT.d+1)+' задач(и), чтобы победить вчерашний день!';
  } else if(hY.t>0 && hT.d>hY.d){ race.textContent='Ты уже впереди вчерашней себя! 🏆'; }
  else { race.textContent='Закрывай задачи — и побеждай себя вчерашнюю.'; }
  var bars=document.getElementById('week-bars'); bars.innerHTML='';
  var max=1;
  for(var i=6;i>=0;i--){ var h=S.hist[addDays(t,-i)]; if(h) max=Math.max(max,h.d); }
  for(var i=6;i>=0;i--){
    var k=addDays(t,-i), h=S.hist[k]||{d:0};
    var el=document.createElement('div'); el.className='wbar';
    el.innerHTML='<div class="wb-fill" style="height:'+Math.round(h.d/max*100)+'%"></div><div class="wb-l">'+weekdayShort(k)+'</div>';
    bars.appendChild(el);
  }
}

/* ---------- вызовы ---------- */
var BOSSES=[['b7',7,'Неделя дисциплины',7],['b14',14,'Две недели стали',14],['b30',30,'Месяц титана',30]];
function closedSince(start){
  var n=0, d=new Date(start); var tk=today();
  while(dkey(d)!==tk){ var k=dkey(d); if((S.hist[k]&&S.hist[k].c)||S.frozen.indexOf(k)>=0) n++; d.setDate(d.getDate()+1); }
  if(S.hist[tk]&&S.hist[tk].c) n++;
  return n;
}
function renderQuests(){
  var box=document.getElementById('boss-list'); box.innerHTML='';
  BOSSES.forEach(function(b){
    var bs=S.bosses[b[0]];
    var prog= bs.start? Math.min(b[1],closedSince(bs.start)) : 0;
    var done = prog>=b[1];
    if(done && !bs.done){ bs.done=true; S.xp+=b[3]*10; save(); confetti(); toast('Босс повержен! +'+(b[3]*10)+' XP'); }
    var card=document.createElement('div'); card.className='boss-card';
    var inner='<div class="boss-top"><span class="boss-name">⚔️ '+b[2]+'</span><span class="boss-xp">'+(b[3]*10)+' XP</span></div>';
    inner+='<div class="boss-bar"><div class="boss-fill" style="width:'+(prog/b[1]*100)+'%"></div></div>';
    inner+='<div class="boss-info">'+(done?'Повержен! 🏆':(bs.start? prog+' из '+b[1]+' дней':'Не начат'))+'</div>';
    card.innerHTML=inner;
    var btn=document.createElement('button'); btn.className='btn small';
    btn.textContent= bs.start? (done?'Завершён':'Начать заново') : 'Начать вызов';
    btn.onclick=function(){ bs.start = bs.start? null : today(); bs.done=false; save(); renderQuests(); };
    card.appendChild(btn);
    box.appendChild(card);
  });
}

/* ---------- настроение ---------- */
var MOODS=['😞','🙁','😐','🙂','😄'];
function renderMood(){
  var box=document.getElementById('mood-picker'); box.innerHTML='';
  MOODS.forEach(function(m,i){
    var b=document.createElement('button'); b.className='mood-btn';
    b.textContent=m;
    if(S.mood[today()]===i+1) b.classList.add('active');
    b.onclick=function(){ S.mood[today()]=i+1; save(); renderMood(); };
    box.appendChild(b);
  });
  var hist=document.getElementById('mood-history'); hist.innerHTML='';
  for(var i=6;i>=0;i--){
    var k=addDays(today(),-i), m=S.mood[k];
    var el=document.createElement('div'); el.className='mh-cell';
    el.innerHTML='<div class="mh-emoji">'+(m?MOODS[m-1]:'·')+'</div><div class="mh-l">'+weekdayShort(k)+'</div>';
    hist.appendChild(el);
  }
}

/* ---------- профиль ---------- */
function renderProfile(){
  var totalDays=0,totalTasks=0,best=0,cur=0;
  var keys=Object.keys(S.hist).sort();
  keys.forEach(function(k){
    var h=S.hist[k];
    if(h.c||S.frozen.indexOf(k)>=0){ totalDays++; cur++; best=Math.max(best,cur); } else cur=0;
    totalTasks+=h.d;
  });
  document.getElementById('p-days').textContent=totalDays;
  document.getElementById('p-tasks').textContent=totalTasks;
  document.getElementById('p-streak').textContent=best;
  var info=titleInfo(S.xp);
  document.getElementById('p-title').textContent=info.name;
  document.getElementById('p-xp').textContent=S.xp+' XP';
  // рост месяца
  var now=new Date(), prev=new Date(now.getFullYear(),now.getMonth()-1,1);
  function monthStats(y,m){ var done=0,total=0; for(var k in S.hist){ var p=k.split('-'); if(+p[0]===y&&+p[1]===m+1){ done+=S.hist[k].d; total+=S.hist[k].t; } } return total? Math.round(done/total*100):0; }
  var curPct=monthStats(now.getFullYear(),now.getMonth()), prevPct=monthStats(prev.getFullYear(),prev.getMonth());
  var gr=document.getElementById('p-growth');
  if(prevPct>0){ var diff=curPct-prevPct; gr.textContent=(diff>=0?'Этот месяц лучше прошлого на +':'Этот месяц слабее прошлого на ')+Math.abs(diff)+'%'; gr.style.color=diff>=0?'#2e7d32':'#c62828'; }
  else gr.textContent='Статистика текущего месяца накапливается';
  // кольцо года: 12 недель
  var ring=document.getElementById('year-ring'); ring.innerHTML='';
  var start=new Date(); start.setDate(start.getDate()-83);
  for(var i=0;i<84;i++){
    var k=dkey(start);
    var el=document.createElement('div');
    var h=S.hist[k];
    el.className='ring-cell'+((h&&h.c)?' closed':(S.frozen.indexOf(k)>=0?' frozen':(h&&h.t>0?' partial':'')));
    ring.appendChild(el);
    start.setDate(start.getDate()+1);
  }
  // настройки
  document.getElementById('set-morning').value=S.settings.morning;
  document.getElementById('set-evening').value=S.settings.evening;
  document.getElementById('set-personal').value=S.settings.personal;
}
function saveSettings(){
  S.settings.morning=document.getElementById('set-morning').value;
  S.settings.evening=document.getElementById('set-evening').value;
  S.settings.personal=document.getElementById('set-personal').value;
  save(); toast('Настройки сохранены 🌻');
}

/* ---------- страж: прячем чужие элементы (страховка) ---------- */
function badgeGuard(){
  try{
    var sel=['iframe[src*="netlify"]','[id^="netlify"]','[class*="netlify-badge"]','a[href*="netlify.com" i]'];
    sel.forEach(function(s){
      var nodes=document.querySelectorAll(s);
      for(var i=0;i<nodes.length;i++){ nodes[i].style.setProperty('display','none','important'); }
    });
  }catch(e){}
}
setInterval(badgeGuard,150);
new MutationObserver(badgeGuard).observe(document.documentElement,{childList:true,subtree:true});

document.addEventListener('DOMContentLoaded',function(){ ensureToday(); showTab('habits'); });
