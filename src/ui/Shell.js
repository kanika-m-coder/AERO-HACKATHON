import { $, lerp, hhmmss } from '../core/util.js';
import { S, tick, pushEvent } from '../core/store.js';
import { PROFILES } from '../backend/profiles.js';
import { ORDER, route, buildNav, buildViews, getCurrent, getCurrentView, clearAlert } from './Router.js';
import { buildStrip, updateStrip } from './StatusStrip.js';
import { rafLoop } from './components/TimeChart.js';


export function boot(){
  buildNav();buildViews();buildStrip();
  pushEvent({type:'info',sev:0,txt:'AEROTWIN online \u00B7 twin synchronised \u00B7 '+PROFILES[S.profile].name,sys:'Mission',t:0});
  // pre-roll 90 s so every view opens with history rather than an empty frame
  for(let i=0;i<900;i++) tick(0.1);
  route('overview');

  let fpsT=performance.now(),frames=0;
  setInterval(()=>{
    if(!S.running)return;
    const t0=performance.now();
    const steps=S.speed;
    for(let i=0;i<steps;i++) tick(0.1);
    window.__tickMs=lerp(window.__tickMs||0,performance.now()-t0,0.1);
    frames++;
    const now=performance.now();
    if(now-fpsT>1000){window.__fps=frames*1000/(now-fpsT);frames=0;fpsT=now;}
    const v=getCurrentView();
    if(v&&v.update&&S.sensors){ try{v.update(S);}catch(e){console.error('[view]',current,e);} }
    if(S.sensors)updateStrip(S);
    clearAlert();
  },100);

  requestAnimationFrame(rafLoop);

  document.addEventListener('keydown',ev=>{
    if(ev.target.tagName==='INPUT'||ev.target.tagName==='SELECT')return;
    const i=ORDER.indexOf(getCurrent());
    if(ev.key===']'){route(ORDER[(i+1)%ORDER.length]);}
    if(ev.key==='['){route(ORDER[(i-1+ORDER.length)%ORDER.length]);}
    if(ev.key===' '){ev.preventDefault();const b=$('#strip .btn.primary')||$('#strip .btn');
      S.running=!S.running;const pb=$('#strip .strip-ctl .btn');pb.textContent=S.running?'Pause':'Resume';
      pb.classList.toggle('primary',S.running);}
  });
}
