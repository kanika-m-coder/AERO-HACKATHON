import { el, $, fmt, hhmmss } from '../core/util.js';
import { sevOf } from '../backend/limits.js';
import { S, resetAll } from '../core/store.js';
import { toast } from './components/toast.js';

/* --- status strip --------------------------------------------------- */
export const STRIP=[
  ['MET',s=>hhmmss(s.t),null],
  ['PHASE',s=>s.phase,null],
  ['RPM',s=>s.sensors.rpm.toFixed(0),s=>sevOf('rpm',s.sensors.rpm)],
  ['MAP',s=>s.sensors.map.toFixed(1),s=>sevOf('map',s.sensors.map)],
  ['EGT',s=>Math.max(...s.sensors.egt).toFixed(0),s=>sevOf('egt',Math.max(...s.sensors.egt))],
  ['CHT',s=>Math.max(...s.sensors.cht).toFixed(0),s=>sevOf('cht',Math.max(...s.sensors.cht))],
  ['OIL P',s=>s.sensors.oilP.toFixed(2),s=>sevOf('oilP',s.sensors.oilP)],
  ['VIB',s=>s.sensors.vibRms.toFixed(1),s=>sevOf('vib',s.sensors.vibRms)],
  ['HEALTH',s=>fmt(s.health.overall,0),s=>s.health.overall<60?2:s.health.overall<80?1:0],
  ['ANOMALY',s=>fmt(s.ml.anomalyEma,2),s=>s.ml.detected?2:s.ml.anomalyEma>0.28?1:0]
];
let STRIP_EL=null, STRIP_BLOCKS=[], MASTERBAR=null, RAILCLOCK=null;
export function buildStrip(){
  const strip=STRIP_EL=$('#strip');
  MASTERBAR=$('#masterbar'); RAILCLOCK=$('#railClock');
  const blocks=STRIP.map(([k])=>{
    const b=el('div','strip-block');
    b.appendChild(el('div','k',k));
    const v=el('div','v','--');b.appendChild(v);
    b.val=v;strip.appendChild(b);return b;
  });
  strip.appendChild(el('div','strip-spacer'));
  const ctl=el('div','strip-ctl');
  const bPlay=el('button','btn primary','Pause');
  bPlay.onclick=()=>{S.running=!S.running;bPlay.textContent=S.running?'Pause':'Resume';
    bPlay.classList.toggle('primary',S.running);};
  ctl.appendChild(bPlay);
  [1,5,20].forEach(sp=>{
    const b=el('button','btn mono'+(sp===1?' on':''),'\u00D7'+sp);
    b.onclick=()=>{S.speed=sp;ctl.querySelectorAll('.btn.mono').forEach(x=>x.classList.remove('on'));b.classList.add('on');};
    ctl.appendChild(b);
  });
  const bReset=el('button','btn','Reset');
  bReset.onclick=()=>{resetAll();
    document.querySelectorAll('.toggle').forEach(t=>t.setAttribute('aria-pressed','false'));
    toast('Simulation reset');};
  ctl.appendChild(bReset);
  const bTheme=el('button','btn','Light');
  bTheme.onclick=()=>{const d=document.documentElement;
    const light=d.getAttribute('data-theme')==='light';
    d.setAttribute('data-theme',light?'dark':'light');
    bTheme.textContent=light?'Light':'Dark';};
  ctl.appendChild(bTheme);
  strip.appendChild(ctl);
  STRIP_BLOCKS=blocks;
}
export function updateStrip(S){
  STRIP.forEach(([k,get,sev],i)=>{
    const b=STRIP_BLOCKS[i];
    if(!b)return;
    let txt='--',s=0;
    try{txt=get(S);s=sev?sev(S):0;}catch(e){}
    b.val.textContent=txt;
    b.val.className='v '+(s===2?'wrn':s===1?'cau':'');
  });
  const warn=S.diag.fired.some(f=>f.sev===2), caut=S.diag.fired.length>0;
  if(MASTERBAR)MASTERBAR.className='masterbar'+(warn?' warn':caut?' caution':'');
  if(RAILCLOCK)RAILCLOCK.textContent='MET '+hhmmss(S.t);
}
