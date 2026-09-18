import { fmt, hhmmss, el, $ } from '../../core/util.js';
import { S, engine } from '../../core/store.js';
import { panel, kv, bar } from '../components/panel.js';
import { cssv, healthColor } from '../components/style.js';
import { tape } from '../components/tape.js';
import { newChart } from '../components/TimeChart.js';
import { renderLog } from '../components/log.js';
import { VIEWS } from './registry.js';




VIEWS.overview={
  layer:'09', nav:'Mission overview', title:'Mission overview',
  desc:'Live consolidated picture of the airframe, the engine and its digital twin. Every number here is produced by the simulated sensor bus, never read from the plant model directly.',
  build(){
    const root=el('div','grid');
    // hero: tape cluster
    const tp=panel('Engine instrument cluster','MEASURED \u00B7 \u2013\u2013\u2013 TWIN PREDICTION');
    tp.body.className='panel-body tight';
    const tapes=el('div','tapes');
    this.tapes={};
    [['rpm','RPM'],['map','MAP'],['egt','EGT MAX'],['cht','CHT MAX'],['oilP','OIL P'],
     ['oilT','OIL T'],['cltT','CLT T'],['ff','FUEL FL'],['vib','VIB'],['volt','BUS V']]
      .forEach(([k,l])=>{const t=tape(k,l);this.tapes[k]=t;tapes.appendChild(t);});
    tp.body.appendChild(tapes);
    tp.className+=' span2';
    root.appendChild(tp);

    const st=panel('System status','MASTER');
    this.mStatus=el('div');this.mStatus.style.cssText='font-size:22px;font-weight:600;margin-bottom:2px';
    this.mSub=el('div','dim');this.mSub.style.cssText='font-size:12.5px;margin-bottom:12px';
    st.body.appendChild(this.mStatus);st.body.appendChild(this.mSub);
    this.hBar=bar('Overall condition index',100);
    st.body.appendChild(this.hBar);
    st.body.appendChild(el('div','sep'));
    this.kAnom=kv('Anomaly score','0.000');
    this.kMode=kv('Likely fault mode','\u2014');
    this.kRul=kv('Limiting RUL','\u2014');
    this.kAlarm=kv('Active alarms','0');
    [this.kAnom,this.kMode,this.kRul,this.kAlarm].forEach(x=>st.body.appendChild(x));
    root.appendChild(st);

    const fl=panel('Flight & mission','AIRFRAME');
    this.kPhase=kv('Phase','\u2014');this.kThr=kv('Throttle','0 %');
    this.kAlt=kv('Altitude','0 ft');this.kTas=kv('True airspeed','0 kt');
    this.kPwr=kv('Shaft power','0 hp');this.kFuel=kv('Fuel remaining','0 kg');
    this.kEnd=kv('Endurance at current burn','\u2014');
    [this.kPhase,this.kThr,this.kAlt,this.kTas,this.kPwr,this.kFuel,this.kEnd].forEach(x=>fl.body.appendChild(x));
    root.appendChild(fl);

    const c1=panel('Power & boost','MEASURED vs TWIN');
    c1.body.className='panel-body tight';
    this.ch1=newChart({height:150,window:120,series:[
      {key:'p',color:cssv('--nominal'),label:'Shaft power, hp'},
      {key:'pt',color:cssv('--twin'),label:'Twin power, hp',dash:true},
      {key:'m',color:cssv('--info'),label:'MAP, inHg'}]});
    this.ch1.mount(c1.body);
    root.appendChild(c1);

    const c2=panel('Thermal state','CHT / EGT / COOLANT');
    c2.body.className='panel-body tight';
    this.ch2=newChart({height:150,window:120,series:[
      {key:'cht',color:cssv('--caution'),label:'CHT max, \u00B0C'},
      {key:'clt',color:cssv('--info'),label:'Coolant, \u00B0C'},
      {key:'oil',color:cssv('--nominal'),label:'Oil, \u00B0C'}]});
    this.ch2.mount(c2.body);
    root.appendChild(c2);

    const al=panel('Recent events','LAST 12');
    this.log=el('div','log');al.body.appendChild(this.log);
    al.className+=' span2';
    root.appendChild(al);

    root.className='grid g2';
    return root;
  },
  update(S){
    const m=S.sensors,e=S.twin;
    this.tapes.rpm.set(m.rpm,e.rpm);
    this.tapes.map.set(m.map,e.map);
    this.tapes.egt.set(Math.max(...m.egt),Math.max(...e.egt));
    this.tapes.cht.set(Math.max(...m.cht),Math.max(...e.cht));
    this.tapes.oilP.set(m.oilP,e.oilP);
    this.tapes.oilT.set(m.oilT,e.oilT);
    this.tapes.cltT.set(m.cltT,e.cltT);
    this.tapes.ff.set(m.ff,e.ff);
    this.tapes.vib.set(m.vibRms,e.vibRms);
    this.tapes.volt.set(m.volt,e.volt);

    const warn=S.diag.fired.some(f=>f.sev===2), caut=S.diag.fired.length>0;
    this.mStatus.textContent=warn?'WARNING':caut?'CAUTION':'NOMINAL';
    this.mStatus.className=warn?'wrn':caut?'cau':'nom';
    this.mSub.textContent=warn?'Exceedance active — crew action required'
      :caut?`${S.diag.fired.length} condition${S.diag.fired.length>1?'s':''} outside model tolerance`
      :'All subsystems within model tolerance';
    this.hBar.set(S.health.overall,healthColor(S.health.overall));
    this.kAnom.val.textContent=fmt(S.ml.anomalyEma,3)+(S.ml.detected?'  \u25B2':'');
    this.kAnom.val.className='v mono '+(S.ml.detected?'wrn':'nom');
    const top=S.ml.cls[0];
    this.kMode.val.textContent=top.id==='nominal'?'None':`${top.name.split(',')[0]} ${(top.p*100).toFixed(0)}%`;
    this.kMode.val.className='v mono '+(top.id==='nominal'?'nom':top.p>0.6?'wrn':'cau');
    const ov=S.ml.rul.__overall;
    if(ov){this.kRul.val.textContent=fmt(ov.rul,0)+' h  \u00B7 '+ov.name.split(' ')[0];
      this.kRul.val.className='v mono '+(ov.rul<25?'wrn':ov.rul<80?'cau':'nom');}
    this.kAlarm.val.textContent=S.diag.fired.length;
    this.kAlarm.val.className='v mono '+(warn?'wrn':caut?'cau':'nom');

    this.kPhase.val.textContent=S.phase;
    this.kThr.val.textContent=(S.cmd.throttle*100).toFixed(0)+' %';
    this.kAlt.val.textContent=S.cmd.alt.toFixed(0)+' ft';
    this.kTas.val.textContent=m.tas.toFixed(0)+' kt';
    this.kPwr.val.textContent=fmt(m.powerHp,1)+' hp';
    this.kFuel.val.textContent=fmt(m.fuelKg,1)+' kg';
    const burn=m.ff*0.72; // kg/h
    this.kEnd.val.textContent=burn>0.5?hhmmss(m.fuelKg/burn*3600):'\u2014';

    this.ch1.push(S.t,[m.powerHp,e.powerHp,m.map]);
    this.ch2.push(S.t,[Math.max(...m.cht),m.cltT,m.oilT]);
    renderLog(this.log,S.alarms.slice(0,12));
  },
  seed(S){
    this.ch1.clear();this.ch2.clear();
    S.rec.buf.slice(-120).forEach(f=>{
      this.ch1.push(f.t,[f.m.powerHp,f.e.powerHp,f.m.map]);
      this.ch2.push(f.t,[Math.max(...f.m.cht),f.m.cltT,f.m.oilT]);});
  }
};
