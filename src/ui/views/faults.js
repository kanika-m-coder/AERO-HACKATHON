import { hhmmss, el, $ } from '../../core/util.js';
import { FAULT_DEFS } from '../../backend/faults.js';
import { RULES } from '../../backend/Diagnostics.js';
import { S, engine } from '../../core/store.js';
import { panel, kv } from '../components/panel.js';
import { cssv, sevClass } from '../components/style.js';
import { renderLog } from '../components/log.js';
import { VIEWS } from './registry.js';


VIEWS.faults={
  layer:'07', nav:'Fault detection', title:'Fault detection',
  desc:'A deterministic rule engine of 20 checks runs beside the machine-learning layer so that a fault is caught two independent ways. Rules use both absolute limits and physics cross-checks against the twin, with a 0.8 s persistence filter to reject transients.',
  build(){
    const root=el('div','grid g-2-1');
    const act=panel('Active conditions','LATCHED');
    act.body.className='panel-body tight';
    this.actWrap=el('div');this.actWrap.style.padding='6px';act.body.appendChild(this.actWrap);
    root.appendChild(act);

    const sm=panel('Detection summary','STATUS');
    this.kActive=kv('Active rules','0');
    this.kWarn=kv('Warnings','0');
    this.kCaut=kv('Cautions','0');
    this.kLast=kv('Last event','\u2014');
    this.kMtbf=kv('Rules evaluated','0');
    [this.kActive,this.kWarn,this.kCaut,this.kLast,this.kMtbf].forEach(x=>sm.body.appendChild(x));
    sm.body.appendChild(el('div','sep'));
    this.hint=el('p','hint');sm.body.appendChild(this.hint);
    root.appendChild(sm);

    const mx=panel('Rule matrix','20 RULES \u00B7 8 SUBSYSTEMS');
    mx.body.className='panel-body tight';
    const w=el('div','tbl-wrap');this.mxTbl=el('table');w.appendChild(this.mxTbl);mx.body.appendChild(w);
    mx.className+=' span2';root.appendChild(mx);

    const lg=panel('Event log','FULL MISSION');
    this.log=el('div','log');this.log.style.maxHeight='420px';lg.body.appendChild(this.log);
    lg.className+=' span2';root.appendChild(lg);
    this.evalCount=0;
    return root;
  },
  update(S){
    const fired=S.diag.fired;
    this.kActive.val.textContent=fired.length;
    const w=fired.filter(f=>f.sev===2).length,c=fired.length-w;
    this.kWarn.val.textContent=w;this.kWarn.val.className='v mono '+(w?'wrn':'dim');
    this.kCaut.val.textContent=c;this.kCaut.val.className='v mono '+(c?'cau':'dim');
    const last=S.alarms.find(e=>e.sev>0);
    this.kLast.val.textContent=last?hhmmss(last.t):'\u2014';
    this.evalCount+=RULES.length;
    this.kMtbf.val.textContent=this.evalCount.toLocaleString();

    const armed=FAULT_DEFS.filter(f=>S.eng.faults[f.id].sev>0.02);
    this.hint.innerHTML=armed.length
      ? 'Signature under way: '+armed.map(f=>`<span class="cau">${f.name}</span> at ${(S.eng.faults[f.id].sev*100).toFixed(0)}% severity`).join('; ')+'.'
      : 'No fault is injected. Use the simulation view to inject one and watch the rules and the classifier pick it up.';

    if(!this._t||performance.now()-this._t>350){
      this._t=performance.now();
      this.actWrap.innerHTML='';
      if(!fired.length){
        this.actWrap.appendChild(el('div','dim','No condition is outside tolerance. The rule engine is evaluating all 19 checks every frame.'));
      }else{
        fired.slice().sort((a,b)=>b.sev-a.sev).forEach(f=>{
          const d=el('div');
          d.style.cssText='border-left:2px solid '+(f.sev===2?cssv('--warn'):cssv('--caution'))+
            ';padding:8px 11px;margin-bottom:7px;background:var(--bg)';
          d.innerHTML=`<div style="display:flex;gap:9px;align-items:center;margin-bottom:2px">
            <span class="pill ${sevClass(f.sev)}">${f.sev===2?'WARNING':'CAUTION'}</span>
            <span class="mono dimmer" style="font-size:11px">${f.id}</span>
            <span class="mono dimmer" style="font-size:11px;margin-left:auto">${f.sys}</span></div>
            <div style="font-size:13px">${f.txt}</div>`;
          this.actWrap.appendChild(d);
        });
      }
      const activeIds=new Set(fired.map(f=>f.id));
      this.mxTbl.innerHTML='<thead><tr><th>ID</th><th>Subsystem</th><th>Check</th><th class="num">Severity</th><th>State</th></tr></thead><tbody>'+
        RULES.map(R=>{const on=activeIds.has(R.id);
          return `<tr${on?' style="background:color-mix(in srgb,'+(R.sev===2?cssv('--warn'):cssv('--caution'))+' 9%,transparent)"':''}>
            <td class="mono dimmer">${R.id}</td><td>${R.sys}</td><td>${R.txt}</td>
            <td class="num dimmer">${R.sev===2?'Warning':'Caution'}</td>
            <td><span class="pill ${on?sevClass(R.sev):'dimmer'}">${on?'ACTIVE':'clear'}</span></td></tr>`;}).join('')+'</tbody>';
      renderLog(this.log,S.alarms.slice(0,60));
    }
  },
  seed(){}
};
