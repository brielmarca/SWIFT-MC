import { assertStagingEnvironment } from './staging-config.ts';
import process from 'node:process';
import console from 'node:console';
try { assertStagingEnvironment(process.env); }
catch (error) { console.error(error.message); process.exit(1); }
