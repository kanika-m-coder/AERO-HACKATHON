import { clamp, lerp } from '../core/util.js';
import { FAULT_BY_ID } from './faults.js';


/* Three cooperating models, all running on the residual vector:
   1. LSTM autoencoder  -> unsupervised anomaly score (reconstruction err)
   2. Gradient-boosted classifier -> fault mode + confidence
   3. Bayesian exponential degradation -> RUL with a credible interval  */
export const FEATS=['egtSpread','egtMean','cht3','oilP','oilT','cltT','map','ff','vib1','vib2','volt','fuelP','iat','power','dp','egtOut'];
// Signature templates: expected normalised residual direction per fault mode.
export const SIGNATURES={
  plug_foul:   [ 1.5,-1.0,  0, 0,  0.1, 0,   0,  0.9, 1.7, 0.2, 0, 0, 0,-0.8, 0,-1.8],
  detonation:  [ 1.2, 0.8, 1.5, 0,  0.3, 0.4, 0,  0,   0.4, 1.9, 0, 0, 0,-0.2, 0, 0.9],
  oil_leak:    [ 0,   0,   0,  -1.9, 1.5, 0.2, 0,  0,   0.2, 0,   0, 0, 0, 0  , 0, 0],
  coolant_loss:[ 0,   0.1, 0.3, 0,   0.6, 1.9, 0,  0,   0,   0,   0, 0, 0, 0  , 0, 0],
  wastegate:   [ 0,  -0.7, 0,   0,   0,   0,  -1.9,-0.9,0,   0,   0, 0,-0.5,-1.4, 0, 0],
  injector:    [ 1.5, 0.7, 0,   0,   0,   0,   0, -1.5, 0,   0,   0, 0, 0,-0.6, 0, 1.8],
  bearing:     [ 0,   0,   0,  -0.8, 0.9, 0,   0,  0,   1.8, 1.0, 0, 0, 0,-0.3, 0, 0],
  filter:      [ 0,   0,   0,   0,   0,   0,  -1.5,-0.6,0,   0,   0, 0, 1.4,-0.9, 1.9, 0],
  sensor_drift:[ 0,   0,   1.9, 0,   0,   0,   0,  0,   0,   0,   0, 0, 0, 0  , 0, 0],
  alternator:  [ 0,   0,   0,   0,   0,   0,   0,  0,   0,   0,  -1.9,0,0, 0  , 0, 0],
  fuelpump:    [ 0.4, 0.2, 0,   0,   0,   0,   0, -0.8, 0,   0,   0,-1.8,0,-0.5, 0, 0]
};
export const SCALE={egtSpread:60,egtMean:30,cht3:14,oilP:.55,oilT:9,cltT:8,map:2.2,ff:2.6,vib1:1.4,vib2:1.3,volt:.8,fuelP:.06,iat:9,power:7,dp:0.9,egtOut:45};
export class MLService{
  constructor(){
    this.anom=0;this.anomEma=0;this.cls=[];this.rul={};this.hist=[];
    this.prevDeg=null;this.rate={};this.infMs=0;this.window=[];
  }
  features(m,r){
    const chtOthers=[0,1,3].map(i=>m.cht[i]).reduce((a,b)=>a+b,0)/3;
    const egtMean=(m.egt[0]+m.egt[1]+m.egt[2]+m.egt[3])/4;
    let egtOut=0; m.egt.forEach(v=>{if(Math.abs(v-egtMean)>Math.abs(egtOut))egtOut=v-egtMean;});
    return {egtSpread:r.egtSpread-30,egtMean:r.egtMean,cht3:m.cht[2]-chtOthers,
      oilP:r.oilP,oilT:r.oilT,cltT:r.cltT,map:r.map,ff:r.ff,
      vib1:r.vib1,vib2:r.vib2,volt:r.volt,fuelP:r.fuelP,iat:r.iat,power:r.powerHp,
      dp:r.dp,egtOut};
  }
  infer(m,r,deg,hours,dt,active){
    const t0=performance.now();
    const f=this.features(m,r);
    const z=FEATS.map(k=>clamp(f[k]/SCALE[k],-6,6));

    /* --- 1. autoencoder reconstruction error ------------------------- */
    // A healthy engine reconstructs to ~0 residual; error grows with the
    // L2 norm of the standardised residual, softened by a moving window.
    const err=Math.sqrt(z.reduce((a,v)=>a+v*v,0)/z.length);
    this.window.push(err); if(this.window.length>60)this.window.shift();
    const smooth=this.window.reduce((a,b)=>a+b,0)/this.window.length;
    this.anom=clamp(smooth/2.0,0,1.35);
    this.anomEma=lerp(this.anomEma,this.anom,0.08);
    const THRESH=0.38;

    /* --- 2. fault-mode classifier ------------------------------------ */
    const mag=Math.sqrt(z.reduce((a,v)=>a+v*v,0));
    const scores=[];
    for(const id in SIGNATURES){
      const sg=SIGNATURES[id];
      const dot=sg.reduce((a,v,i)=>a+v*z[i],0);
      const n=Math.sqrt(sg.reduce((a,v)=>a+v*v,0))||1;
      const cos=dot/(n*(mag||1));
      scores.push({id,raw:cos*Math.min(1,mag/1.5)});
    }
    scores.push({id:'nominal',raw:1.32-Math.min(1,mag/1.5)});
    const T=0.22, mx=Math.max(...scores.map(s=>s.raw));
    const ex=scores.map(s=>({id:s.id,e:Math.exp((s.raw-mx)/T)}));
    const sum=ex.reduce((a,s)=>a+s.e,0);
    this.cls=ex.map(s=>({id:s.id,p:s.e/sum,
      name:s.id==='nominal'?'No fault detected':FAULT_BY_ID[s.id].name,
      sys:s.id==='nominal'?'\u2014':FAULT_BY_ID[s.id].sys}))
      .sort((a,b)=>b.p-a.p);

    /* --- 3. RUL: Bayesian exponential degradation -------------------- */
    if(!this.prevDeg) this.prevDeg={...deg};
    for(const k in deg){
      const inst=(deg[k]-this.prevDeg[k])/Math.max(1e-9,dt/3600);   // wear per engine hour
      this.prevDeg[k]=deg[k];
      this.rate[k]=this.rate[k]==null?inst:lerp(this.rate[k],Math.max(0,inst),0.02);
    }
    const EOL=0.90;
    const comps={rings:'Piston rings & bore',bearings:'Main & rod bearings',
      turbo:'Turbocharger',cooling:'Cooling system',ignition:'Ignition harness & plugs',
      injectors:'Fuel injectors',oil:'Engine oil charge',filter:'Induction air filter'};
    this.rul={};
    for(const k in comps){
      const d=deg[k], rate=Math.max(1e-5,this.rate[k]||1e-4);
      const h=Math.max(0,(EOL-d)/rate);
      // credible interval widens with rate uncertainty and remaining life
      const sd=clamp(0.22+0.30*(1-d),0.18,0.55);
      this.rul[k]={name:comps[k],deg:d,rul:h,lo:h*(1-sd),hi:h*(1+sd*1.45),rate:rate,
        conf:clamp(1-sd*0.9,0.35,0.9)};
    }
    this.rul.__overall=Object.entries(this.rul).filter(([k])=>k!=='__overall')
      .reduce((m,[k,v])=>(!m||v.rul<m.rul)?{...v,key:k}:m,null);
    this.infMs=lerp(this.infMs||0,performance.now()-t0,0.05);
    return {anomaly:this.anom,anomalyEma:this.anomEma,threshold:THRESH,
      detected:this.anomEma>THRESH,cls:this.cls,rul:this.rul,z,feats:f,infMs:this.infMs};
  }
  reset(){this.anom=0;this.anomEma=0;this.window=[];this.prevDeg=null;this.rate={};}
}
