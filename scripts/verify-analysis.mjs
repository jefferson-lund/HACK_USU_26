// Regression guard for lib/analysis.ts.
//
// The "Next-day" lag once reported the OPPOSITE sign from the truth, because
// getFullDataset() returns rows newest-first while the lag pairing assumes
// oldest-first. That is invisible in the UI -- it just quietly tells you an
// activity hurts when it helps -- so it gets a test.
//
// Run with: npm run verify:analysis
import { createRequire } from 'module';
// analysis.ts uses require() for ml-regression; Metro handles that, plain ESM does not.
globalThis.require = createRequire(import.meta.url);
import { getRegressionAnalysis } from '../lib/analysis.ts';

let fail = 0;
const check = (name, cond, detail='') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
  if (!cond) fail++;
};

// --- next-day effect: walk[N] -> high outcome[N+1]
const walk = {1:1,2:1,3:0,4:0,5:0,6:1,7:0,8:0};
const out  = {1:5,2:10,3:10,4:1,5:1,6:1,7:10,8:1};
const asc = Array.from({length:8},(_,i)=>({date:`2026-08-0${i+1}`,activities:{walk:!!walk[i+1]},outcome:out[i+1]}));
const desc = [...asc].reverse();

const lagDesc = getRegressionAnalysis(desc, true);
const lagAsc  = getRegressionAnalysis(asc, true);
check('next-day: DESC input gives positive', lagDesc.impacts[0].coefficient > 0.9, `coeff=${lagDesc.impacts[0].coefficient.toFixed(3)}`);
check('next-day: order-independent', Math.abs(lagDesc.impacts[0].coefficient - lagAsc.impacts[0].coefficient) < 1e-9);

// --- same-day effect: walk[N] -> high outcome[N] (must NOT be broken by the sort)
const sameAsc = Array.from({length:8},(_,i)=>({date:`2026-09-0${i+1}`,activities:{walk:i%3===0},outcome:i%3===0?10:1}));
const sd = getRegressionAnalysis([...sameAsc].reverse(), false);
check('same-day: still positive', sd.impacts[0].coefficient > 0.9, `coeff=${sd.impacts[0].coefficient.toFixed(3)}`);

// --- dates array
check('lag: dates length == sampleSize', lagDesc.dates.length === lagDesc.sampleSize, `${lagDesc.dates.length} vs ${lagDesc.sampleSize}`);
check('lag: drops one row (7 of 8)', lagDesc.sampleSize === 7);
check('lag: first date is day 2, not day 1', lagDesc.dates[0] === '2026-08-02', `got ${lagDesc.dates[0]}`);
check('lag: last date is day 8', lagDesc.dates[6] === '2026-08-08', `got ${lagDesc.dates[6]}`);
check('same-day: dates match their own rows', sd.dates[0] === '2026-09-01' && sd.dates.length === 8, `got ${sd.dates[0]}, len ${sd.dates.length}`);

// --- regression path (>=10 rows) keeps predictions/actuals/dates aligned
const big = Array.from({length:40},(_,i)=>({
  date:`2026-10-${String(i+1).padStart(2,'0')}`,
  activities:{walk:i%2===0, sleep:i%3===0},
  outcome:(i%2===0?7:3)+(i%3===0?2:0),
}));
const r = getRegressionAnalysis([...big].reverse(), true);
check('regression method used at 40 rows', r.method === 'multiple-regression', r.method);
check('regression: predictions/actuals/dates all same length',
  r.predictions.length === r.actuals.length && r.actuals.length === r.dates.length, `${r.predictions.length}/${r.actuals.length}/${r.dates.length}`);
check('regression: dates ascending', r.dates.every((d,i)=>i===0||r.dates[i-1]<d));
check('regression: actuals[i] is the outcome on dates[i]', r.actuals.every((a,i)=>{
  const row = big.find(b=>b.date===r.dates[i]); return row && row.outcome===a;
}));

console.log(fail ? `\n${fail} FAILED` : '\nall analysis checks pass');
process.exit(fail ? 1 : 0);
