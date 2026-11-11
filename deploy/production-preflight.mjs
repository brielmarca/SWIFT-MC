import { assertProductionEnvironment } from './production-config.ts';
import process from 'node:process';
import console from 'node:console';
try { assertProductionEnvironment(process.env); }
catch { console.error('Production configuration validation failed.'); process.exit(1); }
