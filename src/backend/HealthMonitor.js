import { clamp, lerp } from '../core/util.js';


/* Condition indices per subsystem: blends wear state, residual energy
   and any latched rule exceedances into a 0-100 condition index.      */
export const SUBSYS=[
 {id:'combustion', name:'Combustion',   deg:['rings'],            res:r=>Math.abs(r.egtSpread-30)/60+Math.abs(r.egtMean)/70},
 {id:'lubrication',name:'Lubrication',  deg:['bearings','oil'],   res:r=>Math.abs(r.oilP)/1.1+Math.max(0,r.oilT)/22},
 {id:'cooling',    name:'Cooling',      deg:['cooling'],          res:r=>Math.max(0,r.cltT)/16+Math.max(0,r.chtMean)/22},
 {id:'induction',  name:'Induction & turbo',deg:['turbo','filter'],res:r=>Math.abs(r.map)/4.5+Math.max(0,r.iat)/20},
 {id:'ignition',   name:'Ignition',     deg:['ignition'],         res:r=>Math.abs(r.egtMean)/60+Math.max(0,r.vib1)/3.2},
 {id:'fuel',       name:'Fuel system',  deg:['injectors'],        res:r=>Math.abs(r.ff)/4.5+Math.abs(r.fuelP)/0.11},
 {id:'mechanical', name:'Mechanical',   deg:['bearings','rings'], res:r=>Math.max(0,r.vibRms)/3.4},
 {id:'electrical', name:'Electrical',   deg:[],                   res:r=>Math.abs(r.volt)/1.3+Math.abs(r.amp)/14}
];
export class HealthMonitor{
  constructor(){this.idx={};SUBSYS.forEach(s=>this.idx[s.id]=100);}
  compute(r,deg,fired){
    const bySys={};fired.forEach(f=>{bySys[f.sys]=Math.max(bySys[f.sys]||0,f.sev);});
    const out={};
    for(const s of SUBSYS){
      const wear=s.deg.length?s.deg.reduce((a,k)=>a+deg[k],0)/s.deg.length:0;
      let resid=0; try{resid=clamp(s.res(r),0,3);}catch(e){}
      const ruleHit=(bySys[s.name]||bySys[s.name.split(' ')[0]]||0);
      let v=100-wear*32-resid*22-ruleHit*11;
      this.idx[s.id]=lerp(this.idx[s.id],clamp(v,0,100),0.05);
      out[s.id]={name:s.name,value:this.idx[s.id]};
    }
    const vals=Object.values(out).map(o=>o.value);
    const overall=0.55*(vals.reduce((a,b)=>a+b,0)/vals.length)+0.45*Math.min(...vals);
    return {subsystems:out,overall};
  }
  reset(){SUBSYS.forEach(s=>this.idx[s.id]=100);}
}
