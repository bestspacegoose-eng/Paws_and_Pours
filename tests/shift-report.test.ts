import test from "node:test";
import assert from "node:assert/strict";
import { freshShiftStats, shiftAdvice, type ShiftReport } from "../shared/hospitality.js";
import { shiftReportContent } from "../client/shift-report.js";
import { keepsakeDetail } from "../shared/keepsakes.js";

test("the report shows shift earnings and actual preparation work rather than cumulative scores",()=>{
  const stats=freshShiftStats();Object.assign(stats,{served:5,perfect:3,specials:2,coinsEarned:58,missed:1,hazardsCleaned:2});
  stats.bartenders={a:{name:"Mittens",gathered:6,chopped:2,mixed:1,served:0},b:{name:"Juniper",gathered:0,chopped:0,mixed:4,served:5}};
  const report:ShiftReport={round:2,theme:"Pirate Cat Tavern",stats,celebrationCount:1,health:2,completed:true};
  const content=shiftReportContent(report);
  assert.deepEqual(content.metrics,[["Guests served",5],["Perfect drinks",3],["House Specials",2],["Coins earned",58]]);
  assert.deepEqual(content.work,[{name:"Mittens",description:"6 gathered · 2 chopped · 1 mixed"},{name:"Juniper",description:"4 mixed · 5 served"}]);
  assert.match(content.advice,/shortest patience/);assert.match(content.note,/1 tavern toast/);
});
test("shift guidance responds to the actual area for improvement",()=>{
  const stats=freshShiftStats();assert.match(shiftAdvice(stats),/one ticket/);
  stats.served=1;assert.match(shiftAdvice(stats),/target line/);
  stats.perfect=1;assert.match(shiftAdvice(stats),/House Special/);
  stats.soloSpecials=1;assert.match(shiftAdvice(stats),/Keep that rhythm/);
});
test("keepsake explanations state the actual next-shift effect and immediate healing",()=>{
  assert.match(keepsakeDetail("swift-paws",2),/20%/);assert.match(keepsakeDetail("patient-patrons",2),/12 seconds/);
  assert.match(keepsakeDetail("bottomless-bag",2),/keeps the spare/);assert.match(keepsakeDetail("lucky-whiskers",2),/2 extra coins/);
  assert.match(keepsakeDetail("nine-lives",1),/1 → 2/);assert.match(keepsakeDetail("nine-lives",3),/3 → 3/);
});
