import { clamp } from '../core/util.js';


/* Deterministic layer: limit exceedance + physics cross-checks.
   Runs independently of the ML layer so faults are caught two ways.   */
export const RULES=[
 {id:'R-101',sys:'Combustion', txt:'EGT spread beyond 90 \u00B0C',      test:(m,r)=>r.egtSpread>90,       sev:1},
 {id:'R-102',sys:'Combustion', txt:'EGT spread beyond 150 \u00B0C',     test:(m,r)=>r.egtSpread>150,      sev:2},
 {id:'R-110',sys:'Combustion', txt:'Single-cylinder CHT + EGT co-rise', test:(m,r)=>r.cht.some((c,i)=>c>20&&r.egt[i]>40), sev:2},
 {id:'R-120',sys:'Lubrication',txt:'Oil pressure below model by 0.6 bar',test:(m,r)=>r.oilP<-0.6&&m.rpm>2000, sev:1},
 {id:'R-121',sys:'Lubrication',txt:'Oil pressure below 1.5 bar',        test:m=>m.rpm>2500&&m.oilP<1.5,   sev:2},
 {id:'R-122',sys:'Lubrication',txt:'Oil temperature above model by 12 \u00B0C',test:(m,r)=>r.oilT>12, sev:1},
 {id:'R-130',sys:'Cooling',    txt:'Coolant temperature above model by 10 \u00B0C',test:(m,r)=>r.cltT>10, sev:1},
 {id:'R-131',sys:'Cooling',    txt:'Coolant temperature above 115 \u00B0C',test:m=>m.cltT>115,          sev:2},
 {id:'R-140',sys:'Induction',  txt:'MAP short of commanded boost',      test:(m,r)=>r.map<-2.2,           sev:1},
 {id:'R-141',sys:'Induction',  txt:'Intake air temperature above 70 \u00B0C',test:m=>m.iat>70,            sev:1},
 {id:'R-142',sys:'Induction',  txt:'Air filter differential pressure above 4 kPa',test:m=>m.dp>4, sev:1},
 {id:'R-150',sys:'Mechanical', txt:'Vibration above ISO 10816 zone C',  test:m=>m.vibRms>7.1,             sev:1},
 {id:'R-151',sys:'Mechanical', txt:'Vibration above ISO 10816 zone D',  test:m=>m.vibRms>11.2,            sev:2},
 {id:'R-152',sys:'Mechanical', txt:'2x order dominant over 1x',         test:m=>m.vib2>m.vib1&&m.vib2>3.5,sev:1},
 {id:'R-160',sys:'Fuel',       txt:'Fuel pressure below 0.22 bar',      test:m=>m.rpm>2000&&m.fuelP<0.22, sev:1},
 {id:'R-161',sys:'Fuel',       txt:'Fuel flow below model by 3 L/h',    test:(m,r)=>r.ff<-3&&m.rpm>3000,  sev:1},
 {id:'R-170',sys:'Electrical', txt:'Bus voltage below 12.4 V',          test:m=>m.rpm>2500&&m.volt<12.4,  sev:1},
 {id:'R-171',sys:'Electrical', txt:'Alternator not charging',           test:m=>m.rpm>2500&&m.amp<2,      sev:2},
 {id:'R-180',sys:'Sensors',    txt:'CHT channel disagrees with siblings',
   test:(m,r)=>{const o=[0,1,3].map(i=>m.cht[i]);const avg=o.reduce((a,b)=>a+b,0)/3;
     return Math.abs(m.cht[2]-avg)>25&&Math.abs(r.cltT)<6&&Math.abs(r.egt[2])<35;},sev:1},
 {id:'R-190',sys:'Power',      txt:'Shaft power below model by 8 hp',   test:(m,r)=>r.powerHp<-8&&m.rpm>3000,sev:1}
];
export class Diagnostics{
  constructor(){this.active=new Map();this.hold=new Map();}
  run(m,r,t){
    const fired=[],events=[];
    for(const R of RULES){
      let ok=false; try{ok=R.test(m,r);}catch(e){}
      const h=(this.hold.get(R.id)||0)+(ok?1:-2);
      this.hold.set(R.id,clamp(h,0,14));
      const latched=this.hold.get(R.id)>=8;      // 0.8 s persistence filter
      if(latched){
        fired.push(R);
        if(!this.active.has(R.id)){this.active.set(R.id,t);events.push({type:'rule',sev:R.sev,txt:`${R.id} ${R.txt}`,sys:R.sys,t});}
      }else if(this.active.has(R.id)&&this.hold.get(R.id)===0){
        this.active.delete(R.id);events.push({type:'clear',sev:0,txt:`${R.id} cleared`,sys:R.sys,t});
      }
    }
    return {fired,events};
  }
  reset(){this.active.clear();this.hold.clear();}
}
