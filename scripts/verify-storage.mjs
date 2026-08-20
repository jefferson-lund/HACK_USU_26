// Regression guard for the storage layer.
//
// generateDummyData's range ends TODAY, so "Generate sample data" overlaps
// whatever the user has actually logged. populateDummyData used to overwrite
// those rows and mark them synthetic, so "Delete Sample Data" then destroyed
// real check-ins -- while reporting that it had kept them.
//
// Run with: npm run verify:storage
import { createRequire } from 'module';
globalThis.require = createRequire(import.meta.url);
import * as db from '../lib/database.web.ts';
import { generateDummyData } from '../lib/analysis.ts';
import { dateKey } from '../lib/dateKey.ts';

let fail = 0;
const check = (n, c, d='') => { console.log(`${c?'PASS':'FAIL'}  ${n}${d?'  -- '+d:''}`); if(!c) fail++; };

const today = dateKey();
await db.initDatabase();
await db.saveSetup('sleep better', ['Gym', 'Water']);

// A REAL check-in today
await db.logActivity('Gym', true, today);
await db.logOutcomeRating(9, today);
check('real check-in recorded', (await db.getOutcomeRating(today)) === 9);

// Generate sample data whose range ends today
const dummy = generateDummyData(6, ['Gym', 'Water']);
const { inserted, skipped } = await db.populateDummyData(dummy);
check('sample generation skipped the real day', skipped >= 1, `inserted=${inserted} skipped=${skipped}`);
check('real rating survived generation', (await db.getOutcomeRating(today)) === 9,
      `got ${await db.getOutcomeRating(today)}`);

// Now delete the sample data -- the real check-in must remain
await db.clearSyntheticData();
const after = await db.getOutcomeRating(today);
check('real rating survived Delete Sample Data', after === 9, `got ${after}`);
const logs = await db.getActivityLogs(today);
check('real activity survived Delete Sample Data', logs.Gym === true, JSON.stringify(logs));

const ds = await db.getFullDataset();
check('sample rows are gone', ds.filter(r => r.outcome !== null).length === 1,
      `${ds.filter(r=>r.outcome!==null).length} rated rows remain`);

console.log(fail ? `\n${fail} FAILED` : '\nreal check-ins survive sample generation + deletion');
process.exit(fail ? 1 : 0);
