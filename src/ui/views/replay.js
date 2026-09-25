import { clamp, hhmmss, el, $ } from '../../core/util.js';
import { S, engine, recorder } from '../../core/store.js';
import { panel, bar } from '../components/panel.js';
import { cssv } from '../components/style.js';
import { newChart } from '../components/TimeChart.js';
import { toast } from '../components/toast.js';
import { renderLog } from '../components/log.js';
import { VIEWS } from './registry.js';


VIEWS.replay={
  layer:'09', nav:'Mission replay', title:'Mission replay',
  desc:'The data recorder keeps a 1 Hz frame of every channel, the twin expectation, the anomaly score and any rule that was firing. Scrub back to the moment a caution appeared and read the whole engine state at that instant.',
  build(){
    const root=el('div','grid');
    const ctl=panel('Recorder','1 Hz \u00B7 2 h RING BUFFER');
    const bar_=el('div');bar_.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px';
    this.bEnter=el('button','btn primary','Enter replay');
    this.bPlay=el('button','btn','Play');
    this.bStep=el('button','btn mono','\u25C0 10 s');
    this.bStep2=el('button','btn mono','10 s \u25B6');
    this.bLive=el('button','btn','Return to live');
    this.tPos=el('span','mono dim');this.tPos.style.marginLeft='auto';
    [this.bEnter,this.bPlay,this.bStep,this.bStep2,this.bLive,this.tPos].forEach(x=>bar_.appendChild(x));
    ctl.body.appendChild(bar_);
    this.tl=el('div','timeline');ctl.body.appendChild(this.tl);
    this.scrub=el('input');this.scrub.type='range';this.scrub.min=0;this.scrub.max=1;this.scrub.step=1;this.scrub.value=0;
    ctl.body.appendChild(this.scrub);
    ctl.body.appendChild(el('div','hint','Markers on the strip are recorded events: amber for a caution, red for a warning, grey for a phase change.'));
    root.appendChild(ctl);

    this.bEnter.onclick=()=>{ if(!S.rec.buf.length){toast('Nothing recorded yet');return;}
      S.replay.mode=true;S.replay.t=S.rec.duration;this.scrub.value=S.rec.buf.length-1;this.render();toast('Replay mode');};
    this.bLive.onclick=()=>{S.replay.mode=false;S.replay.playing=false;this.bPlay.textContent='Play';toast('Live telemetry');};
    this.bPlay.onclick=()=>{if(!S.replay.mode)return;S.replay.playing=!S.replay.playing;
      this.bPlay.textContent=S.replay.playing?'Pause':'Play';};
    this.bStep.onclick=()=>this.step(-10);
    this.bStep2.onclick=()=>this.step(10);
    this.scrub.oninput=()=>{S.replay.mode=true;const f=S.rec.buf[+this.scrub.value];if(f){S.replay.t=f.t;this.render();}};

    const g=el('div','grid g2');
    const fr=panel('Frame state','AT CURSOR');
    fr.body.className='panel-body tight';
    const w=el('div','tbl-wrap');this.frTbl=el('table');w.appendChild(this.frTbl);fr.body.appendChild(w);
    g.appendChild(fr);
    const ev=panel('Events at this point','\u00B1 30 s');
    this.evLog=el('div','log');ev.body.appendChild(this.evLog);
    g.appendChild(ev);
    root.appendChild(g);

    const ch=panel('Recorded traces','FULL MISSION');
    ch.body.className='panel-body tight';
    this.ch=newChart({height:200,window:999999,series:[
      {key:'p',color:cssv('--nominal'),label:'Shaft power, hp'},
      {key:'c',color:cssv('--caution'),label:'CHT max, \u00B0C'},
      {key:'a',color:cssv('--warn'),label:'Anomaly \u00D7100'},
      {key:'h',color:cssv('--twin'),label:'Health index'}]});
    this.ch.mount(ch.body);
    root.appendChild(ch);
    return root;
  },
  step(d){ if(!S.rec.buf.length)return; S.replay.mode=true;
    const i=clamp(+this.scrub.value+d,0,S.rec.buf.length-1);
    this.scrub.value=i;const f=S.rec.buf[i];if(f){S.replay.t=f.t;this.render();} },
  update(S){
    if(S.replay.mode&&S.replay.playing){
      const i=+this.scrub.value+1;
      if(i>=S.rec.buf.length){S.replay.playing=false;this.bPlay.textContent='Play';}
      else{this.scrub.value=i;S.replay.t=S.rec.buf[i].t;}
    }
    if(!S.replay.mode){this.scrub.max=Math.max(1,S.rec.buf.length-1);
      if(!S.replay.playing)this.scrub.value=S.rec.buf.length-1;}
    this.bLive.classList.toggle('on',!S.replay.mode);
    this.bEnter.classList.toggle('on',S.replay.mode);
    if(!this._t||performance.now()-this._t>200){this._t=performance.now();this.render();}
  },
  render(){
    const buf=S.rec.buf;
    this.scrub.max=Math.max(1,buf.length-1);
    const f=buf[clamp(+this.scrub.value,0,buf.length-1)];
    this.tPos.textContent=S.replay.mode?('REPLAY '+hhmmss(f?f.t:0)+' / '+hhmmss(S.rec.duration)):('LIVE '+hhmmss(S.t));
    const dur=Math.max(1,S.rec.duration);
    this.tl.innerHTML=S.rec.events.map(e=>{
      const col=e.sev===2?cssv('--warn'):e.sev===1?cssv('--caution'):cssv('--ink-3');
      return `<div class="ev" style="left:${e.t/dur*100}%;background:${col};opacity:${e.sev?1:.45}" title="${e.txt}"></div>`;
    }).join('')+(f?`<div class="cursor" style="left:${f.t/dur*100}%"></div>`:'');

    if(f){
      const rows=[['Phase',f.phase,''],['Throttle',(f.throttle*100).toFixed(0),'%'],
        ['Altitude',f.alt.toFixed(0),'ft'],['RPM',f.m.rpm.toFixed(0),''],
        ['MAP',f.m.map.toFixed(2),'inHg'],['EGT max',Math.max(...f.m.egt).toFixed(0),'\u00B0C'],
        ['CHT max',Math.max(...f.m.cht).toFixed(1),'\u00B0C'],
        ['Oil pressure',f.m.oilP.toFixed(2),'bar'],['Oil temperature',f.m.oilT.toFixed(1),'\u00B0C'],
        ['Coolant',f.m.cltT.toFixed(1),'\u00B0C'],['Fuel flow',f.m.ff.toFixed(2),'L/h'],
        ['Vibration',f.m.vibRms.toFixed(2),'mm/s'],['Bus voltage',f.m.volt.toFixed(2),'V'],
        ['Shaft power',f.m.powerHp.toFixed(1),'hp'],['Twin power',f.e.powerHp.toFixed(1),'hp'],
        ['Anomaly score',f.anom.toFixed(3),''],['Health index',f.health.toFixed(1),''],
        ['Rules firing',f.rules.length?f.rules.join(' '):'none','']];
      this.frTbl.innerHTML='<thead><tr><th>Parameter</th><th class="num">Value</th><th>Unit</th></tr></thead><tbody>'+
        rows.map(([k,v,u])=>`<tr><td>${k}</td><td class="num">${v}</td><td class="dimmer mono" style="font-size:11px">${u}</td></tr>`).join('')+'</tbody>';
      const near=S.rec.events.filter(e=>Math.abs(e.t-f.t)<=30).slice(-14).reverse();
      renderLog(this.evLog,near);
    }
    this.ch.clear();
    const stride=Math.max(1,Math.floor(buf.length/600));
    for(let i=0;i<buf.length;i+=stride){const b=buf[i];
      this.ch.push(b.t,[b.m.powerHp,Math.max(...b.m.cht),b.anom*100,b.health]);}
    this.ch.o.window=Math.max(60,dur);
  },
  seed(){this.render();}
};
