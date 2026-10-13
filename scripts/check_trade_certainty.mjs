import assert from "node:assert/strict";
import { certaintyFactors, certaintyPlanIssues, expectancyScenario, panicConditions, readCertaintyCases } from "../lib/trade-certainty.ts";

const planned = { entryMechanism: "龙头分歧转一致", certaintyExecutable: "已评估并接受限制", certaintyExecutionEvidence: "人工评估T+1、滑点与无法成交情景" };
for (const factor of certaintyFactors) {
  planned[`certainty_${factor.id}_status`] = "支持";
  planned[`certainty_${factor.id}_evidence`] = "测试当时可见证据";
}
assert.deepEqual(certaintyPlanIssues(planned), []); // Unknown win rate is not replaced with a guess.
assert.ok(certaintyPlanIssues({}).length); // Missing legacy fields cannot pass new checks.
for (const factor of certaintyFactors) {
  assert.ok(certaintyPlanIssues({ ...planned, [`certainty_${factor.id}_status`]: "否决" }).length);
  assert.ok(certaintyPlanIssues({ ...planned, [`certainty_${factor.id}_evidence`]: " " }).length);
}
assert.ok(certaintyPlanIssues({ ...planned, certaintyExecutable: "不可执行" }).length);
assert.ok(certaintyPlanIssues({ ...planned, entryMechanism: "其他（说明）" }).length);
assert.deepEqual(certaintyPlanIssues({ ...planned, entryMechanism: "其他（说明）", entryMechanismOther: "已有监管套利模式与事件风险" }), []);
const panic = { ...planned, entryMechanism: "极致恐慌低吸", panicAverageBasis: "统一不复权口径，动态MA30、观察日期与来源" };
assert.equal(certaintyPlanIssues(panic).length, 5);
for (const condition of panicConditions) {
  panic[`panic_${condition.id}_status`] = "满足";
  panic[`panic_${condition.id}_evidence`] = "可核对证据";
}
assert.deepEqual(certaintyPlanIssues(panic), []);
assert.ok(certaintyPlanIssues({ ...panic, panic_support_status: "不满足" }).length);
assert.ok(certaintyPlanIssues({ ...panic, panicAverageBasis: "" }).length);

assert.equal(expectancyScenario({}), null);
for (const invalid of ["", "NaN", "Infinity", "-1", "101"]) assert.equal(expectancyScenario({ certaintyWinPct: invalid, certaintyAverageWinR: "1", certaintyAverageLossR: "3" }), null);
const highWin = expectancyScenario({ certaintyWinPct: "70", certaintyAverageWinR: "1", certaintyAverageLossR: "3", certaintyCostR: "0.1" });
assert.ok(Math.abs(highWin.gross - (-0.2)) < 1e-9); // High win rate can still lose money.
assert.ok(Math.abs(highWin.net - (-0.3)) < 1e-9);
assert.equal(highWin.breakEvenPct, 75);
assert.equal(expectancyScenario({ certaintyWinPct: "70", certaintyAverageWinR: "1", certaintyAverageLossR: "3" }).net, null);
assert.equal(expectancyScenario({ certaintyWinPct: "70", certaintyAverageWinR: "1", certaintyAverageLossR: "0" }), null);
assert.deepEqual(readCertaintyCases("broken-json"), []);
assert.deepEqual(readCertaintyCases('{"stock":"bad-shape"}'), []);
const samples = readCertaintyCases(JSON.stringify([{ stock: "待观察样本", outcome: "", before: "盘前证据" }, { stock: "失败反例", outcome: "均线失守" }]));
assert.equal(samples[0].outcome, "");
assert.equal(samples[1].outcome, "均线失守");
assert.equal(readCertaintyCases(JSON.stringify(Array.from({ length: 7 }, () => ({ stock: "样本" })))).length, 5);
console.log("四要素、低吸条件链、可执行性、假设期望和失败样本检查通过");
