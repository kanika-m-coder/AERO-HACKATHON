import { fmt, hhmmss, el, $ } from '../../core/util.js';
import { FAULT_DEFS } from '../../backend/faults.js';
import { PROFILES } from '../../backend/profiles.js';
import { S, engine, recorder } from '../../core/store.js';
import { panel, kv } from '../components/panel.js';
import { tape } from '../components/tape.js';
import { VIEWS } from './registry.js';


const LAYERS=[
 ['01','Physical asset and sensor set','Turbocharged 4-cylinder aero-piston engine, 4x EGT, 4x CHT, oil and fuel pressure and temperature, coolant, MAP, IAT, tri-axial accelerometer, filter differential pressure, tacho, bus voltage.','EngineModel'],
 ['02','Data acquisition and conditioning','10 Hz sampling, anti-alias filtering, quantisation and per-channel noise; sensor faults live here so the layers above never see the truth for free.','SensorLayer'],
 ['03','Simulation and scenario control','Mission profile scheduler, manual flight control, and progressive fault injection across 11 seeded failure modes.','PROFILES / FAULT_DEFS'],
 ['04','Telemetry transport','Frame assembly, downlink latency and loss accounting, channel health. The ground segment consumes only what arrives over this link.','Recorder.tick'],
 ['05','Digital twin core','A calibrated healthy-engine model integrated in lock-step at the same commanded operating point. Emits expectations and residuals.','DigitalTwin'],
 ['06','Health monitoring','Condition indices per subsystem from wear state, residual energy and latched exceedances; limit-margin tracking against published limits.','HealthMonitor'],
 ['07','Fault detection','20 deterministic rules combining absolute limits with physics cross-checks, each behind a persistence filter to reject transients.','Diagnostics'],
 ['08','AI/ML predictive analytics and RUL','LSTM autoencoder for anomaly, gradient-boosted classifier for fault mode, Bayesian degradation model for remaining useful life with credible intervals.','MLService'],
 ['09','Visualisation','EICAS-style instrument cluster, time-series canvas plots, residual and attribution views, condition dashboards.','TimeChart / tape / views'],
 ['10','Reporting and replay','1 Hz mission data recorder with scrub and playback; consolidated mission, health, RUL and maintenance-action report.','Recorder / Reporting']
];
VIEWS.architecture={
  layer:'\u2014', nav:'System architecture', title:'System architecture',
  desc:'How the ten layers stack up, and which module in this build implements each one. Layers carrying live data right now are marked.',
  build(){
    const root=el('div','grid g-2-1');
    const a=panel('Layer stack','BOTTOM-UP');
    a.body.className='panel-body tight';
    const st=el('div','arch');st.style.margin='8px';
    this.rows=LAYERS.map(([n,name,desc,mod])=>{
      const r=el('div','arch-layer');
      r.innerHTML=`<div class="n">${n}</div><div class="c"><h4>${name}</h4><p>${desc}</p>
        <code>${mod}</code> <span class="mono dimmer" style="font-size:10px;float:right" data-rate></span></div>`;
      st.appendChild(r);return {r,rate:r.querySelector('[data-rate]')};
    });
    a.body.appendChild(st);
    root.appendChild(a);

    const side=el('div','grid');
    const fl=panel('Data flow','PER FRAME');
    fl.body.innerHTML=`<pre class="mono" style="font-size:11px;color:var(--ink-2);margin:0;white-space:pre-wrap;line-height:1.7">
throttle, altitude, OAT
  \u2193
EngineModel.step()        ground truth + wear
  \u2193
SensorLayer.read()        noise, faults
  \u2193                     \u2198
DigitalTwin.expect()  \u2192  residuals
  \u2193                     \u2193
Diagnostics.run()     MLService.infer()
  \u2193                     \u2193
HealthMonitor      anomaly \u00B7 mode \u00B7 RUL
  \u2198                     \u2199
      Recorder \u00B7 Views \u00B7 Reporting</pre>`;
    side.appendChild(fl);

    const sp=panel('Runtime','THIS SESSION');
    this.kFps=kv('Frame rate','\u2014');
    this.kSim=kv('Simulated time','\u2014');
    this.kTick=kv('Tick budget','\u2014');
    this.kMem=kv('Recorder frames','\u2014');
    this.kInf=kv('ML inference','\u2014');
    this.kCh=kv('Channels modelled','32');
    [this.kFps,this.kSim,this.kTick,this.kMem,this.kInf,this.kCh].forEach(x=>sp.body.appendChild(x));
    side.appendChild(sp);
    root.appendChild(side);
    return root;
  },
  update(S){
    this.kSim.val.textContent=hhmmss(S.t)+'  \u00D7'+S.speed;
    this.kMem.val.textContent=S.rec.buf.length.toLocaleString()+' / '+S.rec.cap.toLocaleString();
    this.kInf.val.textContent=fmt(S.ml.infMs,2)+' ms/frame';
    this.kTick.val.textContent=fmt(window.__tickMs||0,2)+' ms';
    this.kFps.val.textContent=fmt(window.__fps||0,0)+' Hz';
    const live=[true,true,S.mode!=='off',true,true,true,S.diag.fired.length>0,S.ml.detected,true,S.rec.buf.length>0];
    this.rows.forEach((x,i)=>{x.r.classList.toggle('live',!!live[i]);});
    if(!this._t||performance.now()-this._t>700){
      this._t=performance.now();
      const rates=['10 Hz','10 Hz',S.mode,'10 Hz','10 Hz','10 Hz',
        S.diag.fired.length+' active','score '+fmt(S.ml.anomalyEma,2),'60 Hz',S.rec.buf.length+' frames'];
      this.rows.forEach((x,i)=>x.rate.textContent=rates[i]);
    }
  },
  seed(){}
};
