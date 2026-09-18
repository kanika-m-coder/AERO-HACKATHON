import { el, hhmmss } from '../../core/util.js';

export function renderLog(node,events){
  node.innerHTML='';
  if(!events.length){node.appendChild(el('div','dimmer','No events recorded.'));return;}
  events.forEach(e=>{
    const r=el('div','log-row');
    r.appendChild(el('div','ts',hhmmss(e.t)));
    const s=el('div','sev '+(e.sev===2?'wrn':e.sev===1?'cau':e.type==='clear'?'nom':'dimmer'),
      e.sev===2?'WARN':e.sev===1?'CAUT':e.type==='clear'?'CLEAR':'INFO');
    r.appendChild(s);
    r.appendChild(el('div','',e.txt));
    node.appendChild(r);
  });
}
