// Engine Reference Values & Monitoring Logic (Engine Range)

export const ENGINE_REFERENCE_VALUES = {
  rpm: {
    name: 'RPM',
    rated: 2700,
    cruise75: 2450,
    cruise65: 2350,
    maxRotax: 5800,
    unit: 'RPM'
  },
  oilTemp: {
    name: 'Oil Temperature',
    desiredC: 82, // ~180°F
    desiredF: 180,
    max912AF: 140, // °C
    max912S: 130,  // °C
    unit: '°C'
  },
  oilPress: {
    name: 'Oil Pressure',
    minPsi: 60,
    maxPsi: 90,
    unit: 'psi'
  },
  cht: {
    name: 'CHT',
    max912AF: 150, // °C
    max912S: 135,  // °C
    unit: '°C'
  },
  vib: {
    name: 'Vibration',
    unit: 'mm/s',
    isoCaution: 7.1,
    isoFault: 11.2
  }
};

export function evaluateEngineRange(m, S) {
  const thr = S && S.cmd ? S.cmd.throttle : 0.66;
  const phase = S && S.phase ? S.phase : 'CRUISE';

  // 1. RPM Reference Selection based on active flight phase / operating condition
  let rpmRef = 2450;
  let rpmCondition = '75% Cruise';
  if (phase === 'TAKEOFF' || thr > 0.9) {
    rpmRef = 2700;
    rpmCondition = 'Rated Operation';
  } else if (phase === 'LOITER' || thr < 0.55) {
    rpmRef = 2350;
    rpmCondition = '65% Economy Cruise';
  }

  const actualRpm = Math.round(m.rpm);
  const rpmDev = actualRpm - rpmRef;
  let rpmStatus = 'HEALTHY';
  if (actualRpm > ENGINE_REFERENCE_VALUES.rpm.maxRotax) {
    rpmStatus = 'FAULT';
  } else if (Math.abs(rpmDev) > 150) {
    rpmStatus = 'ABNORMAL';
  } else if (Math.abs(rpmDev) > 80) {
    rpmStatus = 'WARNING';
  }

  // 2. Oil Pressure (1 bar ≈ 14.5038 psi)
  const actualOilPsi = (m.oilP * 14.5038);
  let oilPStatus = 'HEALTHY';
  let oilPDevStr = '0.0 psi';
  if (actualOilPsi < 60) {
    oilPStatus = 'FAULT';
    oilPDevStr = `${(actualOilPsi - 60).toFixed(1)} psi`;
  } else if (actualOilPsi > 90) {
    oilPStatus = 'FAULT';
    oilPDevStr = `+${(actualOilPsi - 90).toFixed(1)} psi`;
  } else {
    oilPDevStr = 'Nominal';
  }

  // 3. Oil Temperature (Desired 82°C / 180°F)
  const actualOilC = m.oilT;
  const oilTDev = actualOilC - 82;
  let oilTStatus = 'HEALTHY';
  if (actualOilC > 130 || actualOilC < 40) {
    oilTStatus = 'FAULT';
  } else if (Math.abs(oilTDev) > 18) {
    oilTStatus = 'WARNING';
  }

  // 4. Cylinder-Head Temperature (CHT Max 135°C / 150°C)
  const actualChtMax = Math.max(...(m.cht || [0]));
  const chtLimit = 135;
  const chtDev = actualChtMax - chtLimit;
  let chtStatus = 'HEALTHY';
  if (actualChtMax > 150) {
    chtStatus = 'FAULT';
  } else if (actualChtMax > chtLimit) {
    chtStatus = 'FAULT';
  } else if (actualChtMax > 120) {
    chtStatus = 'WARNING';
  }

  // 5. Vibration (ISO 10816 standard parameter monitoring without fixed 5 mm/s)
  const actualVib = m.vibRms;
  let vibStatus = 'HEALTHY';
  if (actualVib > 11.2) {
    vibStatus = 'FAULT';
  } else if (actualVib > 7.1) {
    vibStatus = 'ABNORMAL';
  }

  return [
    {
      param: 'RPM',
      actualStr: `${actualRpm} RPM`,
      refStr: `${rpmRef} RPM (${rpmCondition})`,
      devStr: rpmDev === 0 ? '0 RPM' : `${rpmDev > 0 ? '+' : ''}${rpmDev} RPM`,
      status: rpmStatus
    },
    {
      param: 'Oil Pressure',
      actualStr: `${actualOilPsi.toFixed(1)} psi`,
      refStr: `60–90 psi`,
      devStr: oilPDevStr,
      status: oilPStatus
    },
    {
      param: 'Oil Temperature',
      actualStr: `${actualOilC.toFixed(1)}°C (${(actualOilC * 1.8 + 32).toFixed(0)}°F)`,
      refStr: `82°C (180°F Desired)`,
      devStr: `${oilTDev >= 0 ? '+' : ''}${oilTDev.toFixed(1)}°C`,
      status: oilTStatus
    },
    {
      param: 'CHT (Max Cylinder)',
      actualStr: `${actualChtMax.toFixed(1)}°C`,
      refStr: `Maximum 150°C (912 A/F) / 135°C (912 S)`,
      devStr: chtDev > 0 ? `+${chtDev.toFixed(1)}°C` : 'Nominal',
      status: chtStatus
    },
    {
      param: 'Vibration',
      actualStr: `${actualVib.toFixed(2)} mm/s`,
      refStr: `ISO 10816 Baseline`,
      devStr: actualVib > 7.1 ? `+${(actualVib - 7.1).toFixed(2)} mm/s` : 'Nominal',
      status: vibStatus
    }
  ];
}
