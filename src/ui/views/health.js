import { clamp, fmt, hhmmss, el, $ } from '../../core/util.js';
import { LIMITS, sevOf } from '../../backend/limits.js';
import { SUBSYS } from '../../backend/HealthMonitor.js';
import { S } from '../../core/store.js';
import { panel, kv, bar } from '../components/panel.js';
import { cssv, healthColor, sevClass } from '../components/style.js';
import { newChart } from '../components/TimeChart.js';
import { VIEWS } from './registry.js';
import { evaluateEngineRange } from '../../backend/engineRange.js';


VIEWS.health={
  layer:'04', nav:'Engine health', title:'Engine health monitoring',
  desc:'Each subsystem carries a condition index that blends accumulated wear, residual energy against the twin, and any latched limit exceedance. Margins below show how close each parameter is sitting to its published limit.',
  build(){
    const root=el('div','grid g-1-2');
    const ov=panel('Condition indices','0 \u2013 100');
    this.big=el('div');this.big.style.cssText='font-family:var(--mono);font-size:44px;font-weight:600;line-height:1';
    ov.body.appendChild(this.big);
    this.bigSub=el('div','dim');this.bigSub.style.cssText='font-size:12px;margin:2px 0 14px';
    ov.body.appendChild(this.bigSub);
    this.sysBars={};
    SUBSYS.forEach(s=>{const b=bar(s.name,100);b.style.marginBottom='10px';this.sysBars[s.id]=b;ov.body.appendChild(b);});
    root.appendChild(ov);

    const mg=panel('Limit margins','MEASURED vs PUBLISHED LIMIT');
    mg.body.className='panel-body tight';
    const w=el('div','tbl-wrap');this.mgTbl=el('table');w.appendChild(this.mgTbl);mg.body.appendChild(w);
    root.appendChild(mg);

    const tr=panel('Condition trend','ROLLING 10 MIN');
    tr.body.className='panel-body tight';
    this.ch=newChart({height:160,window:600,min:0,max:105,series:[
      {key:'o',color:cssv('--nominal'),label:'Overall index'},
      {key:'w',color:cssv('--caution'),label:'Weakest subsystem'}]});
    this.ch.mount(tr.body);
    tr.className+=' span2';root.appendChild(tr);

    const ex=panel('Cumulative exposure','SINCE OVERHAUL');
    this.kHrs=kv('Engine hours (TSO)','\u2014');
    this.kStarts=kv('Starts','\u2014');
    this.kHot=kv('Time above 112 \u00B0C CHT','\u2014');
    this.kHi=kv('Time above 90% power','\u2014');
    this.kCyc=kv('Thermal cycles','\u2014');
    this.kTbo=kv('TBO consumed','\u2014');
    [this.kHrs,this.kStarts,this.kHot,this.kHi,this.kCyc,this.kTbo].forEach(x=>ex.body.appendChild(x));
    root.appendChild(ex);

    const nt=panel('Interpretation','AUTOMATED');
    this.notes=el('div');nt.body.appendChild(this.notes);
    root.appendChild(nt);

    /* --- Engine Range (Engine Reference Values) Section --- */
    const rangePanel = panel('Engine Range', 'ENGINE REFERENCE VALUES');
    rangePanel.body.className = 'panel-body tight';
    const rangeWrap = el('div', 'tbl-wrap');
    this.rangeTbl = el('table');
    rangeWrap.appendChild(this.rangeTbl);
    rangePanel.body.appendChild(rangeWrap);
    rangePanel.className += ' span2';
    root.appendChild(rangePanel);

    this.hot=0;this.hi=0;
    return root;
  },
  update(S){
    this.big.textContent=fmt(S.health.overall,1);
    this.big.style.color=healthColor(S.health.overall);
    const worst=Object.values(S.health.subsystems).reduce((a,b)=>a.value<b.value?a:b);
    this.bigSub.textContent=`Overall condition index \u00B7 weakest link: ${worst.name}`;
    for(const id in this.sysBars){
      const v=S.health.subsystems[id].value;
      this.sysBars[id].set(v,healthColor(v));
    }
    const m=S.sensors;
    if(Math.max(...m.cht)>112)this.hot+=0.1*S.speed;
    if(m.powerHp>103)this.hi+=0.1*S.speed;
    this.kHrs.val.textContent=fmt(S.eng.hours,2)+' h';
    this.kStarts.val.textContent=S.eng.starts;
    this.kHot.val.textContent=hhmmss(this.hot);
    this.kHi.val.textContent=hhmmss(this.hi);
    this.kCyc.val.textContent=(S.eng.starts*2+Math.floor(S.t/600)).toLocaleString();
    const tbo=S.eng.hours/1200*100;
    this.kTbo.val.textContent=fmt(tbo,1)+' % of 1200 h';
    this.kTbo.val.className='v mono '+(tbo>85?'wrn':tbo>70?'cau':'nom');

    this.ch.push(S.t,[S.health.overall,worst.value]);

    if(!this._t||performance.now()-this._t>500){
      this._t=performance.now();
      const rows=[['rpm',m.rpm],['map',m.map],['egt',Math.max(...m.egt)],['cht',Math.max(...m.cht)],
        ['oilT',m.oilT],['oilP',m.oilP],['cltT',m.cltT],['fuelP',m.fuelP],['vib',m.vibRms],
        ['volt',m.volt],['iat',m.iat],['ff',m.ff]];
      this.mgTbl.innerHTML='<thead><tr><th>Parameter</th><th class="num">Value</th><th class="num">Caution</th><th class="num">Limit</th><th class="num">Margin</th><th style="width:96px">Usage</th></tr></thead><tbody>'+
        rows.map(([k,v])=>{
          const L=LIMITS[k],s=sevOf(k,v);
          const margin=L.inverted?v-L.red:L.red-v;
          const usage=clamp(L.inverted?(L.max-v)/(L.max-L.red)*100:v/L.red*100,0,140);
          const col=s===2?cssv('--warn'):s===1?cssv('--caution'):cssv('--nominal');
          return `<tr><td>${L.name}</td><td class="num ${sevClass(s)}">${fmt(v,2)}</td>
            <td class="num dimmer">${fmt(L.caution,2)}</td><td class="num dimmer">${fmt(L.red,2)}</td>
            <td class="num ${margin<0?'wrn':''}">${(margin>=0?'+':'')}${fmt(margin,2)}</td>
            <td><div class="bar"><span style="width:${clamp(usage,0,100)}%;background:${col}"></span></div></td></tr>`;
        }).join('')+'</tbody>';

      const n=[];
      Object.values(S.health.subsystems).forEach(s=>{
        if(s.value<60)n.push(`<p style="margin:0 0 8px"><span class="wrn">${s.name}</span> is degraded at ${fmt(s.value,0)}/100. Review the fault detection view before the next sortie.</p>`);
        else if(s.value<80)n.push(`<p style="margin:0 0 8px"><span class="cau">${s.name}</span> is drifting at ${fmt(s.value,0)}/100 and is worth watching.</p>`);
      });
      if(tbo>70)n.push('<p style="margin:0 0 8px">More than 70% of the 1200 h overhaul interval is consumed. Plan the shop visit against the limiting component in the RUL view.</p>');
      if(!n.length)n.push('<p style="margin:0" class="dim">All subsystems are above 80/100 and no exceedance is latched. Nothing requires attention at this time.</p>');
      this.notes.innerHTML=n.join('');

      /* Render Engine Range Table in Health View */
      const rangeData = evaluateEngineRange(m, S);
      if (this.rangeTbl) {
        this.rangeTbl.innerHTML = `
          <thead>
            <tr>
              <th>Detected Parameter</th>
              <th class="num">Actual Value</th>
              <th class="num">Reference Value / Range</th>
              <th class="num">Deviation</th>
              <th style="width:110px;text-align:center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rangeData.map(r => {
              const statusClass = r.status === 'HEALTHY' ? 'nom' : r.status === 'WARNING' ? 'cau' : 'wrn';
              const pillClass = r.status === 'HEALTHY' ? 'nom' : r.status === 'WARNING' ? 'cau' : 'wrn';
              return `
                <tr>
                  <td><strong>${r.param}</strong></td>
                  <td class="num mono">${r.actualStr}</td>
                  <td class="num mono dimmer">${r.refStr}</td>
                  <td class="num mono ${statusClass}">${r.devStr}</td>
                  <td style="text-align:center">
                    <span class="pill ${pillClass}" style="font-size:10px;padding:2px 8px;font-weight:700">${r.status}</span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        `;
      }
    }
  },
  seed(S){this.ch.clear();S.rec.buf.forEach(f=>this.ch.push(f.t,[f.health,null]));}
};
