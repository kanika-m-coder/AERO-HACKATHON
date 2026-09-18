import { fmt, hhmmss, el, $ } from '../../core/util.js';
import { S, engine, reporting, recorder } from '../../core/store.js';
import { panel } from '../components/panel.js';
import { cssv, healthColor } from '../components/style.js';
import { toast } from '../components/toast.js';
import { VIEWS } from './registry.js';


VIEWS.reports={
  layer:'10', nav:'Reports', title:'Reporting',
  desc:'Everything the other layers produced, consolidated into a maintenance-ready document. Reports are generated from the recorder, not from the live frame, so a report is reproducible from the same flight data.',
  build(){
    const root=el('div','grid');
    const ctl=panel('Generate','MISSION & MAINTENANCE');
    const row=el('div');row.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
    const bGen=el('button','btn primary','Generate report');
    const bCopy=el('button','btn','Copy report text');
    const bCsv=el('button','btn','Copy telemetry CSV');
    const bPrint=el('button','btn','Print');
    [bGen,bCopy,bCsv,bPrint].forEach(x=>row.appendChild(x));
    ctl.body.appendChild(row);
    ctl.body.appendChild(el('div','hint','The report reflects the recorder contents at the moment you generate it. Copy puts it on the clipboard as plain text, ready to paste into a maintenance record.'));
    root.appendChild(ctl);

    const out=panel('Report preview','');
    this.out=el('div','report');
    this.out.innerHTML='<p class="dim">No report generated yet. Fly some of the mission, then generate a report to see the consolidated assessment.</p>';
    out.body.className='panel-body tight';
    out.body.appendChild(this.out);
    root.appendChild(out);

    bGen.onclick=()=>{this.R=reporting.build(S);this.renderReport();toast('Report generated');};
    bCopy.onclick=async()=>{ if(!this.R){toast('Generate a report first');return;}
      try{await navigator.clipboard.writeText(reporting.asText(this.R,S));toast('Report copied');}
      catch(e){toast('Clipboard unavailable in this context');}};
    bCsv.onclick=async()=>{ if(!S.rec.buf.length){toast('Recorder is empty');return;}
      try{await navigator.clipboard.writeText(reporting.asCsv(S.rec));toast(S.rec.buf.length+' frames copied as CSV');}
      catch(e){toast('Clipboard unavailable in this context');}};
    bPrint.onclick=()=>window.print();
    return root;
  },
  renderReport(){
    const R=this.R,s=R.summary;
    const h=[];
    h.push(`<h3>Mission and engine health report</h3>
      <p class="mono dimmer" style="font-size:11px">UAV-04 "KESTREL" \u00B7 ENGINE S/N 914F-2207-18 \u00B7 GENERATED ${R.stamp}</p>`);
    h.push('<h4>Mission summary</h4>');
    h.push(`<table><tbody>
      <tr><td>Profile</td><td class="num">${s.profile}</td></tr>
      <tr><td>Elapsed time</td><td class="num">${hhmmss(s.met)}</td></tr>
      <tr><td>Final phase</td><td class="num">${s.phase}</td></tr>
      <tr><td>Engine hours since overhaul</td><td class="num">${fmt(s.hours,2)} h</td></tr>
      <tr><td>Fuel consumed</td><td class="num">${fmt(s.fuelUsed,1)} kg</td></tr>
      <tr><td>Peak CHT / EGT</td><td class="num">${fmt(s.peakCht,0)} / ${fmt(s.peakEgt,0)} \u00B0C</td></tr>
      <tr><td>Peak vibration</td><td class="num">${fmt(s.peakVib,2)} mm/s RMS</td></tr>
      <tr><td>Peak shaft power</td><td class="num">${fmt(s.maxPower,1)} hp</td></tr></tbody></table>`);
    h.push('<h4>Health assessment</h4>');
    h.push(`<p>Overall condition index <strong style="color:${healthColor(s.health)}">${fmt(s.health,1)} / 100</strong>. Subsystem breakdown:</p>`);
    h.push('<table><tbody>'+Object.values(S.health.subsystems).map(x=>
      `<tr><td>${x.name}</td><td class="num" style="color:${healthColor(x.value)}">${fmt(x.value,1)}</td></tr>`).join('')+'</tbody></table>');
    h.push('<h4>Machine-learning diagnosis</h4>');
    h.push(`<p>Anomaly score ${fmt(s.anomaly,3)} against a decision threshold of 0.380 \u2014 ${s.anomaly>0.38?'<span class="wrn">anomaly declared</span>':'within the nominal manifold'}. Most likely mode: <strong>${R.top?R.top.name:'none'}</strong> at ${R.top?(R.top.p*100).toFixed(1):'0'}% confidence.</p>`);
    h.push('<h4>Remaining useful life</h4>');
    h.push('<table><thead><tr><th>Component</th><th class="num">Wear</th><th class="num">RUL</th><th class="num">90% interval</th></tr></thead><tbody>'+
      R.rul.map(c=>`<tr><td>${c.name}</td><td class="num">${(c.deg*100).toFixed(0)}%</td>
        <td class="num" style="color:${c.rul<25?cssv('--warn'):c.rul<80?cssv('--caution'):cssv('--nominal')}">${fmt(c.rul,0)} h</td>
        <td class="num dimmer">${fmt(c.lo,0)} \u2013 ${fmt(c.hi,0)} h</td></tr>`).join('')+'</tbody></table>');
    h.push(`<h4>Event log (${R.alarms.length} cautions and warnings)</h4>`);
    h.push(R.alarms.length?'<table><tbody>'+R.alarms.slice(-25).reverse().map(e=>
      `<tr><td class="mono dimmer" style="width:74px">${hhmmss(e.t)}</td>
       <td class="${e.sev===2?'wrn':'cau'}" style="width:60px">${e.sev===2?'WARNING':'CAUTION'}</td>
       <td>${e.txt}</td></tr>`).join('')+'</tbody></table>'
      :'<p>No cautions or warnings were recorded during this mission.</p>');
    h.push('<h4>Recommended actions</h4>');
    h.push('<ul>'+R.actions.map(a=>`<li>${a}</li>`).join('')+'</ul>');
    this.out.innerHTML=h.join('');
  },
  update(){},
  seed(){}
};
