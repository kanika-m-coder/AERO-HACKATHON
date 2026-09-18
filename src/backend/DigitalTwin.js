import { clamp, lerp } from '../core/util.js';


/* A calibrated model of a HEALTHY engine of this type at the same
   commanded operating point. Residual = measured - twin expectation.   */
export class DigitalTwin{
  constructor(){this.e=null;this.syncQ=1.0;}
  expect(cmd,dt,tas){
    const th=clamp(cmd.throttle,0,1),alt=cmd.alt;
    const pAmb=29.92*Math.pow(1-6.87535e-6*alt,5.2559);
    const oat=cmd.oat-1.98*(alt/1000);
    const map=Math.min(12.5+th*(39.8-12.5),Math.min(41,pAmb*0.98*2.55));
    const rpm=cmd.running?(1580+th*(5790-1580))*(0.86+0.14*(map/39.8)):0;
    const load=(map/39.8)*(rpm/5800);
    const power=115*Math.pow(clamp(load,0,1.1),0.92);
    const e={
      rpm,map,boost:Math.max(0,map-pAmb),iat:oat+2.4*Math.max(0,map-pAmb)+6,
      egt:[6,-9,3,-2].map(o=>(cmd.running?505+load*415-38*(1-th):40)+o),
      cht:[2,-3,4,-1].map(o=>(cmd.running?58+load*52+0.30*oat:oat)+o),
      oilP:cmd.running?clamp(1.05+(rpm/5800)*3.5-((66+load*38+0.25*oat)-90)*0.012,0.2,6.5):0,
      oilT:cmd.running?66+load*38+0.25*oat:oat,
      cltT:cmd.running?62+load*44+0.165*oat:oat,
      ff:cmd.running?2.6+power*0.305:0,
      fuelP:cmd.running?0.34-0.06*th:0,
      vib1:cmd.running?1.8+load*1.9:0, vib2:cmd.running?0.9+load*1.1:0,
      dp:0.35+((rpm/5800)*(map/39.8))*1.25,
      volt:(cmd.running&&rpm>2200)?14.2:12.1,
      amp:(cmd.running&&rpm>2200)?16:-11,
      powerHp:power, tas:cmd.running?42+power*0.93:0
    };
    e.vibRms=Math.hypot(e.vib1,e.vib2);
    // first-order settle so the twin tracks thermal lag rather than stepping
    if(!this.e){this.e=e;}else{
      const k=(tc)=>1-Math.exp(-dt/tc);
      const p=this.e;
      for(const key of ['rpm','map','boost','iat','oilP','oilT','cltT','ff','fuelP','vib1','vib2','vibRms','volt','amp','powerHp','tas','dp']){
        const tc={oilT:30,cltT:22,iat:6,rpm:1.1,map:.45,ff:.8,tas:8}[key]||2;
        p[key]=lerp(p[key],e[key],k(tc));
      }
      for(let i=0;i<4;i++){p.egt[i]=lerp(p.egt[i],e.egt[i],k(2.2));p.cht[i]=lerp(p.cht[i],e.cht[i],k(14));}
    }
    return this.e;
  }
  residuals(m,e){
    const r={};
    for(const k of ['rpm','map','boost','iat','oilP','oilT','cltT','ff','fuelP','vib1','vib2','vibRms','volt','amp','powerHp','tas','dp']) r[k]=m[k]-e[k];
    r.egt=m.egt.map((v,i)=>v-e.egt[i]);
    r.cht=m.cht.map((v,i)=>v-e.cht[i]);
    r.egtSpread=Math.max(...m.egt)-Math.min(...m.egt);
    r.chtSpread=Math.max(...m.cht)-Math.min(...m.cht);
    r.egtMean=r.egt.reduce((a,b)=>a+b,0)/4;
    r.chtMean=r.cht.reduce((a,b)=>a+b,0)/4;
    return r;
  }
}
