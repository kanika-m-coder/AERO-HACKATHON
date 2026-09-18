import { el, $ } from '../core/util.js';
import { bus } from '../core/EventBus.js';
import { S } from '../core/store.js';
import { VIEWS } from './views/registry.js';

const NAVBTN = {};

export const NAV=[
  ['Live monitoring',['overview','telemetry','twin','health']],
  ['Diagnosis and prediction',['faults','predictive','rul']],
  ['Operate',['simulation','replay','reports']],
  ['Reference',['architecture']]
];
export const ORDER=NAV.flatMap(g=>g[1]);
let current=null;
export const getCurrent=()=>current;
export const getCurrentView=()=>VIEWS[current];
export const clearAlert=()=>{const b=NAVBTN[current];if(b)b.classList.remove('has-alert');};

export function buildNav(){
  const nav=$('#nav');
  NAV.forEach(([g,keys])=>{
    nav.appendChild(el('div','rail-group',g));
    keys.forEach(k=>{
      const v=VIEWS[k];
      const b=el('button','navitem');
      b.innerHTML=`<span class="lyr">${v.layer}</span><span>${v.nav}</span><span class="dot"></span>`;
      b.onclick=()=>route(k);
      b.dataset.key=k;
      NAVBTN[k]=b;
      nav.appendChild(b);
    });
  });
}
export function buildViews(){
  const host=$('#views');
  ORDER.forEach(k=>{
    const v=VIEWS[k];
    const sec=el('section','view');sec.id='view-'+k;
    const head=el('div','view-head');
    const left=el('div');
    left.appendChild(el('h1','view-title',v.title));
    left.appendChild(el('p','view-desc',v.desc));
    head.appendChild(left);
    head.appendChild(el('div','panel-tag','LAYER '+v.layer));
    sec.appendChild(head);
    v._host=sec;
    host.appendChild(sec);
  });
}
export function route(k){
  if(!VIEWS[k])return;
  current=k;
  const v=VIEWS[k];
  if(!v._built){ v._host.appendChild(v.build()); v._built=true; }
  ORDER.forEach(x=>{
    VIEWS[x]._host.classList.toggle('active',x===k);
    const btn=NAVBTN[x];
    if(btn)btn.setAttribute('aria-current',String(x===k));
  });
  try{ v.seed&&v.seed(S); }catch(e){console.error(e);}
  try{ S.sensors&&v.update&&v.update(S); }catch(e){console.error(e);}
  window.scrollTo({top:0,behavior:'instant'});
}

/* --- alert badges on nav -------------------------------------------- */
bus.on('alarm',e=>{
  const map={Combustion:'faults',Lubrication:'faults',Cooling:'faults',Induction:'faults',
    Mechanical:'faults',Fuel:'faults',Electrical:'faults',Sensors:'faults',Power:'faults'};
  const k=map[e.sys]||'faults';
  const b=NAVBTN[k];
  if(b&&current!==k)b.classList.add('has-alert');
});
