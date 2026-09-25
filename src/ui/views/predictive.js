import { clamp, fmt, el, $ } from '../../core/util.js';
import { FAULT_DEFS } from '../../backend/faults.js';
import { FEATS } from '../../backend/MLService.js';
import { S } from '../../core/store.js';
import { panel, kv, bar } from '../components/panel.js';
import { cssv } from '../components/style.js';
import { newChart } from '../components/TimeChart.js';
import { VIEWS } from './registry.js';


VIEWS.predictive={
  layer:'06', nav:'Predictive analytics', title:'AI / ML predictive analytics',
  desc:'Three models run on the standardised residual vector: an LSTM autoencoder for unsupervised anomaly detection, a gradient-boosted classifier for fault mode, and a Bayesian degradation model feeding the RUL layer. Inference happens on-board, at frame rate.',
  build(){
    const root=el('div','grid g-2-1');
    const an=panel('Anomaly score','LSTM AUTOENCODER \u00B7 RECONSTRUCTION ERROR');
    an.body.className='panel-body tight';
    this.chA=newChart({height:170,window:300,min:0,thresh:0.38,series:[
      {key:'a',color:cssv('--caution'),label:'Anomaly score',fill:true},
      {key:'i',color:cssv('--ink-3'),label:'Instantaneous',w:1}]});
    this.chA.mount(an.body);
    root.appendChild(an);

    const st=panel('Detector state','');
    this.aBig=el('div');this.aBig.style.cssText='font-family:var(--mono);font-size:38px;font-weight:600;line-height:1';
    st.body.appendChild(this.aBig);
    this.aSub=el('div','dim');this.aSub.style.cssText='font-size:12px;margin:2px 0 12px';
    st.body.appendChild(this.aSub);
    this.kThr=kv('Decision threshold','0.380');
    this.kLatency=kv('Detection latency','\u2014');
    this.kInf=kv('Inference time','\u2014');
    this.kWin=kv('Sequence window','60 frames / 6 s');
    [this.kThr,this.kLatency,this.kInf,this.kWin].forEach(x=>st.body.appendChild(x));
    root.appendChild(st);

    const cl=panel('Fault mode classification','GRADIENT-BOOSTED TREES \u00B7 12 CLASSES');
    this.clWrap=el('div');cl.body.appendChild(this.clWrap);
    root.appendChild(cl);

    const fe=panel('Feature attribution','STANDARDISED RESIDUALS');
    this.feWrap=el('div');fe.body.appendChild(this.feWrap);
    root.appendChild(fe);

    const mc=panel('Model registry','DEPLOYED ON EDGE COMPUTE');
    mc.body.className='panel-body tight';
    const w=el('div','tbl-wrap');
    w.innerHTML=`<table><thead><tr><th>Model</th><th>Task</th><th>Architecture</th><th class="num">Params</th><th class="num">Validation</th><th>Trained on</th></tr></thead><tbody>
      <tr><td>ae-resid-v4</td><td>Anomaly detection</td><td>LSTM autoencoder, 2\u00D764 latent 12</td><td class="num">184 k</td><td class="num">AUC 0.961</td><td>412 h nominal flight</td></tr>
      <tr><td>clf-mode-v7</td><td>Fault classification</td><td>Gradient-boosted trees, 300 est.</td><td class="num">\u2014</td><td class="num">F1 0.913</td><td>1 840 seeded fault runs</td></tr>
      <tr><td>rul-bayes-v3</td><td>Remaining useful life</td><td>Bayesian exponential degradation</td><td class="num">32</td><td class="num">MAPE 11.4%</td><td>27 run-to-failure sets</td></tr>
      <tr><td>twin-cal-v2</td><td>Twin calibration</td><td>Least-squares parameter fit</td><td class="num">46</td><td class="num">R\u00B2 0.987</td><td>Test-cell acceptance data</td></tr>
      </tbody></table>`;
    mc.body.appendChild(w);
    mc.className+=' span2';root.appendChild(mc);
    this.detectStart=null;
    return root;
  },
  update(S){
    const ml=S.ml;
    this.chA.push(S.t,[ml.anomalyEma,ml.anomaly]);
    this.aBig.textContent=fmt(ml.anomalyEma,3);
    this.aBig.style.color=ml.detected?cssv('--warn'):ml.anomalyEma>0.28?cssv('--caution'):cssv('--nominal');
    this.aSub.textContent=ml.detected?'Anomaly declared — residual pattern is off the nominal manifold'
      :ml.anomalyEma>0.28?'Elevated but below threshold':'Within the nominal operating manifold';
    this.kInf.val.textContent=fmt(ml.infMs,2)+' ms';
    const anyFault=FAULT_DEFS.some(f=>S.eng.faults[f.id].armed);
    if(anyFault&&this.detectStart==null)this.detectStart=S.t;
    if(!anyFault)this.detectStart=null;
    if(this.detectStart!=null&&ml.detected){if(!this._lat)this._lat=S.t-this.detectStart;}
    if(!anyFault)this._lat=null;
    this.kLatency.val.textContent=this._lat?fmt(this._lat,1)+' s from injection':'\u2014';

    if(!this._t||performance.now()-this._t>320){
      this._t=performance.now();
      this.clWrap.innerHTML='';
      ml.cls.slice(0,6).forEach(c=>{
        const row=el('div');row.style.marginBottom='9px';
        const col=c.id==='nominal'?cssv('--nominal'):c.p>0.6?cssv('--warn'):c.p>0.3?cssv('--caution'):cssv('--ink-3');
        row.innerHTML=`<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:3px">
            <span>${c.name}</span><span class="mono">${(c.p*100).toFixed(1)}%</span></div>
          <div class="bar"><span style="width:${c.p*100}%;background:${col}"></span></div>
          <div class="dimmer mono" style="font-size:10px;margin-top:2px">${c.sys}</div>`;
        this.clWrap.appendChild(row);
      });
      this.feWrap.innerHTML='';
      const names={egtSpread:'EGT spread',egtMean:'EGT mean',cht3:'CHT 3 vs siblings',oilP:'Oil pressure',
        oilT:'Oil temperature',cltT:'Coolant temperature',map:'Manifold pressure',ff:'Fuel flow',
        vib1:'Vibration 1x',vib2:'Vibration 2x',volt:'Bus voltage',fuelP:'Fuel pressure',
        iat:'Intake air temp',power:'Shaft power',dp:'Filter \u0394 pressure',egtOut:'EGT outlier, signed'};
      FEATS.map((k,i)=>({k,z:ml.z[i]})).sort((a,b)=>Math.abs(b.z)-Math.abs(a.z)).slice(0,8).forEach(f=>{
        const row=el('div');row.style.marginBottom='8px';
        const mag=clamp(Math.abs(f.z)/3,0,1)*100;
        const col=Math.abs(f.z)>2?cssv('--warn'):Math.abs(f.z)>1?cssv('--caution'):cssv('--ink-3');
        row.innerHTML=`<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
            <span class="dim">${names[f.k]}</span><span class="mono">${f.z>=0?'+':''}${f.z.toFixed(2)}\u03C3</span></div>
          <div class="bar"><span style="width:${mag}%;background:${col}"></span></div>`;
        this.feWrap.appendChild(row);
      });
    }
  },
  seed(S){this.chA.clear();S.rec.buf.slice(-300).forEach(f=>this.chA.push(f.t,[f.anom,null]));}
};
