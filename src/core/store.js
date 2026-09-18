import { clamp, lerp } from './util.js';
import { bus } from './EventBus.js';
import { EngineModel } from '../backend/EngineModel.js';
import { SensorLayer } from '../backend/SensorLayer.js';
import { DigitalTwin } from '../backend/DigitalTwin.js';
import { Diagnostics } from '../backend/Diagnostics.js';
import { MLService } from '../backend/MLService.js';
import { HealthMonitor } from '../backend/HealthMonitor.js';
import { Recorder } from '../backend/Recorder.js';
import { Reporting } from '../backend/Reporting.js';
import { PROFILES } from '../backend/profiles.js';


/* Single source of truth. Owns the tick loop and orchestrates every
   backend service in a fixed, documented order.                        */
export const S={
  t:0,running:true,armed:true,speed:1,mode:'auto',profile:'ISR',phase:'TAXI',
  cmd:{throttle:0.16,alt:0,oat:24,running:true},
  eng:null,sensors:null,twin:null,resid:null,health:null,diag:{fired:[]},ml:{},
  rec:null,peak:{cht:0,egt:0,vib:0,power:0},alarms:[],
  replay:{mode:false,t:0,playing:false},
  seg:0,segT:0
};
export const engine      = new EngineModel();
export const sensorLayer = new SensorLayer();
export const twin        = new DigitalTwin();
export const diagnostics = new Diagnostics();
export const ml          = new MLService();
export const health      = new HealthMonitor();
export const recorder    = new Recorder();
export const reporting   = new Reporting();
S.eng=engine; S.rec=recorder;

export function missionStep(dt){
  const segs=PROFILES[S.profile].segs;
  if(S.mode!=='auto')return;
  S.segT+=dt;
  const cur=segs[Math.min(S.seg,segs.length-1)];
  if(S.segT>=cur.d){
    if(S.seg<segs.length-1){S.seg++;}
    else{S.seg=0;S.eng.starts++;
      pushEvent({type:'info',sev:0,txt:'Profile complete \u2014 next sortie begins',sys:'Mission',t:S.t});}
    S.segT=0;
    pushEvent({type:'phase',sev:0,txt:'Phase change \u2192 '+segs[S.seg].ph,sys:'Mission',t:S.t});}
  const seg=segs[Math.min(S.seg,segs.length-1)];
  S.phase=seg.ph;
  const k=1-Math.exp(-dt/(seg.ph==='TAKEOFF'?2:6));
  S.cmd.throttle=lerp(S.cmd.throttle,seg.th,k);
  S.cmd.alt=lerp(S.cmd.alt,seg.alt,1-Math.exp(-dt/45));
  S.cmd.running=!(seg.ph==='SHUTDOWN');
}
export function pushEvent(e){
  S.alarms.unshift(e); if(S.alarms.length>300)S.alarms.pop();
  recorder.event(e);
  if(e.sev>0) bus.emit('alarm',e);
}

export function tick(dt){
  if(S.replay.mode) return;
  S.t+=dt;
  missionStep(dt);
  engine.running=S.cmd.running&&S.armed;
  const truth=engine.step(dt,S.cmd);
  const m=sensorLayer.read(truth,engine.faults);
  const e=twin.expect({...S.cmd,running:engine.running},dt,m.tas);
  const r=twin.residuals(m,e);
  const {fired,events}=diagnostics.run(m,r,S.t);
  events.forEach(pushEvent);
  const h=health.compute(r,engine.deg,fired);
  const mlOut=ml.infer(m,r,engine.deg,engine.hours,dt,fired);

  S.sensors=m;S.twin=e;S.resid=r;S.diag={fired};S.health=h;S.ml=mlOut;
  S.peak.cht=Math.max(S.peak.cht,Math.max(...m.cht));
  S.peak.egt=Math.max(S.peak.egt,Math.max(...m.egt));
  S.peak.vib=Math.max(S.peak.vib,m.vibRms);
  S.peak.power=Math.max(S.peak.power,m.powerHp);

  recorder.tick(dt,{t:S.t,phase:S.phase,m:{rpm:m.rpm,map:m.map,egt:[...m.egt],cht:[...m.cht],
    oilP:m.oilP,oilT:m.oilT,cltT:m.cltT,ff:m.ff,fuelP:m.fuelP,vibRms:m.vibRms,vib1:m.vib1,vib2:m.vib2,
    volt:m.volt,powerHp:m.powerHp,tas:m.tas,iat:m.iat,fuelKg:m.fuelKg},
    e:{rpm:e.rpm,map:e.map,cltT:e.cltT,oilP:e.oilP,powerHp:e.powerHp,egt:[...e.egt],cht:[...e.cht]},
    anom:mlOut.anomalyEma,health:h.overall,throttle:S.cmd.throttle,alt:S.cmd.alt,
    rules:fired.map(f=>f.id)});
  bus.emit('tick',S);
}

export function resetAll(){
  engine.reset();twin.e=null;diagnostics.reset();ml.reset();health.reset();recorder.reset();
  S.t=0;S.seg=0;S.segT=0;S.phase=PROFILES[S.profile].segs[0].ph;
  S.cmd={throttle:0.16,alt:0,oat:24,running:true};
  S.peak={cht:0,egt:0,vib:0,power:0};S.alarms=[];S.replay={mode:false,t:0,playing:false};
  pushEvent({type:'info',sev:0,txt:'System reset \u2014 '+PROFILES[S.profile].name,sys:'Mission',t:0});
  bus.emit('reset');
}
