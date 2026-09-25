import { el, $ } from '../core/util.js';
import { bus } from '../core/EventBus.js';
import { S } from '../core/store.js';
import { VIEWS } from './views/registry.js';
import { auth } from '../core/auth.js';
import { buildLoginOverlay, hideLoginOverlay } from './components/LoginModal.js';
import { toast } from './components/toast.js';

const NAVBTN = {};

export const NAV=[
  ['Live monitoring',['overview','telemetry','twin','health']],
  ['Diagnosis and prediction',['faults','predictive','rul']],
  ['Operate',['simulation','replay','reports']],
  ['Reference',['architecture']]
];
export const ORDER=NAV.flatMap(g=>g[1]);
let current=null;
export const getCurrent=()=>current;
export const getCurrentView=()=>VIEWS[current];
export const clearAlert=()=>{const b=NAVBTN[current];if(b)b.classList.remove('has-alert');};

export function openSidebar() {
  const drawer = $('#sidebarDrawer');
  const backdrop = $('#sidebarBackdrop');
  if (drawer) drawer.classList.add('sidebar-open');
  if (backdrop) backdrop.classList.add('active');
  document.body.classList.add('sidebar-active');
}

export function closeSidebar() {
  const drawer = $('#sidebarDrawer');
  const backdrop = $('#sidebarBackdrop');
  if (drawer) drawer.classList.remove('sidebar-open');
  if (backdrop) backdrop.classList.remove('active');
  document.body.classList.remove('sidebar-active');
}

export function buildNav(){
  const nav=$('#nav');
  nav.innerHTML = '';
  NAV.forEach(([g,keys])=>{
    nav.appendChild(el('div','rail-group',g));
    keys.forEach(k=>{
      const v=VIEWS[k];
      const b=el('button','navitem');
      b.innerHTML=`<span class="lyr">${v.layer}</span><span>${v.nav}</span><span class="dot"></span>`;
      b.onclick=()=>route(k);
      b.dataset.key=k;
      NAVBTN[k]=b;
      nav.appendChild(b);
    });
  });
  updateNavPermissions();

  const hamburgerBtn = $('#mobileHamburgerBtn');
  const closeBtn = $('#sidebarCloseBtn');
  const backdrop = $('#sidebarBackdrop');

  if (hamburgerBtn) {
    hamburgerBtn.onclick = (e) => {
      e.stopPropagation();
      openSidebar();
    };
  }
  if (closeBtn) closeBtn.onclick = () => closeSidebar();
  if (backdrop) backdrop.onclick = () => closeSidebar();
}

export function updateNavPermissions() {
  const user = auth.getCurrentUser();
  ORDER.forEach(k => {
    const btn = NAVBTN[k];
    if (!btn) return;
    const allowed = user ? auth.hasAccess(k) : false;
    btn.classList.toggle('restricted', !allowed);
    if (!allowed) {
      btn.title = `Restricted to Maintenance Engineer role`;
    } else {
      btn.removeAttribute('title');
    }
  });
}

export function buildViews(){
  const host=$('#views');
  host.innerHTML = '';
  ORDER.forEach(k=>{
    const v=VIEWS[k];
    const sec=el('section','view');sec.id='view-'+k;
    const head=el('div','view-head');
    const left=el('div');
    left.appendChild(el('h1','view-title',v.title));
    left.appendChild(el('p','view-desc',v.desc));
    head.appendChild(left);
    head.appendChild(el('div','panel-tag','LAYER '+v.layer));
    sec.appendChild(head);
    v._host=sec;
    host.appendChild(sec);
  });
}

export function route(k){
  if(!auth.isAuthenticated()){
    buildLoginOverlay(() => route('overview'));
    return;
  }

  const v=VIEWS[k];
  if(!auth.hasAccess(k)){
    const user = auth.getCurrentUser();
    auth.logEvent('unauthorized_api', user ? user.username : 'Guest', user ? user.role : 'Guest', `Unauthorized navigation attempt to restricted view '${k}'`, 2);
    toast(`Access Denied: ${v ? v.nav : k} requires Maintenance Engineer role`);
    return;
  }

  if(!v)return;
  current=k;
  if(!v._built){ v._host.appendChild(v.build()); v._built=true; }
  ORDER.forEach(x=>{
    VIEWS[x]._host.classList.toggle('active',x===k);
    const btn=NAVBTN[x];
    if(btn)btn.setAttribute('aria-current',String(x===k));
  });

  const mobileLabel = $('#mobileCurrentModuleLabel');
  if (mobileLabel && v) {
    mobileLabel.textContent = `${v.layer} ${v.nav}`;
  }
  closeSidebar();

  try{ v.seed&&v.seed(S); }catch(e){console.error(e);}
  try{ S.sensors&&v.update&&v.update(S); }catch(e){console.error(e);}
  window.scrollTo({top:0,behavior:'instant'});
}

/* --- alert badges on nav -------------------------------------------- */
bus.on('alarm',e=>{
  const map={Combustion:'faults',Lubrication:'faults',Cooling:'faults',Induction:'faults',
    Mechanical:'faults',Fuel:'faults',Electrical:'faults',Sensors:'faults',Power:'faults'};
  const k=map[e.sys]||'faults';
  const b=NAVBTN[k];
  if(b&&current!==k)b.classList.add('has-alert');
});

/* --- auth state change --------------------------------------------- */
bus.on('auth_change', ({ authenticated }) => {
  updateNavPermissions();
  if (!authenticated) {
    buildLoginOverlay(() => route('overview'));
  } else {
    hideLoginOverlay();
  }
});
