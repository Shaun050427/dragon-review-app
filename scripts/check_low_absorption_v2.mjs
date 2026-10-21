import assert from 'node:assert/strict';
import { nominateLeader, strategyOf, researchQualification, entrySignal, readResearchFacts, discoverCandidates, readCalendar } from '../lib/low-absorption.ts';
assert.equal(nominateLeader(4, 5), 'C1');
assert.equal(nominateLeader(5, 0), 'C2');
assert.equal(nominateLeader(1, 6), 'C2');
assert.equal(strategyOf({model:'A1'}), 'S1');
assert.equal(strategyOf({model:'A2'}), 'S2');
assert.equal(strategyOf({model:'B'}), 'trend');
assert.equal(strategyOf({model:'A1',strategy:'S2'}), 'S2');
const a = { strategy:'S1', leaderClass:'C2', averagePeriod:'10', identity:'leader evidence', identityConfirmed:'yes', peers:'yes', low:'8.47', high:'8.60', minuteClose:'8.70', volumeRatio:'1.5', stopped:'yes', firstTouch:'yes', buyMethod:'A', nextHeld:'yes', retest:'absent' };
assert.equal(entrySignal(a).triggered, false); // Five boards do not certify lifecycle.
a.lifecycleEvidence = 'dated repeat attacks, turnover and sector rank'; a.lifecycleConfirmed = 'yes';
assert.equal(researchQualification(a), '身份人工核验已记录');
assert.equal(entrySignal(a).triggered, true);
for(const patch of [{identityConfirmed:'no'},{lifecycleConfirmed:'no'},{lifecycleEvidence:''},{averagePeriod:'30'},{strategy:'S2',averagePeriod:'10'},{leaderClass:'C3'}]) assert.equal(entrySignal({...a,...patch}).triggered,false);
const facts = { ruleVersion:'2.0', leaderClass:'C2', identityStatus:'pending', priority:'pending', limitCount10:6, lastBoard:'2026-10-15', lastActive:'2026-10-16', boardAge:3, activeAge:2, missingIdentitySessions:[], touches:[5,10,20,30].map(period=>({period,touchCount:1,firstTouchDate:'2026-10-19',touching:true,stage:'pending'})) };
assert.ok(readResearchFacts(facts,'2026-10-20'));
for(const patch of [{lastActive:'2026-10-21'},{activeAge:-1},{touches:[null]},{touches:[...facts.touches.slice(0,3),facts.touches[0]]}]) assert.equal(readResearchFacts({...facts,...patch},'2026-10-20'),false);
const sessions = Array.from({length:35},(_,i)=>new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10));
const calendar=readCalendar({schemaVersion:1,source:'synthetic',coveredFrom:sessions[0],coveredThrough:sessions.at(-1),sessions});
const stock={code:'000001',name:'fixture',industry:'fixture',boards:4};
const days=sessions.map(date=>({date,stocks:date===sessions[5]?[stock]:[]}));
assert.equal(discoverCandidates(days,sessions.at(-1),calendar)[0].age,29); // Failures not deleted.
for(const i of [5,6,8,10,12,14]) days[i].stocks=[{...stock,boards:1}];
assert.equal(discoverCandidates(days,sessions.at(-1),calendar)[0].leaderClass,'C2');
assert.equal(discoverCandidates(days,sessions[10],calendar)[0]?.leaderClass,undefined); // Future six-in-ten cannot nominate earlier.
console.log('V2分层、双模型兼容、C2资格、均线约束、过期样本与未来数据校验通过');

const { readStudyReport } = await import('../lib/low-absorption-report.ts');
const emptyStats={samples:0,completed:0,stockClusters:0,winRatePct:null,meanReturnPct:null,payoffRatio:null,expectedR:null,warning:'no samples'};
const report={schemaVersion:1,ruleVersion:'2.0',tradeDate:'2026-10-20',kind:'study',costPct:.2,universeStocks:0,limitations:[],rows:[],missingStocks:[],groups:[],descriptive:emptyStats,executable:emptyStats};
assert.ok(readStudyReport(report,'2026-10-20'));
for(const patch of [{tradeDate:'2026-10-21'},{groups:[null]},{missingStocks:[null]},{descriptive:{...emptyStats,winRatePct:'100'}},{executable:{...emptyStats,completed:1}},{costPct:Infinity}]) assert.equal(readStudyReport({...report,...patch},'2026-10-20'),null);
