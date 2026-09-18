import { fmt, hhmmss } from '../core/util.js';
import { PROFILES } from './profiles.js';


export class Reporting{
  build(S){
    const d=new Date(), pad=n=>String(n).padStart(2,'0');
    const stamp=`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}Z`;
    const rul=Object.entries(S.ml.rul).filter(([k])=>k!=='__overall').map(([k,v])=>v).sort((a,b)=>a.rul-b.rul);
    const alarms=S.rec.events.filter(e=>e.sev>0);
    const top=S.ml.cls[0];
    const actions=[];
    rul.forEach(c=>{ if(c.rul<25) actions.push(`Replace or overhaul ${c.name.toLowerCase()} within ${fmt(c.rul,0)} engine hours (lower bound ${fmt(c.lo,0)} h).`); });
    S.diag.fired.filter(f=>f.sev===2).forEach(f=>actions.push(`Rectify before next sortie: ${f.txt} (${f.id}, ${f.sys}).`));
    if(top&&top.id!=='nominal'&&top.p>0.5) actions.push(`Inspect ${top.sys.toLowerCase()} for ${top.name.toLowerCase()} — classifier confidence ${(top.p*100).toFixed(0)}%.`);
    if(S.eng.deg.oil>0.7) actions.push('Oil and filter change due: oil charge is past 70% of service life.');
    if(!actions.length) actions.push('No maintenance action required. Continue scheduled inspection interval.');
    return {stamp,rul,alarms,actions,top,
      summary:{met:S.t,profile:PROFILES[S.profile].name,phase:S.phase,hours:S.eng.hours,
        starts:S.eng.starts,fuelUsed:62-S.sensors.fuelKg,health:S.health.overall,
        anomaly:S.ml.anomalyEma,peakCht:S.peak.cht,peakEgt:S.peak.egt,peakVib:S.peak.vib,
        maxPower:S.peak.power}};
  }
  asText(R,S){
    const L=[];
    L.push('AETHER-DT MISSION & ENGINE HEALTH REPORT');
    L.push('Asset: UAV-04 "KESTREL" / Engine S/N 914F-2207-18');
    L.push('Generated: '+R.stamp);
    L.push('');
    L.push('1. MISSION SUMMARY');
    L.push(`   Profile ................. ${R.summary.profile}`);
    L.push(`   Elapsed time ............ ${hhmmss(R.summary.met)}`);
    L.push(`   Final phase ............. ${R.summary.phase}`);
    L.push(`   Engine hours (TSO) ...... ${fmt(R.summary.hours,1)} h`);
    L.push(`   Fuel consumed ........... ${fmt(R.summary.fuelUsed,1)} kg`);
    L.push(`   Peak CHT / EGT .......... ${fmt(R.summary.peakCht,0)} C / ${fmt(R.summary.peakEgt,0)} C`);
    L.push(`   Peak vibration .......... ${fmt(R.summary.peakVib,2)} mm/s RMS`);
    L.push(`   Peak shaft power ........ ${fmt(R.summary.maxPower,1)} hp`);
    L.push('');
    L.push('2. HEALTH ASSESSMENT');
    L.push(`   Overall condition index . ${fmt(R.summary.health,1)} / 100`);
    Object.values(S.health.subsystems).forEach(s=>L.push(`   ${(s.name+' ').padEnd(24,'.')} ${fmt(s.value,1)}`));
    L.push('');
    L.push('3. AI/ML DIAGNOSIS');
    L.push(`   Anomaly score ........... ${fmt(R.summary.anomaly,3)} (threshold 0.380)`);
    L.push(`   Most likely mode ........ ${R.top?R.top.name:'n/a'} (${R.top?(R.top.p*100).toFixed(1):'0'}%)`);
    L.push('');
    L.push('4. REMAINING USEFUL LIFE');
    R.rul.forEach(c=>L.push(`   ${(c.name+' ').padEnd(26,'.')} ${fmt(c.rul,0).padStart(5)} h  [${fmt(c.lo,0)}-${fmt(c.hi,0)}]  wear ${(c.deg*100).toFixed(0)}%`));
    L.push('');
    L.push('5. EVENT LOG ('+R.alarms.length+' entries)');
    R.alarms.slice(-40).forEach(e=>L.push(`   ${hhmmss(e.t)}  ${e.sev===2?'WARN':'CAUT'}  ${e.txt}`));
    if(!R.alarms.length)L.push('   No cautions or warnings recorded.');
    L.push('');
    L.push('6. RECOMMENDED ACTIONS');
    R.actions.forEach((a,i)=>L.push(`   ${i+1}. ${a}`));
    L.push('');
    L.push('-- end of report --');
    return L.join('\n');
  }
  asCsv(rec){
    const hdr=['t_s','phase','rpm','map_inHg','egt1','egt2','egt3','egt4','cht1','cht2','cht3','cht4',
      'oilP_bar','oilT_C','cltT_C','ff_Lph','fuelP_bar','vib_mms','volt','power_hp','anomaly','health'];
    const rows=rec.buf.map(f=>[f.t.toFixed(0),f.phase,f.m.rpm.toFixed(0),f.m.map.toFixed(2),
      ...f.m.egt.map(v=>v.toFixed(0)),...f.m.cht.map(v=>v.toFixed(1)),
      f.m.oilP.toFixed(2),f.m.oilT.toFixed(1),f.m.cltT.toFixed(1),f.m.ff.toFixed(2),
      f.m.fuelP.toFixed(3),f.m.vibRms.toFixed(2),f.m.volt.toFixed(2),f.m.powerHp.toFixed(1),
      f.anom.toFixed(3),f.health.toFixed(1)].join(','));
    return [hdr.join(',')].concat(rows).join('\n');
  }
}
