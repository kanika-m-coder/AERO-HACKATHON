import { clamp, lerp } from '../core/util.js';


/* Condition indices per subsystem: blends wear state, residual energy
   and any latched rule exceedances into a 0-100 condition index.      */
export const SUBSYS=[
 {id:'fuel',        name:'Fuel system',         deg:['injectors'],        res:r=>Math.abs(r.ff)/4.5+Math.abs(r.fuelP)/0.11},
 {id:'cooling',     name:'Cooling system',      deg:['cooling'],          res:r=>Math.max(0,r.cltT)/16+Math.max(0,r.chtMean)/22},
 {id:'lubrication', name:'Lubricant system',    deg:['bearings','oil'],   res:r=>Math.abs(r.oilP)/1.1+Math.max(0,r.oilT)/22},
 {id:'health',      name:'Health',              deg:[],                   res:r=>0},
 {id:'bearing',     name:'Bearing degradation', deg:['bearings'],         res:r=>Math.max(0,r.vibRms)/3.4+Math.max(0,r.oilT)/30},
 {id:'overheating', name:'Overheating',          deg:['cooling'],          res:r=>Math.max(0,r.chtMean)/20+Math.max(0,r.cltT)/16}
];
export class HealthMonitor{
  constructor(){this.idx={};SUBSYS.forEach(s=>this.idx[s.id]=100);}
  compute(r,deg,fired){
    const bySys={};fired.forEach(f=>{bySys[f.sys]=Math.max(bySys[f.sys]||0,f.sev);});
    const out={};
    for(const s of SUBSYS){
      const wear=s.deg.length?s.deg.reduce((a,k)=>(deg[k]||0)+a,0)/s.deg.length:0;
      let resid=0; try{resid=clamp(s.res(r),0,3);}catch(e){}
      const ruleHit=(bySys[s.name]||bySys[s.name.split(' ')[0]]||(s.id==='lubrication'?bySys['Lubrication']:0)||(s.id==='bearing'?bySys['Mechanical']:0)||(s.id==='overheating'?bySys['Cooling']:0)||0);
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
