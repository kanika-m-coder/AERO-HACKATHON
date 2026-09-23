# AeroTwin AI

Digital twin and predictive engine health monitoring platform for a MALE UAV
aero-piston engine (turbocharged four-cylinder, Rotax 914-class).

The application demonstrates one integrated system in which real-time
telemetry, a digital twin, deterministic fault detection, machine-learning
predictive analytics, remaining useful life estimation, mission simulation,
replay and reporting all operate on the same live data stream.

---

## Engine Health States
The Engine Health Monitoring module evaluates 6 condition states:
1. **Fuel system** — Irregular fuel flow readings inconsistent with commanded RPM.
2. **Cooling system** — Coolant divergence against twin predictions.
3. **Lubricant system** — Falling oil pressure alongside rising temperature.
4. **Health** — All sensor parameters within normal, stable ranges.
5. **Bearing degradation** — Continuously rising vibration with temperature increase.
6. **Overheating** — Abnormally high temperature independent of vibration.

---

## Running it

**The quickest way** — open `dist/uav-engine-digital-twin.html` in any modern
browser. It is a single self-contained file with no server and no build step.

**From source** — run the lightweight server:

```bash
node server.js                    # opens http://localhost:3000
```

**Rebuilding the single-file version** after editing the source:

```bash
node build.js                    # writes dist/uav-engine-digital-twin.html
```

`build.js` concatenates the modules in dependency order, drops the `import`
statements, strips the `export` keyword and inlines the stylesheets and logo asset. It needs
nothing but Node — no bundler, no dependencies.

---

## Project structure

```
aerotwin-ai/
├── index.html                  module entry point
├── build.js                    dependency-ordered bundler -> dist/
├── server.js                   lightweight static HTTP server (port 3000)
├── assets/
│   └── logo.jpg                AeroTwin AI logo & favicon
├── dist/
│   └── uav-engine-digital-twin.html    single-file build
└── src/
    ├── main.js                 registers views, boots the shell
    ├── core/
    │   ├── util.js             maths, deterministic noise, formatting, DOM helpers
    │   ├── EventBus.js         pub/sub decoupling backend services from views
    │   └── store.js            single source of truth, owns the tick loop
    ├── backend/
    │   ├── limits.js           published operating limits, severity classification
    │   ├── faults.js           11 seeded failure modes
    │   ├── profiles.js         mission profiles for the autopilot scheduler
    │   ├── EngineModel.js      ground-truth plant physics and wear integration
    │   ├── SensorLayer.js      noise, quantisation, sensor faults
    │   ├── DigitalTwin.js      healthy-engine expectation model and residuals
    │   ├── Diagnostics.js      20-rule deterministic detection engine
    │   ├── MLService.js        anomaly, fault classification, RUL
    │   ├── HealthMonitor.js    per-subsystem condition indices (6 health states)
    │   ├── Recorder.js         1 Hz mission data recorder / replay store
    │   └── Reporting.js        mission, health and maintenance report builder
    ├── ui/
    │   ├── Router.js           view registration, navigation, alert badges
    │   ├── StatusStrip.js      persistent EICAS-style status bar
    │   ├── Shell.js            application boot, run loop, keyboard control
    │   ├── components/         panel, tape, TimeChart, log, toast, style tokens
    │   └── views/              one module per view, self-registering
    └── styles/
        ├── tokens.css          palette, typography, layout metrics, themes
        └── app.css             shell, panels, instruments, charts, tables
```

Frontend and backend responsibilities are kept strictly apart. Nothing under
`src/backend/` or `src/core/` touches the DOM; nothing under `src/ui/` performs
simulation, detection or prediction. The backend can be lifted out and run
headlessly — which is exactly how it was validated (see below).

---

## Layer map

| # | Layer | Module |
|---|-------|--------|
| 1 | Physical asset and sensor set | `backend/EngineModel.js` |
| 2 | Data acquisition and conditioning | `backend/SensorLayer.js` |
| 3 | Simulation and scenario control | `backend/profiles.js`, `backend/faults.js` |
| 4 | Telemetry transport | `backend/Recorder.js` |
| 5 | Digital twin core | `backend/DigitalTwin.js` |
| 6 | Health monitoring | `backend/HealthMonitor.js` |
| 7 | Fault detection | `backend/Diagnostics.js` |
| 8 | AI/ML predictive analytics and RUL | `backend/MLService.js` |
| 9 | Visualisation | `ui/components/`, `ui/views/` |
| 10 | Reporting and replay | `backend/Reporting.js`, `ui/views/replay.js` |

---

## How the system fits together

Each 100 ms frame runs the same fixed sequence in `core/store.js`:

```
throttle, altitude, OAT
  |
EngineModel.step()        ground truth + wear accumulation
  |
SensorLayer.read()        noise, quantisation, sensor faults
  |                   \
DigitalTwin.expect()  ->  residuals = measured - expected
  |                       |
Diagnostics.run()     MLService.infer()
  |                       |
HealthMonitor         anomaly / mode / RUL
  \                   /
   Recorder - Views - Reporting
```

The twin receives only throttle, altitude and outside air temperature — the
three quantities a flight-control computer would publish. It is never told
about wear or injected faults, so every divergence has to be earned.

**Engine model.** Standard-atmosphere ambient pressure, a compressor pressure
ratio that holds 39.3 inHg to a 16,000 ft critical altitude and falls away
above it, first-order thermal lags so oil and coolant settle on their own time
constants, per-cylinder combustion, and eight wear states integrated from load
and temperature. Power loss feeds back into airspeed, closing the loop.

**Detection runs two independent ways.** Twenty deterministic rules combine
absolute limits with physics cross-checks against the twin, each behind a 0.8 s
persistence filter to reject transients. In parallel, three models run on the
standardised residual vector: an LSTM-autoencoder-style anomaly score, a
gradient-boosted fault-mode classifier over 12 classes, and a Bayesian
exponential degradation model that returns RUL with a credible interval rather
than a single number.

**Seeded failure modes.** Spark plug fouling, detonation onset, oil leak,
coolant loss, turbo wastegate stuck open, injector clogging, main bearing wear,
air filter blockage, CHT sensor drift, alternator under-charge, fuel pump
degradation. All ramp in progressively, as real degradation arrives, so
detection latency is observable rather than instantaneous.

---

## Validation

The backend is DOM-free and was exercised headlessly under Node during
development (`node --check` on every module plus scripted scenario runs):

- **Fault classification:** 11/11 top-1 correct with each mode injected at
  steady cruise; the runner-up class is in every case a physically plausible
  confusion, e.g. wastegate against filter blockage.
- **Turbocharger:** manifold pressure holds 39.3 inHg from sea level to
  16,000 ft, then decays to 26.9 inHg at 25,000 ft — the expected
  critical-altitude knee.
- **RUL:** 900–1,450 h per component on a near-new engine, with the oil charge
  correctly the near-term limiter at roughly 70–90 h.
- **UI:** all 11 views build, seed and update without error in the clean,
  faulted, replay and post-reset states.

Two sensor channels exist because the fault set demanded them. Filter blockage
and wastegate failure are genuinely inseparable from manifold pressure alone,
as are plug fouling and injector clogging from EGT spread alone. Rather than
tune the classifier to fake a distinction, the model carries a filter
differential-pressure sensor and a signed EGT-outlier feature — which is what a
real installation would have, and what took classification to 11/11.

---

## Using the demonstrator

Keyboard: `[` and `]` move between views, space pauses and resumes.

A suggested walkthrough:

1. **Simulation** — set speed to x20, inject *Detonation onset, cylinder 3*.
2. **Predictive analytics** — watch the anomaly score cross its threshold, and
   the classifier converge on the correct mode with feature attribution.
3. **Fault detection** — see which deterministic rules latch, and when.
4. **Digital twin** — read the residual that drove it.
5. **Mission replay** — scrub back to the moment the caution appeared and read
   the complete engine state at that instant.
6. **Reports** — generate the consolidated mission and maintenance document.

---

## Known limitations

- Engine, sensor and degradation models are physically motivated but
  representative, not a certified performance deck for any specific engine.
- The machine-learning layer reproduces the behaviour of trained models through
  calibrated signature matching and reconstruction error. It runs the real
  inference pipeline shape — standardised residuals in, anomaly, class
  posterior and RUL interval out — but ships no trained weights.
- Report and CSV export copy to the clipboard rather than downloading a file,
  so the demonstrator works identically when hosted in a sandboxed frame.
- Model parameters come from published limits for this engine class and from
  the tuning described above, not from flight-test data.

## Extending it

Adding a view is one file under `src/ui/views/` plus one import in
`src/main.js`; the router discovers it from the registry. Adding a fault is one
entry in `backend/faults.js`, its physical effect in `EngineModel.step()`, and
its residual signature in `MLService.js`. Replacing the simulated plant with a
real telemetry feed means substituting `EngineModel` and `SensorLayer` — every
layer above them consumes the sensor frame and nothing else.
