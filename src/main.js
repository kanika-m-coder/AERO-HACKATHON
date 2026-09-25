// Entry point. Importing each view module registers it with the router.
import { boot } from './ui/Shell.js';
import './ui/views/overview.js';
import './ui/views/telemetry.js';
import './ui/views/twin.js';
import './ui/views/health.js';
import './ui/views/faults.js';
import './ui/views/predictive.js';
import './ui/views/rul.js';
import './ui/views/simulation.js';
import './ui/views/replay.js';
import './ui/views/reports.js';
import './ui/views/architecture.js';
import './ui/views/admin.js';

document.addEventListener('DOMContentLoaded', boot);
