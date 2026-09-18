import { gauss } from '../core/util.js';


/* Everything downstream sees only this. Adds noise, quantisation, lag
   and sensor-level faults so the twin never gets the truth for free.   */
export class SensorLayer{
  constructor(){this.bias={cht2:0};}
  read(truth,faults){
    const q=(v,step)=>Math.round(v/step)*step;
    const drift=faults.sensor_drift.sev;
    return {
      rpm:q(truth.rpm+gauss(4.2),5),
      map:truth.map+gauss(0.07),
      iat:truth.iat+gauss(0.35),
      boost:Math.max(0,truth.boost+gauss(0.05)),
      egt:truth.egt.map(v=>q(v+gauss(3.1),1)),
      cht:truth.cht.map((v,i)=>q(v+gauss(0.45)+(i===2?38*drift:0),0.5)),
      oilP:Math.max(0,truth.oilP+gauss(0.022)),
      oilT:truth.oilT+gauss(0.22),
      cltT:truth.cltT+gauss(0.22),
      ff:Math.max(0,truth.ff+gauss(0.22)),
      fuelP:Math.max(0,truth.fuelP+gauss(0.006)),
      vib1:Math.max(0,truth.vib1+gauss(0.09)),
      vib2:Math.max(0,truth.vib2+gauss(0.09)),
      vibRms:Math.max(0,truth.vibRms+gauss(0.11)),
      dp:Math.max(0,truth.dp+gauss(0.035)),
      volt:truth.volt+gauss(0.02),
      amp:truth.amp+gauss(0.18),
      powerHp:truth.powerHp,tas:truth.tas,
      fuelKg:truth.fuelKg,oilL:truth.oilL,cltL:truth.cltL,cyclePk:truth.cyclePk
    };
  }
}
