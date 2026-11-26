/* RAYDAR engine: state, eligibility rules and actions, carried over from RAYDAR 2.2.
   The only changes: act() ends with commit() instead of render(), the copy action moved
   into the Dr enquiry component, and functions that returned HTML strings became JSX in views/. */
import {CONDS} from './data.js';
import {ST,ALL,setCohortHook,onStudiesChange} from '../esource/studies.js';
import {onFolderChange} from '../esource/connect.js';
import {plan,earliestScreen,iso as isoD} from '../esource/schedule.js';
import {resetKeys} from './keys.js';
import {checkMed,checkHx} from '../medicines/items.js';

/* ---- store plumbing: React subscribes with useSyncExternalStore ---- */
const listeners=new Set();let version=0;
export const subscribe=f=>{listeners.add(f);return ()=>listeners.delete(f)};
export const getVersion=()=>version;
export function commit(){version++;listeners.forEach(f=>f())}
/* Mutate state from an input and re-render. Typing is not a "frequent" action, so things it reveals may animate. */
export function upd(fn){lastAction='input';fn(S);commit()}

/* ---- frequency gate (UX skill, question 1) ----
   Actions people fire many times a call show their result on the next frame: no entrance animations. */
export const FREQ=new Set(['ans','ansl','ansm','anst','pick','next','prev','goq','goone','navback','sec','secstep','undo','clr','peek','park','crit','avail','set','norest','fs','zoom','psel','pshow','sub','mode','lt','mt','rowadd','rowdel','flag','awdel','theme','key']);
export let lastAction='';
export const quiet=()=>FREQ.has(lastAction);
export function markAction(k){lastAction=k}

const vS=v=>v.a||add(v.d,-v.w),vE=v=>v.b||add(v.d,v.w);
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const TODAY=iso(new Date());
const DD=s=>new Date(s+'T00:00');
const dd=(a,b)=>Math.round((DD(b)-DD(a))/864e5);
const add=(s,n)=>{const d=DD(s);d.setDate(d.getDate()+n);return iso(d)};
const fmt=s=>DD(s).toLocaleDateString('en-AU',{day:'numeric',month:'short'})+(s.slice(0,4)!==TODAY.slice(0,4)?' '+s.slice(2,4):'');
const fmtR=(a,b)=>a===b?fmt(a):fmt(a)+' to '+fmt(b);

const fmtL=s=>DD(s).toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
const pl=(n,w)=>n+' '+w+(n===1?'':'s');
const cn=n=>n.replace(' (sample dates)','');
function tipStay(s,c){const n=dd(c.in,c.out);if(!n)return s.c+' · '+cn(c.n)+'\nDay visit, no overnight stay\nDate::'+fmtL(c.in)+'\nFollow-ups::'+(c.v.length?pl(c.v.length,'visit')+', last '+fmt(c.v[c.v.length-1].d):'None dated')+(S.away.length&&cStat(c)==='open'?'\nAway dates::'+(stayHit(c)?'Clash with Day 1':'No clash'):'');return s.c+' · '+cn(c.n)+'\nIn-clinic stay\nCheck in::'+fmtL(c.in)+'\nCheck out::'+fmtL(c.out)+'\nDuration::'+pl(n+1,'day')+(n?', '+pl(n,'night'):'')+(S.away.length&&cStat(c)==='open'?'\nAway dates::'+(stayHit(c)?'Clash with the stay':'No clash'):'')}
function tipVisit(s,c,v){const a=vS(v),b=vE(v),st=vStat(v);return s.c+' · '+cn(c.n)+'\n'+v.l+'\nPrescribed::'+fmtL(v.d)+'\nEarliest::'+fmtL(a)+'\nLatest::'+fmtL(b)+'\nWindow::'+(v.a?(dd(a,b)+1)+'-day window':'±'+pl(v.w,'day'))+(S.away.length&&cStat(c)==='open'?'\nAway dates::'+(st==='clash'?'Clash, whole window covered':st==='caution'?'Caution, window partly covered':'No clash'):'')}
function tipCohort(s,c){const k=cKey(c);return s.c+' · '+cn(c.n)+'\n'+rk(k)[0]+'\nStay::'+fmtR(c.in,c.out)+'\nFollow-ups::'+(c.v.length?pl(c.v.length,'visit')+', last '+fmt(c.v[c.v.length-1].d):'None dated')+'\nClick to jump::on the calendar'}
function tipAway(a){return 'Participant away\n\nFrom::'+fmtL(a[0])+'\nUntil::'+fmtL(a[1])+'\nLength::'+pl(dd(a[0],a[1])+1,'day')}
const EF=()=>({n:'',ind:'',dose:'',fr:'',route:'',st:'',en:''});
const fresh=c=>({call:c,stage:'id',pid:'',dob:'',match:false,idok:false,err:{},sex:null,wt:'',ht:'',preg:null,cond:{},meds:null,smoke:null,study:null,qid:null,out:{},ans:{},why:{},note:{},read:{},datesOk:{},sub:'dates',tool:null,all:false,fin:null,saved:false,discard:false,snapQ:'',toast:'',fs:13,log:[],lt:'med',f:[EF()],logErr:'',focus:null,ed:null,mt:'med',mf:[EF()],mErr:'',med:null,mq:'',mOpen:false,hf:[EF()],hErr:'',hed:null,hq:'',hOpen:false,rebind:null,keyMsg:'',val:{},pick:{},txt:{},fileMsg:null,scr:'',d1:{},script:null,railAll:false,rq:'',rqHi:0,proAll:false,proS:null,last:null,avail:{},plan:false,pShow:null,hideClosed:true,away:[],awF:'',awT:'',psel:null,alc:'',infoOpen:false,zoom:'near',sx:0,jumpTo:null,dre:{open:false,url:'',concern:'',study:null,txt:null},copied:'',col:{},sz:{},lw:null,rail:true,dark:false,tips:true,focusMode:false,scrollQ:false,ry:0,qs:'',mapOpen:false,peek:null,mode:'one',park:{},nav:[],hist:{},showNote:{},critOpen:false,noteOpen:false,logForm:false,drMode:'hold',cbr:'',finalNotes:'',resumed:null,rev:1,impMsg:null,kept:{},carried:null,prevFile:null,savedName:null});
export let S=fresh(1);
/** 2.7: the call before "Start next call", so a call ended by mistake can be reopened (this tab only) */
let PREV=null;
export const prevCall=()=>PREV;
/** Import callback swaps in a whole new call. */
export function replaceS(n){S=n;lastAction='import';commit()}
/* 2.6: site filter. City (all, Melbourne, Sydney) and, within a city, which sites. Kept in this browser. */
const SITE_KEY='raydar.site.v1';
function loadSite(){try{const v=JSON.parse(localStorage.getItem(SITE_KEY)||'null');if(v&&['all','melbourne','sydney'].includes(v.city))return {city:v.city,off:v.off||{}}}catch(e){}return {city:'all',off:{}}}
export let SITE=loadSite();
function saveSite(){try{localStorage.setItem(SITE_KEY,JSON.stringify(SITE))}catch(e){}}
function siteOk(s){if(SITE.city!=='all'&&s.city!==SITE.city)return false;return !SITE.off[s.site]}
const esc=s=>String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const SC=c=>ST.find(x=>x.c===c);
function age(){if(!S.dob)return null;const d=new Date(S.dob),t=new Date();if(isNaN(d))return null;let a=t.getFullYear()-d.getFullYear();if(t.getMonth()<d.getMonth()||(t.getMonth()===d.getMonth()&&t.getDate()<d.getDate()))a--;return a>=0&&a<120?a:null}
function bmi(){const w=parseFloat(S.wt),h=parseFloat(S.ht);if(!(w>20&&h>100))return null;return Math.round(w/((h/100)**2)*10)/10}
function nm(k){const c=CONDS.find(c=>c[0]===k);return c?c[1].toLowerCase():k}
/** 2.7: the Quick check answer a rule looks at, and what to call it when it hasn't been asked */
function qcVal(item){return item==='smoke'?S.smoke:item==='meds'?S.meds:item==='preg'?S.preg:S.cond[item]}
function qcLabel(item){if(item==='smoke')return 'smoking';if(item==='meds')return 'medications';const c=CONDS.find(z=>z[0]===item);if(!c||(c[2]&&S.sex&&c[2]!==S.sex))return null;return /^[A-Z]{2,}/.test(c[1])?c[1]:c[1].toLowerCase()}
/** 2.7: the conditions Quick check asks about: those at least one loaded study has a rule for, for this sex */
function askConds(){const used=new Set();ST.forEach(s=>(s.qc||[]).forEach(r=>used.add(r.item)));return CONDS.filter(c=>used.has(c[0])&&!(c[2]&&S.sex&&c[2]!==S.sex))}
/** 2.7: which studies a Quick check item matters to, for the hint under it */
function qcUse(item){const L=[];ST.forEach(s=>(s.qc||[]).forEach(r=>{if(r.item===item)L.push({s,r})}));return L}
function cStat(c){if(c.closed)return 'closed';if(dd(TODAY,c.in)<3)return 'soon';return 'open'}
function isAway(d){return S.away.some(a=>a[0]<=d&&d<=a[1])}
function vStat(v){if(!S.away.length)return 'ok';let n=0,t=0;for(let d=vS(v);d<=vE(v);d=add(d,1)){t++;if(isAway(d))n++}return n===0?'ok':n===t?'clash':'caution'}
function stayHit(c){if(!S.away.length)return null;for(let d=c.in;d<=c.out;d=add(d,1))if(isAway(d))return d;return null}
function cRisk(c){if(!S.away.length)return 'ok';if(stayHit(c))return 'clash';let r='ok';for(const v of c.v){const s=vStat(v);if(s==='clash')return 'clash';if(s==='caution')r='caution'}return r}
function conflictDate(c){const h=stayHit(c);if(h)return h;const v=c.v.find(v=>vStat(v)==='clash')||c.v.find(v=>vStat(v)==='caution');return v?v.d:c.in}
function lastDay(c){return c.v.reduce((m,v)=>{const e=vE(v);return e>m?e:m},c.out)}
function openC(s){return (s.cohorts||[]).filter(c=>cStat(c)==='open')}
function nextOpen(s){const o=openC(s).sort((a,b)=>a.in<b.in?-1:1);return o[0]||null}
function ev(s){const a=age(),b=bmi(),miss=[];
if(s.male&&S.sex==='f')return['no','Men only'];
if(S.preg==='y')return['no','Pregnant or breastfeeding'];
if(s.age){if(a==null)miss.push('age');else if(a<s.age[0]||a>s.age[1])return['no','Age must be '+s.age[0]+' to '+s.age[1]]}
if(s.bmi){if(b==null)miss.push('BMI');else if(b<s.bmi[0]||b>s.bmi[1])return['no','BMI must be '+s.bmi[0]+' to '+s.bmi[1]]}
if(s.wMax&&parseFloat(S.wt)>s.wMax)return['no','Max weight '+s.wMax+' kg'];
if(s.female&&S.sex==='m')return['no','Women only'];
/* 2.7: Quick check rules read from the study's eSource questions (src/esource/qcrules.js) */
const chk=[];for(const r of s.qc||[]){const v=qcVal(r.item);if(v==null){const l=qcLabel(r.item);if(l&&!miss.includes(l))miss.push(l);continue}if(v===r.when){if(r.result==='no')return['no',r.why];chk.push(r.why)}}
if(s.bmiMin){if(b==null)miss.push('BMI');else if(b<s.bmiMin)return['no','BMI must be '+s.bmiMin+' or above']}
if(s.cohorts&&!openC(s).length)return['no','No open cohorts'];
if(s.cohorts&&S.away.length&&openC(s).every(c=>cRisk(c)==='clash'))return['no','Every open cohort clashes'];
if(s.hv){if(CONDS.some(c=>S.cond[c[0]]==='y'))return['no','Healthy volunteers only'];
if(S.meds==='y')return s.strict?['no',s.medMsg||'No medication 14 days before dosing']:['check','Medication needs doctor review'];
if(S.smoke==='y')return['check','Check nicotine limit'];
if(CONDS.some(c=>S.cond[c[0]]==null&&!(c[0]==='mphl'&&S.sex==='f')))miss.push('conditions');
if(S.meds==null)miss.push('medications')}
else if(s.need){const v=S.cond[s.need];if(v==='n')return['no','Recruits '+nm(s.need)+' only'];if(v==null)miss.push(nm(s.need))}
if(s.cohorts&&S.away.length&&openC(s).every(c=>cRisk(c)!=='ok'))return['check','Away dates touch every cohort'];
if(chk.length)return['check',chk[0]];
return miss.length?['check','Ask about '+miss.slice(0,2).join(' and ')]:['yes','Nothing flagged so far']}
function ranked(all){const o={yes:0,check:1,no:2};return ST.filter(s=>all||siteOk(s)).map(s=>({s,r:ev(s)})).sort((a,b)=>o[a.r[0]]-o[b.r[0]])}
const COL={yes:'var(--fill-success)',check:'var(--fill-warning)',no:'var(--border-stronger)'};
const TXT={yes:'var(--text-success)',check:'var(--text-warning)',no:'var(--text-secondary)'};
function proS(){return S.proS||(S.study&&S.study.c)||ranked()[0].s.c}
function proFor(c){const s=SC(c);return (s&&s.pro)||{}}
const isMedT=t=>t==='med'||t==='otc';
const inCarry=(e,c)=>c==='hx'?e.t==='hx':isMedT(e.t);
function eText(e){return [e.n,e.ind,e.dose,e.fr,e.route].filter(Boolean).join(' ')}
function matchP(e,c){const s=SC(c||proS());if(!s)return null;return e.t==='hx'?checkHx(e,s):checkMed(e,s)}
function eParts(e){const p=[];if(e.t==='hx'){if(e.st)p.push('dx '+e.st);if(e.en)p.push('resolved '+e.en);return p}if(e.ind)p.push('for '+e.ind);if(e.dose)p.push(e.dose);if(e.fr)p.push(e.fr);if(e.route)p.push(e.route);if(e.st)p.push('started '+e.st);if(e.en)p.push('stopped '+e.en);return p}
function syncAuto(){CONDS.forEach(c=>{const has=S.log.some(e=>e.auto===c[0]);if(S.cond[c[0]]==='y'&&!has)S.log.push(Object.assign(EF(),{t:'hx',n:c[1],src:'Quick check',auto:c[0],f:false}));if(S.cond[c[0]]!=='y'&&has)S.log=S.log.filter(e=>!(e.auto===c[0]&&!eParts(e).length))});
const hm=S.log.some(e=>e.auto==='meds');if(S.meds==='y'&&!hm)S.log.push(Object.assign(EF(),{t:'med',n:'Regular medication',src:'Quick check',auto:'meds',f:false}));if(S.meds!=='y'&&hm)S.log=S.log.filter(e=>!(e.auto==='meds'&&!eParts(e).length))}
function avl(code){return S.avail[code]||(S.avail[code]={})}
function selC(s){s=s||S.study;if(!s||!s.cohorts)return [];const a=avl(s.c);return s.cohorts.filter(c=>a[c.id])}
function selTypes(s){return [...new Set(selC(s).map(c=>c.t))]}
/* 2.5: a question shows when its eSource condition (visibleIf) is true. A hidden question's answer doesn't count. */
function valueOf(name,vis,over){const s=S.study;if(!s)return undefined;const parts=String(name).split('.'),base=parts[0].trim(),sub=parts[1]&&parts[1].trim().toLowerCase(),q=s.byName[base];if(!q)return undefined;
if(q.auto==='age'){const a=age();return a}
if(q.auto==='bmi'){const b=bmi();if(!sub||sub==='bmiscore'||sub==='bmi')return b;if(sub==='weight')return parseFloat(S.wt);if(sub==='height')return parseFloat(S.ht);return undefined}
if(over&&over.id===base)return over.v;
if(vis&&!vis.has(base))return undefined;return S.val[base]}
function qset(){const s=S.study;if(!s)return [];const L=srcQ(s),T=selTypes(),vis=new Set(),out=[];const get=n=>valueOf(n,vis);L.forEach(q=>{if(q.sex&&q.sex!==S.sex)return;if(q.only&&!q.only.some(t=>T.includes(t)))return;if(q.vis&&!q.vis.test(get))return;vis.add(q.id);out.push(q)});return out}
/** Is this eSource note (a block with its own condition) showing right now? */
function noteShows(b){if(!b.vis)return true;const vis=new Set(qset().map(q=>q.id));return b.vis.test(n=>valueOf(n,vis))}
/** Would answering q with answer b open a question that is hidden now? */
function opensWith(q,b){const s=S.study;if(!s)return false;const vis=new Set(qset().map(z=>z.id));vis.add(q.id);return s.Q.some(z=>z.vis&&z.deps&&z.deps.includes(q.id)&&!vis.has(z.id)&&z.vis.test(n=>valueOf(n,vis,{id:q.id,v:b[2]})))}
function srcQ(s){s=s||S.study;return !s?[]:s.Q||[]}
const RAYDAR_VERSION='RAYDAR 2.10 · questions, scripts and notes from the TST eSource files';
const oc=o=>o==='c'?'success':o==='d'?'warning':o==='x'?'danger':'accent';
function curQ(){const L=qset();let i=L.findIndex(q=>q.id===S.qid);if(i<0){i=L.findIndex(q=>!S.out[q.id]);if(i<0)i=0;S.qid=L[i]&&L[i].id}return {L,i,q:L[i]}}
function qMatches(q){if(!q.carry)return [];return S.log.filter(e=>inCarry(e,q.carry)).map(e=>({e,p:matchP(e)})).filter(z=>z.p&&z.p.o!=='ok')}
function sugQ(q){if(q.kind==='log'){const m=qMatches(q),has=S.log.some(e=>inCarry(e,q.carry));return !has?'None':m.length||S.log.some(e=>inCarry(e,q.carry)&&e.f)?'Logged, raise with doctors':'Logged'}
if(q.carry){const m=qMatches(q);if(m.some(z=>z.p.o==='x'))return 'x';if(m.length)return 'd';return S.log.some(e=>inCarry(e,q.carry))?null:'c'}
if(q.auto==='sex'){if(!S.sex)return null;const b=q.a.find(b=>(S.sex==='m'?/^male\b/i:/^female\b/i).test(b[0].trim()));return b?b[0]:null}
if(q.auto==='age'){const a=age(),r=q.range||(S.study&&S.study.age);if(a==null)return null;if(!r)return 'c';return a>=r[0]&&a<=r[1]?'c':'x'}
if(q.auto==='bmi'){const b=bmi(),r=q.range||(S.study&&S.study.bmi);if(b==null)return null;if(!r)return 'c';return b>=r[0]&&b<=r[1]?'c':'x'}
if(q.hol){if(!S.away.length)return null;const r=selC().map(cRisk);return r.includes('clash')?'x':r.includes('caution')?'d':'c'}
if(q.dates)return selC().length?null:'x';
if(q.alc){const n=parseFloat(S.alc);if(isNaN(n))return null;return n<=(S.sex==='m'?21:14)?'c':'x'}
return null}

function srcLabel(){if(S.stage==='id')return 'Identity';if(S.stage==='qc')return 'Quick check';if(S.stage==='ps'&&S.study){const q=curQ();return (S.qon?'Q'+(q.i+1)+' · ':'')+S.study.c}return 'Finish'}
function rk(r){return {ok:['Available','ok','var(--fill-success)'],caution:['Caution','warn','var(--fill-warning)'],clash:['Clash','bad','var(--fill-danger)'],closed:['Closed','','var(--surface-1)'],soon:['Too soon','','var(--surface-1)']}[r]}
function cKey(c){const st=cStat(c);return st!=='open'?st:cRisk(c)}
function planStudies(){return ST.filter(s=>siteOk(s)&&s.cohorts)}
function pShown(s){if(S.pShow&&s.c in S.pShow)return S.pShow[s.c];if(S.pShow)return false;if(S.study&&S.study.c===s.c)return true;return ev(s)[0]!=='no'||!S.idok}
function tlB(){const start=add(TODAY,-7);let end=add(TODAY,365);planStudies().forEach(s=>s.cohorts.forEach(c=>{const l=lastDay(c);if(l>end)end=l}));end=add(end,30);return {start,end,days:dd(start,end)+1}}
const ZP=()=>S.zoom==='far'?3:16;
const FLD={med:[['n','Medication name','Valacyclovir'],['ind','Indication (what for)','Cold sores'],['dose','Dosage','500 mg'],['fr','Frequency','As needed'],['route','Route','Oral'],['st','Start date','2024'],['en','End date, if stopped','Mar 2026']],otc:[['n','Supplement or OTC name','Iron'],['ind','Indication (what for)','Low iron'],['dose','Dosage','1 tablet'],['fr','Frequency','Once daily'],['route','Route','Oral'],['st','Start date','Jan 2026'],['en','End date, if stopped','']],hx:[['n','Condition or event','Low iron'],['st','Start date or diagnosed','2024'],['en','End date, if resolved','']]};
const TL={med:'Medication',otc:'Supplement or OTC',hx:'Condition or event'};
const EMRE=/(raise an enquiry|raise with the doctors|raise a doctor enquiry|doctor check)|(excludes|excluded|exclude|must be negative|not allowed)|(\bOK\b|is fine|are fine|allowed)|((?<![A-Za-z0-9-])\d+(?:\.\d+)?(?:\s?(?:to|or|-)\s?\d+(?:\.\d+)?)?(?:\s?(?:days?|weeks?|months?|hours?|hrs|kg|mg|nights?|years?|minutes|half-lives|a week|a day))?)/gi;
const ocls=o=>o==='c'?'ok':o==='d'?'warn':o==='x'?'bad':'nt';
function needsReview(q){const o=S.out[q.id];if(!o)return false;const sg=sugQ(q),r={c:0,n:0,d:1,x:2};if(!(sg in r))return false;return r[sg]>r[o]}
function frontier(L){return L.find(z=>!S.out[z.id]&&!S.park[z.id])||L.find(z=>!S.out[z.id])}
function goQ(id){const c=curQ();if(c.q&&c.q.id!==id){S.nav.push(c.q.id);if(S.nav.length>30)S.nav.shift()}S.qid=id;S.peek=null;S.qon=true;S.stage='ps'}
function short(t,n){n=n||70;return t.length>n?t.slice(0,n-1)+'…':t}
function sug(){if(!S.study)return 'cb';const L=qset(),v=L.map(q=>S.out[q.id]);if(v.includes('x'))return 'x';if(v.some(z=>z==null))return 'cb';if(v.includes('d')||S.log.some(e=>e.f))return 'd';return 'c'}
function reason(){const L=qset();for(const q of L){if(S.out[q.id]==='x')return (S.why[q.id]&&S.why[q.id][0])||q.s}return ''}
function camel(t){return t.replace(/[^A-Za-z0-9 ]/g,' ').split(' ').filter(Boolean).slice(0,3).map(w=>w[0].toUpperCase()+w.slice(1)).join('')}
function fname(k){const code=S.study?S.study.c:'QuickCheck',L=qset(),done=L.filter(q=>S.out[q.id]).length,hasD=L.some(q=>S.out[q.id]==='d');const suf=k==='c'?'Booked':k==='d'?'Booked_DrEnquiry':k==='x'?'Fail_'+camel(reason()||'Not specified'):'Callback_'+(hasD?'DoctorEnquiryPending':S.study?'Q'+(done+1)+'of'+L.length:'QuickCheck');return (S.pid||'P?????')+'-'+code+'-'+suf+'.pdf'}
function drCode(){return S.dre.study||(S.study&&S.study.c)||proS()}
function drText(){const a=age(),sx=S.sex?(S.sex==='f'?'F':'M'):'';const li=e=>'- '+e.n+(eParts(e).length?' - '+eParts(e).join(', '):'');const sec=(h,t)=>{const L=S.log.filter(e=>e.t===t);return [h+':',...(L.length?L.map(li):['- Nil'])]};const con=(S.dre.concern||'').split('\n').filter(x=>x.trim());
return ['Study: '+drCode(),'Age and Sex: '+(a!=null?a:'')+sx,'Participant link: '+(S.dre.url||''),'',...sec('Medications','med'),'',...sec('Supplements/OTC','otc'),'',...sec('Medical Conditions/Events','hx'),'','Concern:',...(con.length?con.map(x=>'- '+x.replace(/^[-*]\s*/,'')):['- '])].join('\n')}

/* 2.7: answers are kept per study for the whole call. Switching study (or site) and back restores them, and the same
   study at another site starts with every answer whose question reads the same in both eSource files. */
const KEEP=['out','ans','val','pick','txt','why','note','park','hist'];
function stash(){if(!S.study)return;if(!Object.keys(S.out).length&&!Object.keys(S.note).length){delete S.kept[S.study.c];return}S.kept[S.study.c]=Object.assign(Object.fromEntries(KEEP.map(k=>[k,S[k]])),{qon:S.qon,qid:S.qid,sub:S.sub})}
const sameQ=(a,b)=>a&&b&&a.t===b.t&&a.kind===b.kind&&JSON.stringify((a.a||[]).map(x=>[x[0],x[2]]))===JSON.stringify((b.a||[]).map(x=>[x[0],x[2]]));
function carryFrom(s){for(const [code,k] of Object.entries(S.kept)){const src=SC(code);if(!src||src===s||src.code!==s.code)continue;let n=0;s.Q.forEach(q=>{if(!k.out[q.id]||!sameQ(q,src.Q.find(z=>z.id===q.id)))return;S.out[q.id]=k.out[q.id];S.ans[q.id]=k.ans[q.id];S.val[q.id]=k.val[q.id];if(k.pick[q.id])S.pick[q.id]=k.pick[q.id].slice();if(k.txt[q.id]!=null)S.txt[q.id]=k.txt[q.id];if(k.why[q.id])S.why[q.id]=k.why[q.id].slice();if(k.note[q.id])S.note[q.id]=k.note[q.id];n++});if(n)return {from:code,n,of:Object.keys(k.out).length};}return null}
function start(c){if(!S.idok){S.stage='id';S.err={id:'Confirm identity before starting a pre-screen'};return}stash();S.study=SC(c);S.proS=null;S.stage='ps';S.qon=false;S.sub='dates';S.qid=null;S.out={};S.ans={};S.val={};S.pick={};S.txt={};S.why={};S.note={};S.park={};S.hist={};S.tool=null;S.err={};S.fin=null;S.all=false;S.last=null;S.mOpen=false;S.mq='';S.infoOpen=false;S.carried=null;
const k=S.kept[c];if(k){KEEP.forEach(f=>{S[f]=k[f]});S.qon=k.qon;S.qid=k.qid;S.sub=k.sub;S.carried={back:true,n:Object.keys(k.out).length};return}
const cf=carryFrom(S.study);if(cf)S.carried=cf}
function advance(){const {L,i}=curQ();S.mOpen=false;S.mq='';S.mErr='';S.hOpen=false;S.hq='';S.hErr='';S.peek=null;let j=i+1;while(j<L.length&&(S.out[L[j].id]||S.park[L[j].id]))j++;if(j<L.length)S.qid=L[j].id;else{const u=frontier(L);if(u)S.qid=u.id}}
function doJump(code,cid){const s=SC(code),c=s&&s.cohorts.find(z=>z.id===cid);if(!c)return;S.plan=true;S.tool=null;if(!pShown(s)){if(!S.pShow){const m={};planStudies().forEach(z=>m[z.c]=pShown(z));S.pShow=m}S.pShow[code]=true}if(S.hideClosed&&cStat(c)!=='open')S.hideClosed=false;S.psel=[code,cid];S.jumpSmooth=true;S.jumpTo=cKey(c)==='ok'||cStat(c)!=='open'?c.in:conflictDate(c)}
function pushLog(F,t,ed){const e=Object.assign(EF(),{t},Object.fromEntries(Object.entries(F).map(([k,v])=>[k,String(v).trim()])),{t,src:(ed&&ed.src)||srcLabel(),auto:(ed&&ed.auto)||null,f:!!(ed&&ed.f)});S.log.push(e)}
function addRows(pre,t,ed){const rows=pre==='r'?S.f:pre==='h'?S.hf:S.mf;const has=r=>Object.values(r).some(v=>String(v).trim());const filled=rows.filter(has);if(!filled.length)return t==='hx'?'Enter at least one condition or event':'Enter at least one name';const bad=rows.findIndex(r=>has(r)&&!r.n.trim());if(bad>=0)return 'Row '+(bad+1)+' needs a '+(t==='hx'?'condition':'name');filled.forEach((r,k)=>pushLog(r,t,k===0?ed:null));return ''}


/* ---- RAYDAR 2.4: answer key order ----
   Key 1 always goes to the answer most likely to be right: the suggested one when RAYDAR has a suggestion,
   otherwise the answer that simply moves on (eligible, and doesn't open a follow-up). The rest keep their
   on-screen order on keys 2, 3 and 4. */
function opensFollowUp(q,label){const b=q.a.find(x=>x[0]===label);return !!b&&opensWith(q,b)}
function followUpLabels(q){return q.a.filter(b=>opensWith(q,b)).map(b=>b[0])}
function sugIdx(q){const sg=sugQ(q);if(!sg)return -1;const byLabel=q.a.findIndex(b=>b[0]===sg);if(byLabel>=0)return byLabel;return q.a.findIndex(b=>b[1]===sg)}
function primaryIdx(q){const s=sugIdx(q);if(s>=0)return {i:s,why:'suggested'};const m=q.a.findIndex(b=>b[1]==='c'&&!opensFollowUp(q,b[0]));return m>=0?{i:m,why:'moves on'}:{i:0,why:''}}
/** answer indexes in key order: ansOrder(q)[0] is on key 1 */
function ansOrder(q){const p=primaryIdx(q).i;return [p,...q.a.map((_,j)=>j).filter(j=>j!==p)]}
/** which key slot (0-based) an answer sits on */
function ansSlot(q,j){return ansOrder(q).indexOf(j)}

/* ---- RAYDAR 2.4: stage completion and the next step ---- */
function idReady(){return /^P\d{3,}/i.test(S.pid)&&age()!=null&&S.match}
function qcLeft(){const L=[];if(!S.sex)L.push('sex');if(bmi()==null)L.push('weight and height');if(S.sex!=='m'&&!S.preg)L.push('pregnancy');if(askConds().some(c=>S.cond[c[0]]==null))L.push('conditions');if(!S.meds)L.push('medications');if(!S.smoke)L.push('smoking');return L}
function qcDone(){return !qcLeft().length}
function preqDone(){const s=S.study;return !!s&&(!s.cohorts||!!S.datesOk[s.c])&&!!S.read[s.c]}
function psDone(){const L=qset();return !!L.length&&L.every(q=>S.out[q.id])}
/** The step a recruiter would take next, once the current one is complete. null while there's still work here. */
function nextStep(){
if(S.stage==='id')return idReady()?{a:'confirm',done:'Identity details entered',to:'Quick check',btn:'Confirm and continue'}:null;
if(S.stage==='qc'){if(!qcDone())return null;return {a:'go:ps',done:'Quick check complete',to:'Pre-screen',sub:S.study?S.study.c:'choose a study',btn:S.study?'Continue to pre-screen':'Choose a study'}}
if(S.stage==='ps'&&S.study&&!S.qon)return preqDone()?{a:'startq',done:'Dates and study information done',to:'Questions',sub:S.study.c,btn:'Start questions'}:null;
if(S.stage==='ps'&&S.study&&S.qon){if(!psDone())return null;const L=qset(),x=L.filter(q=>S.out[q.id]==='x').length,d=L.filter(q=>S.out[q.id]==='d').length;return {a:'go:finish',done:'All '+L.length+' questions answered',to:'Finish',sub:x?x+' exclusion'+(x>1?'s':''):d?d+' for the doctor':'Nothing flagged',tone:x?'bad':d?'warn':'ok',btn:'Continue to finish'}}
if(S.stage==='finish'&&S.saved)return {a:'new',done:'Saved',to:'Next call',btn:'Start next call'};
return null}

/* 2.5: a multi-select answer is its ticked options (worst outcome wins); a typed answer is the text. */
const RANK={x:4,d:3,c:2,n:1,i:0};
function multiB(q){const p=(S.pick[q.id]||[]).filter(j=>q.a[j]);if(!p.length)return ['None of these','i',[]];const o=p.map(j=>q.a[j][1]).reduce((m,z)=>RANK[z]>RANK[m]?z:m,'i');return [p.map(j=>q.a[j][0]).join('; '),o,p.map(j=>q.a[j][2])]}
function textB(q){const t=String(S.txt[q.id]||'').trim();if(!t){S.err={t:'Type their answer first'};S.shake='t';return null}return [t,'i',t]}
/* 2.6: a rolling study's one cohort: Day 1 and its visits, from the screening date and away dates */
const emCache=new Map();
function emPlan(s){if(!s||!s.sched)return null;const scr=S.scr||earliestScreen(s.site),k=[s.sched,s.site,scr,JSON.stringify(S.away),S.d1[s.c]||''].join('|');if(!emCache.has(k)){if(emCache.size>200)emCache.clear();emCache.set(k,plan(s.sched,scr,s.site,S.away,S.d1[s.c]))}return emCache.get(k)}
function emCohorts(s){const P=emPlan(s);if(!P)return null;const d1=isoD(P.D1);return [{id:'tl',n:'Day 1 '+fmt(d1)+' (screening '+fmt(isoD(P.S))+')',t:'tl',in:d1,out:d1,closed:false,rolling:true,v:P.rows.filter(r=>!r.screen&&r.status!=='phone'&&r.v.day!==1).map(r=>({d:isoD(r.from),a:isoD(r.from),b:isoD(r.to),w:0,l:r.v.name}))}]}
setCohortHook(emCohorts);
/* 2.8: when the studies change (the studies folder was read, a draft is previewed, the admin published), keep the
   call on the newest copy of its study and re-render */
onStudiesChange(()=>{emCache.clear();if(S.study){const n=ALL.find(x=>x.file===S.study.file);if(n)S.study=n}if(S.dre&&S.dre.study&&!ST.find(x=>x.c===S.dre.study))S.dre.study=null;commit()});
onFolderChange(()=>commit());
function act(a){const p=a.split(':'),k=p[0],x=p[1],y=p.slice(2).join(':');S.toast='';lastAction=k;
if(k!=='discard')S.discard=false;
if(k==='go'){if(x!=='id'&&!S.idok){S.stage='id';S.err={id:x==='finish'?'Confirm identity first. The PID goes in the file name':'Confirm identity first'}}else{S.stage=x;S.err={}}}
else if(k==='confirm'){const e={};if(!/^P\d{3,}/i.test(S.pid))e.pid='Enter a PID like p123456_1101';if(age()==null)e.dob='Enter a valid date of birth';if(!S.match)e.match='Check name, phone and email against the profile';S.err=e;S.shake=Object.keys(e)[0]||null;if(!Object.keys(e).length){S.idok=true;S.stage='qc'}}
else if(k==='set'){if(x.indexOf('cond.')===0){const c=x.slice(5);S.cond[c]=S.cond[c]===y?null:y}else S[x]=S[x]===y?null:y;syncAuto()}
else if(k==='norest'){askConds().forEach(c=>{if(S.cond[c[0]]==null)S.cond[c[0]]='n'});syncAuto()}
else if(k==='start'){start(x);S.nav=[];S.peek=null}
else if(k==='pstart'){start(x);S.nav=[];S.peek=null;if(S.study){avl(x)[y]=true;S.plan=false}}
else if(k==='sub')S.sub=x;
else if(k==='read'){S.read[S.study.c]=true;S.err={};if(S.study.cohorts&&!S.datesOk[S.study.c])S.sub='dates'}
else if(k==='dok'){if(S.study&&S.study.sched){avl(S.study.c).tl=true}if(!selC().length){S.err={d:'Select at least one cohort first'};S.shake='d'}else{S.datesOk[S.study.c]=true;S.err={};if(!S.read[S.study.c])S.sub='info'}}
else if(k==='startq'){const s=S.study,dOk=!s.cohorts||S.datesOk[s.c];if(!dOk||!S.read[s.c])S.err={s:(!dOk?'Confirm the dates':'')+(!dOk&&!S.read[s.c]?' and ':'')+(!S.read[s.c]?(dOk?'Read':'read')+' the study information':'')+' first'},S.shake='s';else{S.qon=true;S.err={};S.qid=null}}
else if(k==='avail'){const o=avl(x);o[y]=!o[y];if(S.study&&S.study.c===x&&!selC().length)S.datesOk[x]=false}
else if(k==='info')S.infoOpen=!S.infoOpen;
else if(k==='sec'){const sn=decodeURIComponent(x),L=qset().filter(q=>q.sec===sn);const u=L.find(q=>!S.out[q.id])||L[0];if(u)goQ(u.id);S.last=null}
else if(k==='secstep'){const L=qset(),secs=[...new Set(L.map(z=>z.sec))],cq=curQ().q,si=secs.indexOf(cq.sec)+(+x);if(si>=0&&si<secs.length){const Z=L.filter(z=>z.sec===secs[si]);goQ((Z.find(z=>!S.out[z.id])||Z[0]).id)}}
else if(k==='pick'){const q0=srcQ().find(z=>z.id===x),p=S.pick[x]=S.pick[x]||(q0&&Array.isArray(S.val[x])?S.val[x].map(v=>q0.a.findIndex(b=>b[2]===v)).filter(i=>i>=0):[]),j=+y,i=p.indexOf(j);if(i>=0)p.splice(i,1);else p.push(j);p.sort((a,b)=>a-b);S.err={}}
else if(k==='ans'||k==='ansl'||k==='ansm'||k==='anst'){const L=qset();let q,b,lst=k==='ansl';if(k==='ans'){q=curQ().q;b=q&&q.a[+x]}else{q=L.find(z=>z.id===x);if(k==='ansl')b=q&&q.a[+y];else{lst=S.mode==='list';b=q&&(k==='ansm'?multiB(q):textB(q))}}
if(q&&b){const i=L.indexOf(q),w=S.why[q.id]||[],was=S.out[q.id],pa=S.ans[q.id],pv=S.val[q.id];
if(b[1]!=='c'&&!w.length){const mm=qMatches(q);if(mm.length)S.why[q.id]=[mm[0].p.n]}
if(was&&S.ans[q.id]!==b[0])S.hist[q.id]=S.ans[q.id];S.out[q.id]=b[1];S.ans[q.id]=b[0];S.val[q.id]=b[2];delete S.park[q.id];S.err={};
if(lst){const L2=qset(),i2=L2.indexOf(q),Z=L2.filter(z=>z.sec===q.sec),nx=Z.slice(Z.indexOf(q)+1).find(z=>!S.out[z.id]&&!S.park[z.id])||Z.find(z=>!S.out[z.id]&&!S.park[z.id]);let moved='';if(nx)S.qid=nx.id;else{const fr=frontier(L2);if(fr){S.qid=fr.id;if(fr.sec!==q.sec)moved='Section done, now on '+fr.sec}else S.qid=q.id}S.scrollQ=true;S.last={qid:q.id,label:'Q'+(i2+1)+' recorded as '+short(b[0],60),next:S.qid,o:b[1],po:was,pa:pa,pv:pv,moved}}
else{const lbl='Q'+(i+1)+' recorded as '+short(b[0],60)+(was&&S.hist[q.id]?' (was '+short(S.hist[q.id],40)+')':'');if(was){const fr=frontier(L);S.nav=[];if(fr){S.qid=fr.id;S.peek=null}}else advance();S.last={qid:q.id,label:lbl,next:S.stage==='ps'?S.qid:null,o:b[1],po:was,pa:pa,pv:pv}}}}
else if(k==='undo'){if(S.last){S.stage='ps';S.qid=S.last.qid;if(S.last.po){S.out[S.qid]=S.last.po;S.ans[S.qid]=S.last.pa;S.val[S.qid]=S.last.pv}else{delete S.out[S.qid];delete S.ans[S.qid];delete S.val[S.qid]}S.last=null;S.scrollQ=true}}
else if(k==='clr'){const rm=id=>{delete S.out[id];delete S.ans[id];delete S.val[id];delete S.why[id];delete S.pick[id];srcQ().filter(z=>z.deps&&z.deps.includes(id)&&S.out[z.id]).forEach(z=>rm(z.id))};rm(x);delete S.park[x];S.qid=x;S.last=null;S.scrollQ=true;S.toast=''}
else if(k==='city'){SITE={city:x,off:{}};saveSite()}
else if(k==='sitet'){const key=decodeURIComponent(x);SITE={...SITE,off:{...SITE.off,[key]:!SITE.off[key]}};saveSite()}
else if(k==='railall'){S.railAll=!S.railAll}
else if(k==='scr'){S.scr=x||'';S.d1={}}
else if(k==='d1'){S.d1[S.study.c]=x}
else if(k==='script'){S.script=x==='close'||S.script===x?null:x}
else if(k==='notmatch'){const e=S.log[+x];if(e){e.nm=(e.nm||[]).concat(decodeURIComponent(y))}}
else if(k==='rebind'){S.rebind=S.rebind===x?null:x||null;S.keyMsg=''}
else if(k==='keyreset'){resetKeys();S.rebind=null;S.keyMsg='Shortcuts reset to the defaults'}
else if(k==='tips'){S.tips=!S.tips;if(S.tool==='guide'&&!S.tips)S.tool=null}
else if(k==='focus'){S.focusMode=!S.focusMode;if(S.focusMode)S.tool=null}
else if(k==='park'){const {q}=curQ();S.park[q.id]=true;S.last=null;advance()}
else if(k==='next'){const {L,i}=curQ();if(i<L.length-1)goQ(L[i+1].id);S.last=null}
else if(k==='prev'){const {L,i}=curQ();if(i>0)goQ(L[i-1].id);S.last=null}
else if(k==='goq'){goQ(x);S.last=null;if(S.mode==='list'){}}
else if(k==='goone'){S.mode='one';goQ(x);S.last=null}
else if(k==='navback'){const id=S.nav.pop();if(id){S.qid=id;S.peek=null}S.last=null}
else if(k==='peek'){S.peek=x||null}
else if(k==='map'){S.mapOpen=!S.mapOpen;if(!S.mapOpen)S.qs=''}
else if(k==='mode'){S.mode=x;S.peek=null;S.scrollQ=x==='list'}
else if(k==='shownote'){S.showNote[x]=!S.showNote[x]}
else if(k==='critopen'){S.critOpen=!(S.critOpen||(S.why[curQ().q.id]||[]).length);if(!S.critOpen){}}
else if(k==='noteopen'){S.noteOpen=!(S.noteOpen||S.note[curQ().q.id])}
else if(k==='crit'){const {q}=curQ(),c=q.crit[+x],w=S.why[q.id]=S.why[q.id]||[],i=w.indexOf(c);if(i>=0)w.splice(i,1);else w.push(c);S.critOpen=true}
else if(k==='plan'){S.plan=!S.plan;S.tool=null}
else if(k==='pshow'){const s=SC(x),cur=pShown(s);if(!S.pShow){const m={};planStudies().forEach(z=>m[z.c]=pShown(z));S.pShow=m}S.pShow[x]=!cur;if(!S.pShow[x]&&S.psel&&S.psel[0]===x)S.psel=null}
else if(k==='pclear'){S.pShow={};planStudies().forEach(z=>S.pShow[z.c]=false);S.psel=null}
else if(k==='pdefault'){S.pShow=null}
else if(k==='psel')S.psel=S.psel&&S.psel[0]===x&&S.psel[1]===y?null:[x,y];
else if(k==='zoom'){const oz=ZP(),B=tlB();const left=add(B.start,Math.round((S.sx||0)/oz)+Math.round(80/oz));S.zoom=x;S.jumpTo=left}
else if(k==='resetview'){S.sx=0;S.jumpTo=null}
else if(k==='jump')doJump(x,y);
else if(k==='jumpd'){S.plan=true;S.tool=null;S.col.plan=false;S.jumpSmooth=true;S.jumpTo=x}
else if(k==='awadd'){if(S.awF){S.away.push([S.awF,S.awT&&S.awT>=S.awF?S.awT:S.awF]);S.away.sort((a,b)=>a[0]<b[0]?-1:1);S.awF='';S.awT=''}}
else if(k==='awdel')S.away.splice(+x,1);
else if(k==='tool'){S.tool=S.tool===x?null:x}
else if(k==='close')S.tool=null;
else if(k==='rail'){if(S.focusMode){S.focusMode=false;S.rail=true}else S.rail=!S.rail}
else if(k==='theme'){S.dark=!S.dark}
else if(k==='col'){S.col[x]=!S.col[x]}
else if(k==='colall'){['plan','dre','stud','log','pro','mlog','upnext'].forEach(z=>S.col[z]=true);S.tool=null}
else if(k==='layoutreset'){S.sz={};S.col={};S.lw=null;S.rail=true;S.tool=null}
else if(k==='fin')S.fin=x;
else if(k==='save')S.saved=true;
else if(k==='discard'){if(S.discard){PREV=S;PREV.discard=false;const keep={fs:S.fs,sz:S.sz,col:S.col,lw:S.lw,rail:S.rail,dark:S.dark,tips:S.tips,focusMode:S.focusMode};S=Object.assign(fresh(S.call+1),keep)}else S.discard=true}
else if(k==='unsave'){S.saved=false;S.prevFile=S.savedName;S.savedName=null;S.rev=(S.rev||1)+1}
else if(k==='lastcall'){if(PREV){const keep={fs:S.fs,sz:S.sz,col:S.col,lw:S.lw,rail:S.rail,dark:S.dark,tips:S.tips,focusMode:S.focusMode};S=Object.assign(PREV,keep);PREV=null}}
else if(k==='new'){PREV=S;const keep={fs:S.fs,sz:S.sz,col:S.col,lw:S.lw,rail:S.rail,dark:S.dark,tips:S.tips,focusMode:S.focusMode};S=Object.assign(fresh(S.call+1),keep)}
else if(k==='all')S.all=!S.all;
else if(k==='proall')S.proAll=!S.proAll;
else if(k==='fs')S.fs=Math.max(11,Math.min(17,S.fs+(+x)));
else if(k==='drmode')S.drMode=x==='book'?'book':'hold';
else if(k==='cbr')S.cbr=decodeURIComponent(x||'');
else if(k==='impclose')S.impMsg=null;
else if(k==='carriedx')S.carried=null;
else if(k==='admin'){S.admin=x==='open';S.tool=null}
else if(k==='lt'){S.lt=x;S.logErr=''}
else if(k==='mt'){S.mt=x;S.mErr=''}
else if(k==='logform'){S.logForm=!(S.logForm||S.ed);if(!S.logForm&&S.ed){pushLog(S.f[0],S.lt,S.ed);S.ed=null;S.f=[EF()]}S.logErr='';if(S.logForm)S.focus='rName0'}
else if(k==='rowadd'){const rows=x==='r'?S.f:x==='h'?S.hf:S.mf;rows.push(EF());S.focus=x+'Name'+(rows.length-1);if(x==='r')S.logForm=true}
else if(k==='rowdel'){const rows=x==='r'?S.f:x==='h'?S.hf:S.mf;rows.splice(+y,1);if(!rows.length)rows.push(EF())}
else if(k==='logadd'){const er=addRows('r',S.lt,S.ed);if(er){S.logErr=er;S.shake='logErr'}else{S.f=[EF()];S.logErr='';S.ed=null;S.logForm=false}}
else if(k==='redit'){const e=S.log[+x];S.lt=e.t;S.f=[{n:e.n==='Regular medication'?'':e.n,ind:e.ind,dose:e.dose,fr:e.fr||'',route:e.route,st:e.st,en:e.en}];S.ed={src:e.src,auto:e.auto,f:e.f};S.log.splice(+x,1);S.logForm=true;S.col.log=false;S.focus='rName0'}
else if(k==='madd'){const c=x||curQ().q.carry;if(c==='hx'){const er=addRows('h','hx',S.hed);if(er){S.hErr=er;S.shake='hErr'}else{S.hf=[EF()];S.hErr='';S.hed=null;S.focus='hName0'}}else{const er=addRows('m',S.mt,S.med);if(er){S.mErr=er;S.shake='mErr'}else{S.mf=[EF()];S.mErr='';S.med=null;S.focus='mName0'}}}
else if(k==='medit'){const e=S.log[+x],F=[{n:e.n==='Regular medication'?'':e.n,ind:e.ind,dose:e.dose,fr:e.fr||'',route:e.route,st:e.st,en:e.en}],M={src:e.src,auto:e.auto,f:e.f};S.log.splice(+x,1);if(e.t==='hx'){S.hf=F;S.hed=M;S.col.hlog=false;S.focus='hName0'}else{S.mt=e.t;S.mf=F;S.med=M;S.col.mlog=false;S.focus='mName0'}}
else if(k==='mpro'){if(x==='hx')S.hOpen=!S.hOpen;else S.mOpen=!S.mOpen}
else if(k==='flag'){S.log[+x].f=!S.log[+x].f}
else if(k==='del'){S.log.splice(+x,1)}
else if(k==='dre'){if(x==='open'){S.dre.open=true;S.col.dre=false;S.copied='';S.tool=null}else if(x==='close')S.dre.open=false;
else if(x==='regen'){S.dre.txt=null;S.copied=''}
else if(x==='flags'){const code=drCode(),lines=S.log.map(e=>{const p=matchP(e,code);if(e.f||(p&&p.o!=='ok')){const w2=p?p.w.replace(/^Doctor check:?\s*/i,''):'';return e.n+': '+(p&&p.o==='x'?'on the prohibited list ('+p.n+', '+p.w.toLowerCase()+')':p&&p.o==='d'?'doctor check'+(w2?' ('+w2+')':''):'flagged by recruiter')+'. OK to proceed?'}return null}).filter(Boolean);const ex=S.dre.concern.trim();S.dre.concern=(ex?ex+'\n':'')+lines.filter(l=>!ex.includes(l)).join('\n');if(!lines.length)S.copied='Nothing flagged yet';else if(S.dre.txt!=null)S.copied='Concern updated. Rebuild the text to include it'}
else if(x==='copy'){}
else if(x==='send'){const t=S.dre.txt!=null?S.dre.txt:drText();if(typeof sendPrompt==='function'){sendPrompt('Here is the Dr enquiry for '+drCode()+':\n\n'+t);S.copied='Sent to chat'}else S.copied='Sending to chat is not available here'}}
commit()}

export {askConds,qcUse,qcVal,siteOk,emPlan,noteShows,opensWith,followUpLabels,valueOf,multiB,ansOrder,ansSlot,primaryIdx,opensFollowUp,idReady,qcLeft,qcDone,preqDone,psDone,nextStep,COL,DD,EF,EMRE,FLD,RAYDAR_VERSION,SC,TL,TODAY,TXT,ZP,act,add,addRows,advance,age,avl,bmi,cKey,cRisk,cStat,camel,cn,conflictDate,curQ,dd,doJump,drCode,drText,eParts,eText,esc,ev,fmt,fmtL,fmtR,fname,fresh,frontier,goQ,inCarry,isAway,isMedT,iso,lastDay,matchP,needsReview,nextOpen,nm,oc,ocls,openC,pShown,pl,planStudies,proFor,proS,pushLog,qMatches,qset,ranked,reason,rk,selC,selTypes,short,srcLabel,srcQ,start,stayHit,sug,sugQ,syncAuto,tipAway,tipCohort,tipStay,tipVisit,tlB,vE,vS,vStat};
