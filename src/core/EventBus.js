// Minimal pub/sub used to decouple the backend services from the views.

export class EventBus{
  constructor(){this.m=new Map();}
  on(ev,fn){(this.m.get(ev)||this.m.set(ev,[]).get(ev)).push(fn);return()=>this.off(ev,fn);}
  off(ev,fn){const a=this.m.get(ev);if(a)a.splice(a.indexOf(fn),1);}
  emit(ev,p){(this.m.get(ev)||[]).forEach(f=>{try{f(p);}catch(e){console.error('[bus]',ev,e);}});}
}
export const bus=new EventBus();
