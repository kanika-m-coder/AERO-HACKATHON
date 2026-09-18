// Small shared helpers: maths, deterministic noise, formatting, DOM.

export const clamp=(v,a,b)=>v<a?a:v>b?b:v;
export const lerp=(a,b,t)=>a+(b-a)*t;
export const rnd=(()=>{let s=20260918;return()=>{s=(s*1664525+1013904223)&0xffffffff;return (s>>>8)/16777216;};})();
export const gauss=(()=>{let sp=null;return(sd=1)=>{if(sp!==null){const v=sp;sp=null;return v*sd;}
  let u=0,v=0,s=0;do{u=rnd()*2-1;v=rnd()*2-1;s=u*u+v*v;}while(s>=1||s===0);
  const m=Math.sqrt(-2*Math.log(s)/s);sp=v*m;return u*m*sd;};})();
export const fmt=(v,d=1)=>(v==null||isNaN(v))?'--':v.toFixed(d);
export const hhmmss=s=>{s=Math.max(0,Math.floor(s));const h=(s/3600)|0,m=((s%3600)/60)|0,x=s%60;
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(x).padStart(2,'0');};
export const el=(tag,cls,html)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(html!=null)n.innerHTML=html;return n;};
export const $=(s,r=document)=>r.querySelector(s);
