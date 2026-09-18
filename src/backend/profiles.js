// Mission profiles flown by the autopilot scheduler.

export const PROFILES={
  ISR:{name:'ISR orbit (standard)',segs:[
    {ph:'TAXI',d:50,th:.16,alt:0},{ph:'TAKEOFF',d:45,th:1.0,alt:600},
    {ph:'CLIMB',d:330,th:.92,alt:16000},{ph:'CRUISE',d:300,th:.66,alt:18000},
    {ph:'LOITER',d:900,th:.48,alt:18000},{ph:'DASH',d:150,th:.96,alt:16000},
    {ph:'LOITER',d:600,th:.50,alt:17000},{ph:'DESCENT',d:330,th:.28,alt:1500},
    {ph:'LANDING',d:110,th:.22,alt:0},{ph:'SHUTDOWN',d:60,th:0,alt:0}]},
  ENDURANCE:{name:'Long endurance, low power',segs:[
    {ph:'TAXI',d:50,th:.16,alt:0},{ph:'TAKEOFF',d:45,th:1.0,alt:600},
    {ph:'CLIMB',d:360,th:.88,alt:14000},{ph:'LOITER',d:2400,th:.42,alt:15000},
    {ph:'DESCENT',d:360,th:.26,alt:1000},{ph:'LANDING',d:110,th:.2,alt:0}]},
  HIGH_ALT:{name:'High altitude, critical boost',segs:[
    {ph:'TAXI',d:40,th:.16,alt:0},{ph:'TAKEOFF',d:45,th:1.0,alt:600},
    {ph:'CLIMB',d:600,th:.98,alt:24000},{ph:'CRUISE',d:900,th:.82,alt:25000},
    {ph:'DESCENT',d:420,th:.25,alt:1000},{ph:'LANDING',d:110,th:.2,alt:0}]},
  TEST:{name:'Ground test / power sweep',segs:[
    {ph:'IDLE',d:60,th:.12,alt:0},{ph:'RUN-UP',d:90,th:.55,alt:0},
    {ph:'FULL PWR',d:120,th:1.0,alt:0},{ph:'CONT PWR',d:240,th:.75,alt:0},
    {ph:'COOLDOWN',d:120,th:.15,alt:0}]}
};
