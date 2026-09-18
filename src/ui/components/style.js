// Theme-token access and the shared severity colour scale.
export const cssv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export const healthColor=v=>v>=80?cssv('--nominal'):v>=60?cssv('--caution'):cssv('--warn');
export const sevClass=s=>s===2?'wrn':s===1?'cau':'nom';
