import { fmt, el, $ } from '../../core/util.js';
import { S, engine } from '../../core/store.js';
import { panel, kv, bar } from '../components/panel.js';
import { cssv } from '../components/style.js';
import { newChart } from '../components/TimeChart.js';
import { VIEWS } from './registry.js';


VIEWS.rul={
  layer:'08', nav:'Remaining useful life', title:'Remaining useful life',
  desc:'Component wear is integrated continuously from load, temperature and detected fault severity. The Bayesian degradation model projects each state forward to its end-of-life threshold and returns a credible interval, not a single number.',
  build(){
    const root=el('div','grid');
    const hd=panel('Life projection','END OF LIFE AT 90% WEAR');
    hd.body.className='panel-body tight';
    const w=el('div','tbl-wrap');this.tbl=el('table');w.appendChild(this.tbl);hd.body.appendChild(w);
    root.appendChild(hd);

    const g=el('div','grid g2');
    const lim=panel('Limiting component','FIRST TO REACH END OF LIFE');
    this.lBig=el('div');this.lBig.style.cssText='font-family:var(--mono);font-size:40px;font-weight:600;line-height:1';
    lim.body.appendChild(this.lBig);
    this.lName=el('div');this.lName.style.cssText='font-size:14px;margin:4px 0 2px';
    lim.body.appendChild(this.lName);
    this.lCi=el('div','dim mono');this.lCi.style.cssText='font-size:12px;margin-bottom:14px';
    lim.body.appendChild(this.lCi);
    this.rb=el('div','rulbar');
    this.rb.innerHTML='<div class="band"></div><div class="pt"></div><div class="lbl mono"></div>';
    lim.body.appendChild(this.rb);
    this.rbScale=el('div','dimmer mono');this.rbScale.style.cssText='font-size:10px;display:flex;justify-content:space-between;margin-top:4px';
    lim.body.appendChild(this.rbScale);
    lim.body.appendChild(el('div','sep'));
    this.kSort=kv('Next scheduled sortie','4.5 h endurance');
    this.kGo=kv('Sortie feasible','\u2014');
    this.kSched=kv('Recommended action','\u2014');
    [this.kSort,this.kGo,this.kSched].forEach(x=>lim.body.appendChild(x));
    g.appendChild(lim);

    const tr=panel('Degradation trajectory','WEAR STATE vs TIME');
    tr.body.className='panel-body tight';
    this.ch=newChart({height:190,window:900,min:0,max:100,series:[
      {key:'r',color:cssv('--caution'),label:'Piston rings'},
      {key:'b',color:cssv('--info'),label:'Bearings'},
      {key:'t',color:cssv('--twin'),label:'Turbocharger'},
      {key:'o',color:cssv('--warn'),label:'Oil charge'}]});
    this.ch.mount(tr.body);
    g.appendChild(tr);
    root.appendChild(g);

    const mt=panel('Maintenance planning','DERIVED FROM RUL');
    this.plan=el('div');mt.body.appendChild(this.plan);
    root.appendChild(mt);
    return root;
  },
  update(S){
    const R=S.ml.rul;
    if(!R.__overall)return;
    const items=Object.entries(R).filter(([k])=>k!=='__overall').map(([k,v])=>({k,...v})).sort((a,b)=>a.rul-b.rul);
    const ov=R.__overall;
    this.lBig.textContent=fmt(ov.rul,0);
    this.lBig.style.color=ov.rul<25?cssv('--warn'):ov.rul<80?cssv('--caution'):cssv('--nominal');
    this.lName.innerHTML=`engine hours remaining on <strong>${ov.name.toLowerCase()}</strong>`;
    this.lCi.textContent=`90% credible interval ${fmt(ov.lo,0)} \u2013 ${fmt(ov.hi,0)} h \u00B7 wear ${(ov.deg*100).toFixed(1)}%`;
    const scale=Math.max(ov.hi*1.15,40);
    this.rb.querySelector('.band').style.left=(ov.lo/scale*100)+'%';
    this.rb.querySelector('.band').style.width=((ov.hi-ov.lo)/scale*100)+'%';
    this.rb.querySelector('.pt').style.left=(ov.rul/scale*100)+'%';
    this.rb.querySelector('.lbl').textContent=fmt(ov.rul,0)+' h';
    this.rbScale.innerHTML=`<span>0 h</span><span>${fmt(scale/2,0)} h</span><span>${fmt(scale,0)} h</span>`;
    const feasible=ov.lo>4.5;
    this.kGo.val.textContent=feasible?'Yes':'No — defer';
    this.kGo.val.className='v mono '+(feasible?'nom':'wrn');
    this.kSched.val.textContent=ov.rul<25?'Schedule now':ov.rul<80?'Plan within 2 weeks':'Continue normal interval';
    this.kSched.val.className='v mono '+(ov.rul<25?'wrn':ov.rul<80?'cau':'nom');

    const d=S.eng.deg;
    this.ch.push(S.t,[d.rings*100,d.bearings*100,d.turbo*100,d.oil*100]);

    if(!this._t||performance.now()-this._t>500){
      this._t=performance.now();
      this.tbl.innerHTML='<thead><tr><th>Component</th><th class="num">Wear</th><th class="num">RUL</th><th class="num">90% interval</th><th class="num">Wear rate</th><th class="num">Confidence</th><th style="width:120px">Life consumed</th></tr></thead><tbody>'+
        items.map(c=>{
          const col=c.rul<25?cssv('--warn'):c.rul<80?cssv('--caution'):cssv('--nominal');
          return `<tr><td>${c.name}</td>
            <td class="num">${(c.deg*100).toFixed(1)}%</td>
            <td class="num" style="color:${col}">${fmt(c.rul,0)} h</td>
            <td class="num dimmer">${fmt(c.lo,0)} \u2013 ${fmt(c.hi,0)}</td>
            <td class="num dimmer">${(c.rate*100).toFixed(3)} %/h</td>
            <td class="num dimmer">${(c.conf*100).toFixed(0)}%</td>
            <td><div class="bar"><span style="width:${c.deg*100/0.9}%;background:${col}"></span></div></td></tr>`;
        }).join('')+'</tbody>';
      const p=[];
      items.filter(c=>c.rul<120).forEach(c=>{
        p.push(`<div class="kv"><div class="k">${c.name}</div><div class="v ${c.rul<25?'wrn':'cau'}">${c.rul<25?'Schedule immediately':'Bring forward to next inspection'} \u00B7 ${fmt(c.rul,0)} h</div></div>`);
      });
      if(!p.length)p.push('<p class="dim" style="margin:0">Every component has more than 120 h of projected life. No unscheduled maintenance is indicated; continue the normal 50 h inspection cycle.</p>');
      else p.unshift('<p class="dim" style="margin:0 0 8px">Components projected to reach end of life within 120 engine hours:</p>');
      this.plan.innerHTML=p.join('');
    }
  },
  seed(S){this.ch.clear();}
};
