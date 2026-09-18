// Published operating limits and severity classification.

// Operating limits for a Rotax 914-class turbocharged aero-piston engine.
export const LIMITS={
  rpm:{caution:5600,red:5800,min:0,max:6200,unit:'RPM',name:'RPM'},
  map:{caution:39.0,red:41.0,min:10,max:45,unit:'inHg',name:'MAP'},
  egt:{caution:900,red:950,min:200,max:1000,unit:'\u00B0C',name:'EGT'},
  cht:{caution:120,red:135,min:20,max:150,unit:'\u00B0C',name:'CHT'},
  oilT:{caution:125,red:140,min:20,max:150,unit:'\u00B0C',name:'OIL T'},
  oilP:{caution:1.5,red:1.2,min:0,max:7,unit:'bar',name:'OIL P',inverted:true},
  cltT:{caution:115,red:120,min:20,max:130,unit:'\u00B0C',name:'CLT T'},
  fuelP:{caution:0.22,red:0.15,min:0,max:0.6,unit:'bar',name:'FUEL P',inverted:true},
  vib:{caution:7.1,red:11.2,min:0,max:18,unit:'mm/s',name:'VIB'},
  volt:{caution:12.4,red:11.8,min:8,max:16,unit:'V',name:'BUS V',inverted:true},
  iat:{caution:70,red:85,min:-30,max:100,unit:'\u00B0C',name:'IAT'},
  ff:{caution:40,red:46,min:0,max:50,unit:'L/h',name:'FUEL FLOW'}
};
export const sevOf=(key,v)=>{const L=LIMITS[key];if(!L||v==null)return 0;
  if(L.inverted)return v<=L.red?2:v<=L.caution?1:0;
  return v>=L.red?2:v>=L.caution?1:0;};
