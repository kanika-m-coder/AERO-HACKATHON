import { el } from '../../core/util.js';


export function panel(title,tag,body,cls){
  const p=el('div','panel'+(cls?' '+cls:''));
  const h=el('div','panel-head');
  h.appendChild(el('div','panel-title',title));
  if(tag)h.appendChild(el('div','panel-tag',tag));
  p.appendChild(h);
  const b=el('div','panel-body');
  if(body)b.appendChild(body);
  p.appendChild(b);
  p.body=b;
  return p;
}
export function kv(k,v,cls){
  const r=el('div','kv');
  r.appendChild(el('div','k',k));
  const val=el('div','v'+(cls?' '+cls:''),v);
  r.appendChild(val); r.val=val; return r;
}
export function bar(label,pct,color){
  const w=el('div');
  const top=el('div');top.style.cssText='display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px';
  top.appendChild(el('span','dim',label));
  const num=el('span','mono');num.textContent=pct.toFixed(1);
  top.appendChild(num);
  const b=el('div','bar');const f=el('span');f.style.width=pct+'%';if(color)f.style.background=color;
  b.appendChild(f);w.appendChild(top);w.appendChild(b);
  w.set=(v,c)=>{num.textContent=v.toFixed(1);f.style.width=clamp(v,0,100)+'%';if(c)f.style.background=c;};
  w.setLabel=t=>{num.textContent=t;};
  return w;
}
