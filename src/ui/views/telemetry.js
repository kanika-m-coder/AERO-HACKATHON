import { gauss, fmt, hhmmss, el, $ } from '../../core/util.js';
import { sevOf } from '../../backend/limits.js';
import { S } from '../../core/store.js';
import { panel, kv, bar } from '../components/panel.js';
import { cssv, sevClass } from '../components/style.js';
import { newChart } from '../components/TimeChart.js';
import { VIEWS } from './registry.js';


VIEWS.telemetry={
  layer:'02', nav:'Telemetry', title:'Real-time telemetry',
  desc:'The raw sensor bus at 10 Hz: 31 channels sampled, quantised and noise-affected exactly as a real data-acquisition unit would deliver them over the downlink.',
  build(){
    const root=el('div','grid g2');
    const cy=panel('Per-cylinder combustion','4 \u00D7 EGT / CHT / PEAK PRESSURE');
    const g=el('div','cylgrid');this.cyl=[];
    for(let i=0;i<4;i++){
      const c=el('div','cyl');
      c.innerHTML=`<h5>CYL ${i+1}</h5>
        <div class="big" data-egt>--</div><div class="sm">EGT \u00B0C</div>
        <div class="big" data-cht style="margin-top:6px">--</div><div class="sm">CHT \u00B0C</div>
        <div class="sm" data-pk style="margin-top:6px">Pmax --</div>`;
      g.appendChild(c);
      this.cyl.push({egt:c.querySelector('[data-egt]'),cht:c.querySelector('[data-cht]'),pk:c.querySelector('[data-pk]')});
    }
    cy.body.appendChild(g);
    this.kSpread=kv('EGT spread','\u2014');this.kCspread=kv('CHT spread','\u2014');
    cy.body.appendChild(el('div','sep'));
    cy.body.appendChild(this.kSpread);cy.body.appendChild(this.kCspread);
    root.appendChild(cy);

    const bus_=panel('Downlink status','TELEMETRY LINK');
    this.kRate=kv('Sample rate','10.0 Hz');
    this.kCh=kv('Active channels','32 / 32');
    this.kLat=kv('Link latency','\u2014');
    this.kLoss=kv('Packet loss','0.00 %');
    this.kRec=kv('Recorder depth','\u2014');
    this.kFrames=kv('Frames captured','0');
    [this.kRate,this.kCh,this.kLat,this.kLoss,this.kRec,this.kFrames].forEach(x=>bus_.body.appendChild(x));
    root.appendChild(bus_);

    const ce=panel('Exhaust gas temperature','PER CYLINDER');
    ce.body.className='panel-body tight';
    const cols=[cssv('--nominal'),cssv('--caution'),cssv('--warn'),cssv('--info')];
    this.chE=newChart({height:160,window:120,series:[0,1,2,3].map(i=>({key:'e'+i,color:cols[i],label:'Cyl '+(i+1)}))});
    this.chE.mount(ce.body);root.appendChild(ce);

    const cc=panel('Cylinder head temperature','PER CYLINDER');
    cc.body.className='panel-body tight';
    this.chC=newChart({height:160,window:120,series:[0,1,2,3].map(i=>({key:'c'+i,color:cols[i],label:'Cyl '+(i+1)}))});
    this.chC.mount(cc.body);root.appendChild(cc);

    const cv=panel('Vibration orders','1x / 2x / BROADBAND');
    cv.body.className='panel-body tight';
    this.chV=newChart({height:150,window:120,min:0,series:[
      {key:'1',color:cssv('--nominal'),label:'1x order'},
      {key:'2',color:cssv('--warn'),label:'2x order'},
      {key:'r',color:cssv('--ink-2'),label:'RMS'}]});
    this.chV.mount(cv.body);root.appendChild(cv);

    const cf=panel('Fluids & electrical','OIL / FUEL / BUS');
    cf.body.className='panel-body tight';
    this.chF=newChart({height:150,window:120,series:[
      {key:'op',color:cssv('--info'),label:'Oil pressure, bar'},
      {key:'fp',color:cssv('--caution'),label:'Fuel pressure, bar \u00D75'},
      {key:'v',color:cssv('--twin'),label:'Bus voltage, V \u00F72'}]});
    this.chF.mount(cf.body);root.appendChild(cf);

    const all=panel('All channels','RAW BUS');
    all.body.className='panel-body tight';
    const w=el('div','tbl-wrap');this.allTbl=el('table');w.appendChild(this.allTbl);all.body.appendChild(w);
    all.className+=' span2';root.appendChild(all);
    return root;
  },
  update(S){
    const m=S.sensors;
    for(let i=0;i<4;i++){
      this.cyl[i].egt.textContent=m.egt[i].toFixed(0);
      this.cyl[i].egt.className='big '+sevClass(sevOf('egt',m.egt[i]));
      this.cyl[i].cht.textContent=m.cht[i].toFixed(1);
      this.cyl[i].cht.className='big '+sevClass(sevOf('cht',m.cht[i]));
      this.cyl[i].pk.textContent='Pmax '+m.cyclePk[i].toFixed(0)+' bar';
    }
    const es=Math.max(...m.egt)-Math.min(...m.egt), cs=Math.max(...m.cht)-Math.min(...m.cht);
    this.kSpread.val.textContent=fmt(es,0)+' \u00B0C';
    this.kSpread.val.className='v mono '+(es>150?'wrn':es>90?'cau':'nom');
    this.kCspread.val.textContent=fmt(cs,1)+' \u00B0C';
    this.kCspread.val.className='v mono '+(cs>30?'cau':'nom');
    this.kLat.val.textContent=fmt(118+gauss(6),0)+' ms';
    this.kRec.val.textContent=hhmmss(S.rec.duration);
    this.kFrames.val.textContent=S.rec.buf.length.toLocaleString();
    this.kLoss.val.textContent=fmt(Math.max(0,gauss(0.03)+0.04),2)+' %';

    this.chE.push(S.t,m.egt);
    this.chC.push(S.t,m.cht);
    this.chV.push(S.t,[m.vib1,m.vib2,m.vibRms]);
    this.chF.push(S.t,[m.oilP,m.fuelP*5,m.volt/2]);

    if(!this._t||performance.now()-this._t>400){
      this._t=performance.now();
      const rows=[
        ['ENG-RPM','Crankshaft speed',m.rpm,0,'RPM','rpm'],
        ['IND-MAP','Manifold abs. pressure',m.map,2,'inHg','map'],
        ['IND-BST','Turbo boost',m.boost,2,'inHg',null],
        ['IND-IAT','Intake air temperature',m.iat,1,'\u00B0C','iat'],
        ['IND-DPF','Filter differential pressure',m.dp,2,'kPa',null],
        ['CMB-EG1','EGT cylinder 1',m.egt[0],0,'\u00B0C','egt'],
        ['CMB-EG2','EGT cylinder 2',m.egt[1],0,'\u00B0C','egt'],
        ['CMB-EG3','EGT cylinder 3',m.egt[2],0,'\u00B0C','egt'],
        ['CMB-EG4','EGT cylinder 4',m.egt[3],0,'\u00B0C','egt'],
        ['CMB-CH1','CHT cylinder 1',m.cht[0],1,'\u00B0C','cht'],
        ['CMB-CH2','CHT cylinder 2',m.cht[1],1,'\u00B0C','cht'],
        ['CMB-CH3','CHT cylinder 3',m.cht[2],1,'\u00B0C','cht'],
        ['CMB-CH4','CHT cylinder 4',m.cht[3],1,'\u00B0C','cht'],
        ['LUB-OIP','Oil pressure',m.oilP,2,'bar','oilP'],
        ['LUB-OIT','Oil temperature',m.oilT,1,'\u00B0C','oilT'],
        ['LUB-QTY','Oil quantity',m.oilL,2,'L',null],
        ['CLG-CLT','Coolant temperature',m.cltT,1,'\u00B0C','cltT'],
        ['CLG-QTY','Coolant quantity',m.cltL,2,'L',null],
        ['FUE-FLW','Fuel flow',m.ff,2,'L/h','ff'],
        ['FUE-PRS','Fuel pressure',m.fuelP,3,'bar','fuelP'],
        ['FUE-QTY','Fuel remaining',m.fuelKg,1,'kg',null],
        ['MEC-VB1','Vibration 1x order',m.vib1,2,'mm/s',null],
        ['MEC-VB2','Vibration 2x order',m.vib2,2,'mm/s',null],
        ['MEC-VBR','Vibration broadband',m.vibRms,2,'mm/s','vib'],
        ['ELE-VLT','Bus voltage',m.volt,2,'V','volt'],
        ['ELE-AMP','Charge current',m.amp,1,'A',null],
        ['PWR-SHP','Shaft power',m.powerHp,1,'hp',null],
        ['AIR-TAS','True airspeed',m.tas,0,'kt',null],
        ['AIR-ALT','Pressure altitude',S.cmd.alt,0,'ft',null],
        ['AIR-OAT','Outside air temperature',S.cmd.oat-1.98*(S.cmd.alt/1000),1,'\u00B0C',null],
        ['CTL-THR','Throttle command',S.cmd.throttle*100,1,'%',null],
        ['SYS-MET','Mission elapsed time',S.t,0,'s',null]];
      this.allTbl.innerHTML='<thead><tr><th>Channel</th><th>Description</th><th class="num">Value</th><th>Unit</th><th>State</th></tr></thead><tbody>'+
        rows.map(([id,d,v,dp,u,lk])=>{
          const s=lk?sevOf(lk,v):0;
          return `<tr><td class="mono dimmer">${id}</td><td>${d}</td><td class="num">${fmt(v,dp)}</td>
          <td class="dimmer mono" style="font-size:11px">${u}</td>
          <td><span class="pill ${sevClass(s)}">${s===2?'WARN':s===1?'CAUT':'OK'}</span></td></tr>`;}).join('')+'</tbody>';
    }
  },
  seed(S){[this.chE,this.chC,this.chV,this.chF].forEach(c=>c.clear());
    S.rec.buf.slice(-120).forEach(f=>{this.chE.push(f.t,f.m.egt);this.chC.push(f.t,f.m.cht);
      this.chV.push(f.t,[f.m.vib1,f.m.vib2,f.m.vibRms]);
      this.chF.push(f.t,[f.m.oilP,f.m.fuelP*5,f.m.volt/2]);});}
};
