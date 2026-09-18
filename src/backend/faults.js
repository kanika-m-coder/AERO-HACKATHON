// Catalogue of seeded failure modes available to the injector.

export const FAULT_DEFS=[
 {id:'plug_foul',   name:'Spark plug fouling, cylinder 2', sys:'Ignition',    rate:0.020,
  hint:'Cyl 2 EGT falls, roughness and 1x vibration rise, slight fuel-flow increase.'},
 {id:'detonation',  name:'Detonation onset, cylinder 3',   sys:'Combustion',  rate:0.030,
  hint:'Cyl 3 CHT and EGT climb together with a sharp rise in 2x vibration.'},
 {id:'oil_leak',    name:'Oil system leak',                sys:'Lubrication', rate:0.021,
  hint:'Oil pressure decays, oil temperature climbs, quantity falls steadily.'},
 {id:'coolant_loss',name:'Coolant loss / pump wear',       sys:'Cooling',     rate:0.018,
  hint:'Coolant temperature diverges upward from the twin prediction.'},
 {id:'wastegate',   name:'Turbo wastegate stuck open',     sys:'Induction',   rate:0.045,
  hint:'Manifold pressure cannot reach commanded boost; power and airspeed fall off.'},
 {id:'injector',    name:'Injector clogging, cylinder 1',  sys:'Fuel',        rate:0.022,
  hint:'Cyl 1 runs lean: EGT rises, CHT falls, total fuel flow drops.'},
 {id:'bearing',     name:'Main bearing wear',              sys:'Mechanical',  rate:0.019,
  hint:'Broadband vibration grows, oil pressure sags, oil temperature creeps up.'},
 {id:'filter',      name:'Air filter blockage',            sys:'Induction',   rate:0.030,
  hint:'Intake depression rises, MAP and volumetric efficiency drop, IAT rises.'},
 {id:'sensor_drift',name:'CHT 3 sensor drift',             sys:'Sensors',     rate:0.035,
  hint:'Indicated CHT 3 diverges while all physical cross-checks stay nominal.'},
 {id:'alternator',  name:'Alternator under-charge',        sys:'Electrical',  rate:0.050,
  hint:'Bus voltage and charge current decay; avionics load moves onto the battery.'},
 {id:'fuelpump',    name:'Fuel pump degradation',          sys:'Fuel',        rate:0.025,
  hint:'Fuel pressure droops under high demand, flow lags the commanded value.'}
];
export const FAULT_BY_ID=Object.fromEntries(FAULT_DEFS.map(f=>[f.id,f]));
