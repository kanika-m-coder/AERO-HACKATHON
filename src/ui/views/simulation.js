import { clamp, el, $ } from '../../core/util.js';
import { FAULT_DEFS } from '../../backend/faults.js';
import { PROFILES } from '../../backend/profiles.js';
import { S, engine, pushEvent } from '../../core/store.js';
import { panel } from '../components/panel.js';
import { cssv } from '../components/style.js';
import { toast } from '../components/toast.js';
import { VIEWS } from './registry.js';


VIEWS.simulation={
  layer:'08', nav:'Simulation & faults', title:'Simulation and fault injection',
  desc:'Drive the plant model directly. Mission profiles fly themselves; manual mode gives you the throttle. Injected faults ramp in progressively, the way real degradation arrives, so you can watch detection latency rather than a step change.',
  build(){
    const root=el('div','grid g-1-2');
    const ctl=panel('Flight control','PLANT INPUT');
    const pf=el('label','fld');
    pf.innerHTML='<span>MISSION PROFILE</span>';
    this.selProfile=el('select');
    Object.entries(PROFILES).forEach(([k,v])=>{const o=el('option');o.value=k;o.textContent=v.name;this.selProfile.appendChild(o);});
    this.selProfile.value=S.profile;
    this.selProfile.onchange=()=>{S.profile=this.selProfile.value;S.seg=0;S.segT=0;
      pushEvent({type:'info',sev:0,txt:'Profile loaded: '+PROFILES[S.profile].name,sys:'Mission',t:S.t});
      toast('Profile loaded');};
    pf.appendChild(this.selProfile);ctl.body.appendChild(pf);

    const md=el('div');md.style.cssText='display:flex;gap:6px;margin-bottom:12px';
    this.bAuto=el('button','btn on','Autopilot');
    this.bMan=el('button','btn','Manual throttle');
    this.bAuto.onclick=()=>{S.mode='auto';this.bAuto.classList.add('on');this.bMan.classList.remove('on');};
    this.bMan.onclick=()=>{S.mode='manual';this.bMan.classList.add('on');this.bAuto.classList.remove('on');};
    md.appendChild(this.bAuto);md.appendChild(this.bMan);ctl.body.appendChild(md);

    const mk=(label,min,max,step,val,unit,fn)=>{
      const l=el('label','fld');
      const span=el('span');span.innerHTML=label+' <b class="mono" style="float:right;font-weight:500"></b>';
      l.appendChild(span);
      const i=el('input');i.type='range';i.min=min;i.max=max;i.step=step;i.value=val;
      const out=span.querySelector('b');out.textContent=(+val).toFixed(step<1?1:0)+' '+unit;
      i.oninput=()=>{out.textContent=(+i.value).toFixed(step<1?1:0)+' '+unit;fn(+i.value);};
      l.appendChild(i);l.out=out;l.input=i;return l;
    };
    this.sThr=mk('THROTTLE',0,100,1,16,'%',v=>{if(S.mode==='manual')S.cmd.throttle=v/100;});
    this.sAlt=mk('COMMANDED ALTITUDE',0,26000,100,0,'ft',v=>{if(S.mode==='manual')S.cmd.alt=v;});
    this.sOat=mk('SEA-LEVEL OAT',-20,50,1,24,'\u00B0C',v=>{S.cmd.oat=v;});
    [this.sThr,this.sAlt,this.sOat].forEach(x=>ctl.body.appendChild(x));

    const row=el('div');row.style.cssText='display:flex;gap:6px;flex-wrap:wrap';
    const bCut=el('button','btn','Cut ignition');
    bCut.onclick=()=>{S.armed=!S.armed;bCut.textContent=S.armed?'Cut ignition':'Restart engine';
      bCut.classList.toggle('on',!S.armed);
      if(S.armed)S.eng.starts++;
      pushEvent({type:'info',sev:S.armed?0:2,txt:S.armed?'Engine restart commanded':'Ignition cut commanded',sys:'Mission',t:S.t});};
    const bAge=el('button','btn','Age 25 h');
    bAge.onclick=()=>{for(let i=0;i<9000;i++)S.eng.step(10,S.cmd);S.eng.hours+=0;toast('Advanced 25 engine hours of wear');};
    row.appendChild(bCut);row.appendChild(bAge);
    ctl.body.appendChild(el('div','sep'));ctl.body.appendChild(row);
    root.appendChild(ctl);

    const fi=panel('Fault injection','11 SEEDED FAILURE MODES');
    this.fiWrap=el('div');fi.body.appendChild(this.fiWrap);
    FAULT_DEFS.forEach(f=>{
      const r=el('div','switchrow');
      const l=el('div');
      l.innerHTML=`<div class="nm">${f.name}</div><div class="sub">${f.sys} \u00B7 <span data-sev>0%</span></div>
        <div class="hint" style="margin-top:3px;max-width:60ch">${f.hint}</div>`;
      const t=el('button','toggle');t.setAttribute('aria-pressed','false');
      t.setAttribute('aria-label','Inject '+f.name);
      t.onclick=()=>{const on=t.getAttribute('aria-pressed')!=='true';
        t.setAttribute('aria-pressed',String(on));S.eng.setFault(f.id,on);
        pushEvent({type:'inject',sev:on?1:0,txt:(on?'Fault injected: ':'Fault cleared: ')+f.name,sys:f.sys,t:S.t});
        toast(on?'Injected: '+f.name:'Cleared: '+f.name);};
      r.appendChild(l);r.appendChild(t);
      r.sev=l.querySelector('[data-sev]');r.toggle=t;r.fid=f.id;
      this.fiWrap.appendChild(r);
    });
    const cl=el('button','btn','Clear all faults');
    cl.style.marginTop='12px';
    cl.onclick=()=>{S.eng.clearFaults();
      this.fiWrap.querySelectorAll('.toggle').forEach(t=>t.setAttribute('aria-pressed','false'));
      pushEvent({type:'inject',sev:0,txt:'All injected faults cleared',sys:'Mission',t:S.t});toast('All faults cleared');};
    fi.body.appendChild(cl);
    root.appendChild(fi);

    const pr=panel('Mission profile timeline','SEGMENTS');
    pr.body.className='panel-body tight';
    this.tl=el('div','timeline');this.tl.style.margin='8px';pr.body.appendChild(this.tl);
    pr.className+=' span2';root.appendChild(pr);
    return root;
  },
  update(S){
    if(S.mode==='auto'){
      this.sThr.input.value=S.cmd.throttle*100;this.sThr.out.textContent=(S.cmd.throttle*100).toFixed(0)+' %';
      this.sAlt.input.value=S.cmd.alt;this.sAlt.out.textContent=S.cmd.alt.toFixed(0)+' ft';
    }
    if(!this._t||performance.now()-this._t>300){
      this._t=performance.now();
      this.fiWrap.querySelectorAll('.switchrow').forEach(r=>{
        const sv=S.eng.faults[r.fid].sev;
        r.sev.textContent=(sv*100).toFixed(0)+'%';
        r.sev.className=sv>0.6?'wrn':sv>0.1?'cau':'';
      });
      const segs=PROFILES[S.profile].segs, total=segs.reduce((a,s)=>a+s.d,0);
      let acc=0;
      this.tl.innerHTML=segs.map((s,i)=>{
        const left=acc/total*100,wpc=s.d/total*100;acc+=s.d;
        const on=i===S.seg;
        return `<div class="seg" style="left:${left}%;width:${wpc}%;${on?'background:color-mix(in srgb,'+cssv('--caution')+' 16%,transparent);color:'+cssv('--caution'):''}">${s.ph}</div>`;
      }).join('')+`<div class="cursor" style="left:${clamp((segs.slice(0,S.seg).reduce((a,s)=>a+s.d,0)+S.segT)/total,0,1)*100}%"></div>`;
    }
  },
  seed(){}
};
