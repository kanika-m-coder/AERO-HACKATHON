import { clamp, lerp } from '../core/util.js';
import { FAULT_DEFS } from './faults.js';


/* Ground-truth plant model. Produces the physical state the real engine
   would be in, including the effect of wear and injected faults.        */
export class EngineModel{
  constructor(){this.reset();}
  reset(){
    this.t=0;
    this.s={rpm:0,map:12,iat:15,boost:0,powerHp:0,
      egt:[120,120,120,120],cht:[22,22,22,22],
      oilP:0,oilT:22,cltT:22,ff:0,fuelP:0,vib1:0,vib2:0,vibRms:0,dp:0.4,
      volt:12.4,amp:0,fuelKg:62,oilL:3.5,cltL:2.6,tas:0,cyclePk:[0,0,0,0]};
    // cumulative degradation, 0 = new, 1 = life expired
    this.deg={rings:0.061,bearings:0.043,turbo:0.052,cooling:0.037,
      ignition:0.074,injectors:0.058,oil:0.180,filter:0.120};
    this.faults={}; FAULT_DEFS.forEach(f=>this.faults[f.id]={armed:false,sev:0});
    this.hours=214.6;             // engine hours since overhaul
    this.starts=181;
    this.running=false;
  }
  setFault(id,on){ if(this.faults[id]) this.faults[id].armed=on; }
  clearFaults(){ Object.values(this.faults).forEach(f=>{f.armed=false;f.sev=0;}); }
  f(id){return this.faults[id].sev;}

  step(dt,cmd){
    this.t+=dt;
    const s=this.s, th=clamp(cmd.throttle,0,1), alt=cmd.alt;

    /* fault severity ramps -------------------------------------------- */
    for(const d of FAULT_DEFS){
      const f=this.faults[d.id];
      if(f.armed) f.sev=clamp(f.sev+d.rate*dt/10,0,1);
      else f.sev=clamp(f.sev-0.06*dt/10,0,1);
    }

    /* ambient ---------------------------------------------------------- */
    const pAmb=29.92*Math.pow(1-6.87535e-6*alt,5.2559);
    const oat=cmd.oat-1.98*(alt/1000);
    const ram=0.55*(s.tas/100)**2;

    /* induction / turbo ------------------------------------------------ */
    const turboEff=1-0.55*this.deg.turbo-0.85*this.f('wastegate');
    const filterLoss=1-0.30*this.f('filter')-0.10*this.deg.filter;
    const mapDemand=12.5+th*(39.8-12.5);
    const prMax=1+1.55*clamp(turboEff,0,1);          // compressor pressure ratio
    const mapCap=Math.min(41,pAmb*0.98*prMax);
    const mapT=Math.min(mapDemand,mapCap)*filterLoss; // filter drop applies either way
    s.map=lerp(s.map,Math.max(pAmb*0.42,mapT),1-Math.exp(-dt/0.45));
    s.boost=Math.max(0,s.map-pAmb);
    s.iat=lerp(s.iat,oat+2.4*s.boost*(1+0.6*this.f('filter'))+6,1-Math.exp(-dt/6));
    const flow=(s.rpm/5800)*(s.map/39.8);
    s.dp=lerp(s.dp,0.35+flow*(0.9+16*(0.25*this.deg.filter+this.f('filter'))),1-Math.exp(-dt/1.5));

    /* rotational dynamics ---------------------------------------------- */
    const rpmT=this.running?(1580+th*(5790-1580))*(0.86+0.14*(s.map/39.8)):0;
    s.rpm=lerp(s.rpm,rpmT,1-Math.exp(-dt/(th>0.5?0.9:1.6)));
    const load=(s.map/39.8)*(s.rpm/5800);

    /* power & fuel ------------------------------------------------------ */
    const ringLoss=1-0.22*this.deg.rings;
    const ignLoss=1-0.45*this.f('plug_foul')-0.12*this.deg.ignition;
    s.powerHp=115*Math.pow(clamp(load,0,1.1),0.92)*ringLoss*ignLoss;
    const inj=1-0.30*this.f('injector');
    const pumpDroop=1-0.35*this.f('fuelpump')*th;
    s.ff=lerp(s.ff,this.running?(2.6+s.powerHp*0.305)*inj*pumpDroop*(1+0.09*this.f('plug_foul')):0,1-Math.exp(-dt/0.8));
    s.fuelP=lerp(s.fuelP,this.running?(0.34-0.06*th)*(1-0.55*this.f('fuelpump')):0,1-Math.exp(-dt/1.2));
    s.fuelKg=Math.max(0,s.fuelKg-s.ff*0.72/3600*dt);

    /* per-cylinder combustion ------------------------------------------ */
    const egtBase=this.running?505+load*415-38*(1-th):40;
    const chtBase=this.running?58+load*52+0.30*oat:oat;
    const coolCap=1-0.42*this.f('coolant_loss')-0.20*this.deg.cooling;
    for(let i=0;i<4;i++){
      let e=egtBase+[6,-9,3,-2][i];
      let c=chtBase+[2,-3,4,-1][i];
      if(i===1&&this.f('plug_foul')>0){e-=195*this.f('plug_foul');c-=14*this.f('plug_foul');}
      if(i===2&&this.f('detonation')>0){e+=88*this.f('detonation');c+=46*this.f('detonation');}
      if(i===0&&this.f('injector')>0){e+=118*this.f('injector');c-=17*this.f('injector');}
      c=c/Math.max(0.45,coolCap);
      s.egt[i]=lerp(s.egt[i],e,1-Math.exp(-dt/2.2));
      s.cht[i]=lerp(s.cht[i],c,1-Math.exp(-dt/14));
      s.cyclePk[i]=lerp(s.cyclePk[i],62+load*34+38*(i===2?this.f('detonation'):0),1-Math.exp(-dt/3));
    }

    /* cooling & lubrication -------------------------------------------- */
    const cltT=this.running?(62+load*44)/Math.max(0.5,coolCap)+0.55*oat*0.3:oat;
    s.cltT=lerp(s.cltT,cltT,1-Math.exp(-dt/22));
    const oilT=this.running?(66+load*38+9*this.deg.bearings*100*0.01+14*this.f('bearing')+11*this.f('oil_leak'))+0.25*oat:oat;
    s.oilT=lerp(s.oilT,oilT,1-Math.exp(-dt/30));
    const oilPT=this.running?clamp(1.05+ (s.rpm/5800)*3.5 - (s.oilT-90)*0.012 - 2.6*this.f('oil_leak') - 0.9*this.f('bearing') - 0.5*this.deg.bearings,0.2,6.5):0;
    s.oilP=lerp(s.oilP,oilPT,1-Math.exp(-dt/1.1));
    if(this.f('oil_leak')>0) s.oilL=Math.max(0,s.oilL-0.00019*this.f('oil_leak')*dt);
    if(this.f('coolant_loss')>0) s.cltL=Math.max(0,s.cltL-0.00013*this.f('coolant_loss')*dt);

    /* vibration --------------------------------------------------------- */
    const v1=1.8+load*1.9+5.2*this.f('bearing')+3.1*this.f('plug_foul')+2.4*this.deg.bearings;
    const v2=0.9+load*1.1+6.4*this.f('detonation')+2.2*this.f('bearing');
    s.vib1=lerp(s.vib1,this.running?v1:0,1-Math.exp(-dt/1.4));
    s.vib2=lerp(s.vib2,this.running?v2:0,1-Math.exp(-dt/1.4));
    s.vibRms=Math.hypot(s.vib1,s.vib2);

    /* electrical -------------------------------------------------------- */
    const charging=this.running&&s.rpm>2200&&this.f('alternator')<0.85;
    s.volt=lerp(s.volt,charging?14.2-1.9*this.f('alternator'):12.1-0.5*this.f('alternator'),1-Math.exp(-dt/3));
    s.amp=lerp(s.amp,charging?(16-13*this.f('alternator')):-11,1-Math.exp(-dt/3));

    /* airspeed (coupled, closes the loop on lost power) ------------------ */
    const tasT=this.running?42+s.powerHp*0.93:0;
    s.tas=lerp(s.tas,tasT,1-Math.exp(-dt/8));

    /* wear accumulation -------------------------------------------------- */
    const hrs=dt/3600;
    this.hours+=hrs;
    const sev=load*load, hot=Math.max(0,Math.max(...s.cht)-112)/25;
    this.deg.rings     =clamp(this.deg.rings     +hrs*(0.00050+0.0016*sev+0.004*hot+0.030*this.f('detonation')),0,1);
    this.deg.bearings  =clamp(this.deg.bearings  +hrs*(0.00042+0.0012*sev+0.045*this.f('bearing')+0.010*Math.max(0,1.8-s.oilP)),0,1);
    this.deg.turbo     =clamp(this.deg.turbo     +hrs*(0.00060+0.0021*sev+0.006*Math.max(0,s.iat-70)/20),0,1);
    this.deg.cooling   =clamp(this.deg.cooling   +hrs*(0.00048+0.0009*sev+0.022*this.f('coolant_loss')),0,1);
    this.deg.ignition  =clamp(this.deg.ignition  +hrs*(0.00072+0.0011*sev+0.040*this.f('plug_foul')),0,1);
    this.deg.injectors =clamp(this.deg.injectors +hrs*(0.00065+0.0010*sev+0.038*this.f('injector')),0,1);
    this.deg.oil       =clamp(this.deg.oil       +hrs*(0.0068 +0.0090*sev+0.015*Math.max(0,s.oilT-115)/20),0,1);
    this.deg.filter    =clamp(this.deg.filter    +hrs*(0.0030 +0.0040*sev+0.050*this.f('filter')),0,1);
    return s;
  }
}
