import { el, hhmmss } from '../../core/util.js';
import { cssv } from './style.js';

/* --- TimeChart: time-indexed multi-series canvas plot ---------------- */
export class TimeChart{
  constructor(o){
    this.o=Object.assign({window:90,height:150,min:null,max:null,unit:'',fill:false,thresh:null},o);
    this.pts=[];
    this.el=el('div','chart');
    this.cv=document.createElement('canvas');
    this.cv.style.height=this.o.height+'px';
    this.el.appendChild(this.cv);
    if(o.series.length>1||o.legend!==false){
      const lg=el('div','chart-legend');
      o.series.forEach(s=>{const i=el('span');
        i.innerHTML=`<i style="background:${s.color};${s.dash?'border-top:2px dashed '+s.color+';background:none;height:0':''}"></i>${s.label}`;
        lg.appendChild(i);});
      this.legend=lg;
    }
    this.ctx=this.cv.getContext('2d');
    this.dirty=true;
  }
  mount(parent){parent.appendChild(this.cv);if(this.legend)parent.appendChild(this.legend);return this;}
  clear(){this.pts=[];this.dirty=true;}
  push(t,vals){this.pts.push({t,v:vals});const cut=t-this.o.window;
    while(this.pts.length&&this.pts[0].t<cut)this.pts.shift();this.dirty=true;}
  draw(){
    const cv=this.cv,ctx=this.ctx,dpr=window.devicePixelRatio||1;
    const W=cv.clientWidth||300,H=this.o.height;
    if(cv.width!==W*dpr||cv.height!==H*dpr){cv.width=W*dpr;cv.height=H*dpr;}
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,W,H);
    const pad={l:40,r:8,t:8,b:16};
    const iw=W-pad.l-pad.r, ih=H-pad.t-pad.b;
    let mn=this.o.min,mx=this.o.max;
    if(mn==null||mx==null){
      let a=Infinity,b=-Infinity;
      this.pts.forEach(p=>p.v.forEach(v=>{if(v==null||isNaN(v))return;if(v<a)a=v;if(v>b)b=v;}));
      if(this.o.thresh!=null){a=Math.min(a,this.o.thresh);b=Math.max(b,this.o.thresh);}
      if(!isFinite(a)){a=0;b=1;}
      const sp=(b-a)||1; mn=this.o.min!=null?this.o.min:a-sp*0.12; mx=this.o.max!=null?this.o.max:b+sp*0.12;
    }
    const t1=this.pts.length?this.pts[this.pts.length-1].t:0, t0=t1-this.o.window;
    const X=t=>pad.l+((t-t0)/this.o.window)*iw;
    const Y=v=>pad.t+ih-((v-mn)/(mx-mn))*ih;
    // grid + axis
    ctx.strokeStyle=cssv('--grid');ctx.lineWidth=1;ctx.font='9px "IBM Plex Mono", monospace';
    ctx.fillStyle=cssv('--ink-3');ctx.textAlign='right';ctx.textBaseline='middle';
    for(let i=0;i<=4;i++){
      const v=mn+(mx-mn)*i/4, y=Math.round(Y(v))+.5;
      ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
      ctx.fillText(Math.abs(v)>=100?v.toFixed(0):v.toFixed(Math.abs(v)<10?2:1),pad.l-6,y);
    }
    ctx.textAlign='left';ctx.textBaseline='alphabetic';
    for(let i=0;i<=3;i++){
      const t=t0+this.o.window*i/3;
      ctx.fillText(hhmmss(Math.max(0,t)).slice(3),pad.l+iw*i/3+2,H-4);
    }
    if(this.o.thresh!=null){
      ctx.save();ctx.setLineDash([4,3]);ctx.strokeStyle=cssv('--warn');
      const y=Math.round(Y(this.o.thresh))+.5;
      ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();ctx.restore();
    }
    // series
    this.o.series.forEach((s,i)=>{
      if(this.pts.length<2)return;
      ctx.save();
      ctx.beginPath();ctx.rect(pad.l,0,iw,H);ctx.clip();
      ctx.strokeStyle=s.color;ctx.lineWidth=s.w||1.5;
      if(s.dash)ctx.setLineDash([4,3]);
      ctx.beginPath();
      let started=false;
      this.pts.forEach(p=>{const v=p.v[i];if(v==null||isNaN(v)){started=false;return;}
        const x=X(p.t),y=Y(v);if(!started){ctx.moveTo(x,y);started=true;}else ctx.lineTo(x,y);});
      ctx.stroke();
      if(s.fill){
        ctx.lineTo(X(this.pts[this.pts.length-1].t),pad.t+ih);
        ctx.lineTo(X(this.pts[0].t),pad.t+ih);ctx.closePath();
        ctx.fillStyle=s.color+'22';ctx.fill();
      }
      ctx.restore();
    });
    this.dirty=false;
  }
}

/* --- shared chart registry: draws only what is on screen ------------ */
export const CHARTS=new Set();
export function rafLoop(){
  CHARTS.forEach(c=>{ if(c.cv.offsetParent!==null && c.cv.clientWidth>0) c.draw(); });
  requestAnimationFrame(rafLoop);
}
export function newChart(o){const c=new TimeChart(o);CHARTS.add(c);return c;}
