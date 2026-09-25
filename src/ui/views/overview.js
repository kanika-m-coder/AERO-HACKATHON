import { fmt, hhmmss, el, $ } from '../../core/util.js';
import { S, engine } from '../../core/store.js';
import { panel, kv, bar } from '../components/panel.js';
import { cssv, healthColor } from '../components/style.js';
import { tape } from '../components/tape.js';
import { newChart } from '../components/TimeChart.js';
import { renderLog } from '../components/log.js';
import { VIEWS } from './registry.js';
import { auth } from '../../core/auth.js';
import { bus } from '../../core/EventBus.js';
import { evaluateEngineRange } from '../../backend/engineRange.js';

VIEWS.overview={
  layer:'01', nav:'Mission overview', title:'Mission overview',
  desc:'Live consolidated picture of the airframe, the engine and its digital twin. Protected by JWT authentication and Role-Based Access Control.',
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

    /* --- Security Status Section --- */
    const secStatusPanel = panel('Security Status', 'PROTECTED LAYER');
    secStatusPanel.body.className = 'panel-body tight';
    this.secStatusWrap = el('div', 'sec-status-grid');
    this.secStatusWrap.style.padding = '10px';
    secStatusPanel.body.appendChild(this.secStatusWrap);

    const secBadgeDiv = el('div');
    secBadgeDiv.style.cssText = 'padding:0 10px 10px;display:flex;justify-content:space-between;align-items:center';
    secBadgeDiv.innerHTML = `
      <span class="security-badge-pill">
        <span class="dot-active"></span>
        SECURE SESSION • JWT • RBAC
      </span>
      <span class="mono dimmer" style="font-size:10px" id="userRoleBadge"></span>
    `;
    secStatusPanel.body.appendChild(secBadgeDiv);
    root.appendChild(secStatusPanel);

    /* --- Security Activity Audit Log --- */
    const secLogPanel = panel('Security Activity', 'AUDIT LOG');
    secLogPanel.body.className = 'panel-body tight';
    this.secLogContainer = el('div', 'log');
    this.secLogContainer.style.cssText = 'max-height:160px;padding:8px;overflow-y:auto';
    secLogPanel.body.appendChild(this.secLogContainer);
    root.appendChild(secLogPanel);

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

    /* --- Engine Range (Engine Reference Values) Section --- */
    const rangePanel = panel('Engine Range', 'ENGINE REFERENCE VALUES & MONITORING STATUS');
    rangePanel.body.className = 'panel-body tight';
    const rangeWrap = el('div', 'tbl-wrap');
    this.rangeTbl = el('table');
    rangeWrap.appendChild(this.rangeTbl);
    rangePanel.body.appendChild(rangeWrap);
    rangePanel.className += ' span2';
    root.appendChild(rangePanel);

    const al=panel('Recent events','LAST 12');
    this.log=el('div','log');al.body.appendChild(this.log);
    al.className+=' span2';
    root.appendChild(al);

    root.className='grid g2';

    bus.on('security_event', () => this.updateSecLogs());
    return root;
  },
  updateSecLogs(){
    if(!this.secLogContainer) return;
    const evts = auth.events.slice(0, 8);
    this.secLogContainer.innerHTML = evts.map(e => {
      const sevClass = e.sev === 2 ? 'wrn' : e.sev === 1 ? 'cau' : 'nom';
      const tag = e.sev === 2 ? 'BLOCKED' : e.sev === 1 ? 'WARN' : 'ACTIVE';
      return `<div style="display:flex;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid var(--rule-soft);font-size:11.5px">
        <span class="mono dimmer" style="font-size:10px;width:52px;flex:none">${e.timeStr || 'now'}</span>
        <span class="pill ${sevClass}" style="flex:none;font-size:9px;padding:2px 5px">${tag}</span>
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${e.txt}">${e.txt}</span>
        <span class="mono dimmer" style="font-size:10px;flex:none">${e.user}</span>
      </div>`;
    }).join('');
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

    /* Update Security Status items */
    const sec = auth.getSecurityStatus();
    this.secStatusWrap.innerHTML = `
      <div class="sec-status-card"><div class="k">AUTHENTICATION</div><div class="v">${sec.auth}</div></div>
      <div class="sec-status-card"><div class="k">API SECURITY</div><div class="v">${sec.api}</div></div>
      <div class="sec-status-card"><div class="k">TELEMETRY</div><div class="v">${sec.tls}</div></div>
      <div class="sec-status-card"><div class="k">DEVICE AUTH</div><div class="v">${sec.deviceAuth}</div></div>
      <div class="sec-status-card"><div class="k">DATA STORAGE</div><div class="v">${sec.storage}</div></div>
    `;

    const u = auth.getCurrentUser();
    const userRoleEl = document.getElementById('userRoleBadge');
    if (userRoleEl && u) {
      userRoleEl.textContent = `${u.username} • ${u.role}`;
    }

    this.updateSecLogs();

    /* Update Engine Range (Engine Reference Values) Table */
    const rangeData = evaluateEngineRange(m, S);
    if (this.rangeTbl) {
      this.rangeTbl.innerHTML = `
        <thead>
          <tr>
            <th>Detected Parameter</th>
            <th class="num">Actual Value</th>
            <th class="num">Reference Value / Range</th>
            <th class="num">Deviation</th>
            <th style="width:110px;text-align:center">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rangeData.map(r => {
            const statusClass = r.status === 'HEALTHY' ? 'nom' : r.status === 'WARNING' ? 'cau' : 'wrn';
            const pillClass = r.status === 'HEALTHY' ? 'nom' : r.status === 'WARNING' ? 'cau' : 'wrn';
            return `
              <tr>
                <td><strong>${r.param}</strong></td>
                <td class="num mono">${r.actualStr}</td>
                <td class="num mono dimmer">${r.refStr}</td>
                <td class="num mono ${statusClass}">${r.devStr}</td>
                <td style="text-align:center">
                  <span class="pill ${pillClass}" style="font-size:10px;padding:2px 8px;font-weight:700">${r.status}</span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      `;
    }

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
