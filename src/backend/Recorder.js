/* Mission data recorder: 1 Hz ring buffer + event log, feeds replay.  */
export class Recorder{
  constructor(cap=7200){this.cap=cap;this.buf=[];this.events=[];this.acc=0;}
  tick(dt,frame){
    this.acc+=dt;
    if(this.acc>=1){this.acc=0;this.buf.push(frame);if(this.buf.length>this.cap)this.buf.shift();}
  }
  event(e){this.events.push(e);if(this.events.length>600)this.events.shift();}
  reset(){this.buf=[];this.events=[];this.acc=0;}
  get duration(){return this.buf.length?this.buf[this.buf.length-1].t:0;}
  at(t){
    if(!this.buf.length)return null;
    let lo=0,hi=this.buf.length-1;
    while(lo<hi){const mid=(lo+hi)>>1;if(this.buf[mid].t<t)lo=mid+1;else hi=mid;}
    return this.buf[lo];
  }
}
