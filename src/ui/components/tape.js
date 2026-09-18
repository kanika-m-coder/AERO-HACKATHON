import { el, clamp } from '../../core/util.js';
import { LIMITS, sevOf } from '../../backend/limits.js';
import { cssv } from './style.js';

/* --- Tape: EICAS-style vertical instrument with twin marker --------- */
export function tape(key,label){
  const L=LIMITS[key]||{min:0,max:100,unit:'',name:label};
  const t=el('div','tape');
  t.appendChild(el('div','tape-name',label||L.name));
  const track=el('div','tape-track');
  const fill=el('div','tape-fill');
  const tw=el('div','tape-twin');
  track.appendChild(fill);track.appendChild(tw);
  if(L.caution!=null&&!L.inverted){
    const c=el('div','tape-cautline'),r=el('div','tape-redline');
    c.style.bottom=((L.caution-L.min)/(L.max-L.min)*100)+'%';
    r.style.bottom=((L.red-L.min)/(L.max-L.min)*100)+'%';
    track.appendChild(c);track.appendChild(r);
  }
  t.appendChild(track);
  const v=el('div','tape-val','--');
  t.appendChild(v);
  t.appendChild(el('div','tape-unit',L.unit));
  t.set=(val,twinVal)=>{
    const p=clamp((val-L.min)/(L.max-L.min),0,1)*100;
    fill.style.height=p+'%';
    const sev=sevOf(key,val);
    const col=sev===2?cssv('--warn'):sev===1?cssv('--caution'):cssv('--nominal');
    fill.style.borderTopColor=col;
    fill.style.background=`color-mix(in srgb, ${col} 26%, transparent)`;
    v.textContent=val>=100?val.toFixed(0):val.toFixed(val<10?2:1);
    v.style.color=sev?col:'';
    if(twinVal!=null){tw.style.bottom=clamp((twinVal-L.min)/(L.max-L.min),0,1)*100+'%';tw.style.display='';}
    else tw.style.display='none';
  };
  return t;
}
