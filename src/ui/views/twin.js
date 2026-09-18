import { clamp, fmt, el, $ } from '../../core/util.js';
import { S, engine } from '../../core/store.js';
import { panel, kv, bar } from '../components/panel.js';
import { cssv } from '../components/style.js';
import { newChart } from '../components/TimeChart.js';
import { VIEWS } from './registry.js';


const TWIN_ROWS=[
 ['rpm','Crankshaft speed','RPM',0],['map','Manifold pressure','inHg',2],
 ['boost','Turbo boost','inHg',2],['dp','Filter differential pressure','kPa',2],['iat','Intake air temp','\u00B0C',1],
 ['powerHp','Shaft power','hp',1],['ff','Fuel flow','L/h',2],
 ['fuelP','Fuel pressure','bar',3],['oilP','Oil pressure','bar',2],
 ['oilT','Oil temperature','\u00B0C',1],['cltT','Coolant temperature','\u00B0C',1],
 ['vib1','Vibration 1x order','mm/s',2],['vib2','Vibration 2x order','mm/s',2],
 ['volt','Bus voltage','V',2],['amp','Charge current','A',1],['tas','True airspeed','kt',0]
];
const RES_TOL={rpm:60,map:1.2,boost:1.0,dp:0.6,iat:6,powerHp:5,ff:2,fuelP:.04,oilP:.35,
  oilT:7,cltT:6,vib1:1.1,vib2:1.0,volt:.6,amp:6,tas:6};

VIEWS.twin={
  layer:'05', nav:'Digital twin', title:'Digital twin core',
  desc:'A calibrated model of a healthy engine of this type is run in lock-step at the same commanded operating point. The difference between what the sensors report and what the twin expects is the residual — the raw material for every layer above this one.',
  build(){
    const root=el('div','grid g-2-1');
    const tbl=panel('Measured against twin expectation','RESIDUAL = MEASURED \u2212 TWIN');
    tbl.body.className='panel-body tight';
    const wrap=el('div','tbl-wrap');
    const t=el('table');
    t.innerHTML='<thead><tr><th>Parameter</th><th class="num">Measured</th><th class="num">Twin</th><th class="num">Residual</th><th style="width:110px">Deviation</th></tr></thead>';
    const tb=el('tbody');this.rows={};
    TWIN_ROWS.forEach(([k,name,unit,dp])=>{
      const tr=el('tr');
      tr.innerHTML=`<td>${name} <span class="dimmer mono" style="font-size:10px">${unit}</span></td>
        <td class="num" data-m></td><td class="num twinc" data-e></td><td class="num" data-r></td>
        <td><div class="bar"><span></span></div></td>`;
      tb.appendChild(tr);
      this.rows[k]={m:tr.querySelector('[data-m]'),e:tr.querySelector('[data-e]'),
        r:tr.querySelector('[data-r]'),b:tr.querySelector('.bar>span'),dp};
    });
    t.appendChild(tb);wrap.appendChild(t);tbl.body.appendChild(wrap);
    root.appendChild(tbl);

    const side=el('div','grid');
    const sy=panel('Twin synchronisation','MODEL STATE');
    this.kSync=kv('Tracking quality','\u2014');
    this.kNorm=kv('Residual L2 norm','\u2014');
    this.kWorst=kv('Largest deviation','\u2014');
    this.kStep=kv('Integration step','100 ms');
    this.kWear=kv('Wear states tracked','8');
    [this.kSync,this.kNorm,this.kWorst,this.kStep,this.kWear].forEach(x=>sy.body.appendChild(x));
    sy.body.appendChild(el('div','sep'));
    sy.body.appendChild(el('p','hint','The twin is deliberately not told about wear or injected faults. It only receives throttle, altitude and outside air temperature, exactly as the real flight-control computer would publish them.'));
    side.appendChild(sy);

    const cw=panel('Wear state estimate','TWIN INTERNAL');
    this.wearBars={};
    ['rings','bearings','turbo','cooling','ignition','injectors','oil','filter'].forEach(k=>{
      const b=bar({rings:'Piston rings & bore',bearings:'Bearings',turbo:'Turbocharger',
        cooling:'Cooling system',ignition:'Ignition',injectors:'Injectors',
        oil:'Oil charge',filter:'Air filter'}[k],0);
      b.style.marginBottom='9px';this.wearBars[k]=b;cw.body.appendChild(b);
    });
    side.appendChild(cw);
    root.appendChild(side);

    const c=panel('Residual traces','KEY CHANNELS');
    c.body.className='panel-body tight';
    this.ch=newChart({height:170,window:180,series:[
      {key:'a',color:cssv('--caution'),label:'Coolant residual, \u00B0C'},
      {key:'b',color:cssv('--info'),label:'Oil pressure residual, bar \u00D710'},
      {key:'c',color:cssv('--twin'),label:'MAP residual, inHg'},
      {key:'d',color:cssv('--warn'),label:'Vibration residual, mm/s'}]});
    this.ch.mount(c.body);
    c.className+=' span2';
    root.appendChild(c);
    return root;
  },
  update(S){
    const m=S.sensors,e=S.twin,r=S.resid;
    let worst={k:null,v:0},acc=0;
    TWIN_ROWS.forEach(([k])=>{
      const row=this.rows[k];
      row.m.textContent=fmt(m[k],row.dp);
      row.e.textContent=fmt(e[k],row.dp);
      const res=r[k], tol=RES_TOL[k]||1;
      const ratio=Math.abs(res)/tol; acc+=ratio*ratio;
      row.r.textContent=(res>=0?'+':'')+fmt(res,row.dp);
      row.r.className='num '+(ratio>2?'wrn':ratio>1?'cau':'dim');
      row.b.style.width=clamp(ratio/3*100,0,100)+'%';
      row.b.style.background=ratio>2?cssv('--warn'):ratio>1?cssv('--caution'):cssv('--nominal');
      if(ratio>worst.v)worst={k,v:ratio,name:TWIN_ROWS.find(x=>x[0]===k)[1]};
    });
    const norm=Math.sqrt(acc/TWIN_ROWS.length);
    this.kNorm.val.textContent=fmt(norm,3);
    this.kNorm.val.className='v mono '+(norm>1.4?'wrn':norm>0.8?'cau':'nom');
    const q=clamp(100-norm*38,0,100);
    this.kSync.val.textContent=fmt(q,1)+' %';
    this.kSync.val.className='v mono '+(q>70?'nom':q>45?'cau':'wrn');
    this.kWorst.val.textContent=worst.k?`${worst.name} \u00D7${fmt(worst.v,2)}`:'\u2014';
    this.kWorst.val.className='v mono '+(worst.v>2?'wrn':worst.v>1?'cau':'dim');
    for(const k in this.wearBars){
      const d=S.eng.deg[k]*100;
      this.wearBars[k].set(d,d>80?cssv('--warn'):d>55?cssv('--caution'):cssv('--twin'));
    }
    this.ch.push(S.t,[r.cltT,r.oilP*10,r.map,r.vibRms]);
  },
  seed(S){this.ch.clear();S.rec.buf.slice(-180).forEach(f=>{
    this.ch.push(f.t,[f.m.cltT-f.e.cltT,(f.m.oilP-f.e.oilP)*10,f.m.map-f.e.map,null]);});}
};
