import assert from "node:assert/strict";
import { accountRisk, finiteInput, readResearchSamples, researchSummary } from "../lib/strategy-research.ts";
import { certaintyPlanIssues, certaintyFactors } from "../lib/trade-certainty.ts";

const budget = { currentEquity: "100000", peakEquity: "100000", drawdownStopPct: "3", dailyStopR: "2", realizedR: "0" };
assert.deepEqual(accountRisk(budget).issues, []);
assert.equal(accountRisk(budget).remaining, 3000);
assert.equal(accountRisk({ ...budget, currentEquity: "97000" }).drawdownStopped, true);
assert.equal(accountRisk({ ...budget, currentEquity: "97000.01" }).drawdownStopped, false);
assert.equal(accountRisk({ ...budget, realizedR: "-2" }).dailyStopped, true);
assert.equal(accountRisk({ ...budget, realizedR: "-1.99" }).dailyStopped, false);
for (const raw of ["", "0", "-1", "Infinity", "101"]) assert.ok(accountRisk({ ...budget, drawdownStopPct: raw }).issues.length);
for (const raw of ["", "-100", "Infinity", "101000"]) assert.ok(accountRisk({ ...budget, currentEquity: raw }).issues.length);
assert.ok(accountRisk({ ...budget, riskPerTradePct: "-1" }).issues.length);
assert.ok(accountRisk({ ...budget, dailyStopR: "-2" }).issues.length);
assert.equal(finiteInput(" "), null);
assert.equal(finiteInput("0"), 0);
assert.deepEqual(readResearchSamples("bad json"), []);
assert.deepEqual(readResearchSamples('{"stock":"invalid"}'), []);
assert.deepEqual(readResearchSamples('[null, 2, []]'), []);
const base = { id: "trade-1", stock: "虚拟测试样本", mechanism: "恐慌均线低吸", state: "持仓", pnl: "100", catalyst: "无新增消息" };
const day = (date, rows) => ({ date, fields: { researchSamples: JSON.stringify(rows) } });
const summary = researchSummary([
  day("2026-10-02", [{ ...base, state: "已结束", pnl: "0", mae: "0", days: "2", catalyst: "入场后新增利好" },
    { ...base, id: "trade-2", state: "已结束", pnl: "-50", mae: "4", days: "3" },
    { ...base, id: "trade-3", state: "已结束", pnl: "", mae: "-1", days: "1.5" },
    { ...base, id: "watch", state: "观察中", pnl: "999" }]),
  day("2026-10-01", [base]),
])[0];
assert.equal(summary.total, 4); // Copied stable ID counted once, latest date wins.
assert.equal(summary.closed, 3);
assert.equal(summary.known, 2); // Blank outcome and still-open position excluded.
assert.equal(summary.net, -50);
assert.equal(summary.positive, 0); // Breakeven isn't a profitable trade.
assert.equal(summary.eventCount, 1);
assert.equal(summary.eventNet, 0);
assert.equal(summary.worstMae, 4);
assert.equal(summary.maeCount, 2);
assert.equal(summary.averageDays, 2.5);
assert.equal(summary.daysCount, 2);
const planned = { entryMechanism: "小碎步潜伏", certaintyExecutable: "已评估并接受限制", certaintyExecutionEvidence: "测试可执行性" };
for (const factor of certaintyFactors) {
  planned[`certainty_${factor.id}_status`] = "支持";
  planned[`certainty_${factor.id}_evidence`] = "测试证据";
}
assert.equal(certaintyPlanIssues(planned).length, 4);
const steps = { ...planned, stepsWaitDays: "4", stepsDeadline: "到期重评", stepsPrior: "前序换手", stepsRange: "整理区及量能" };
assert.deepEqual(certaintyPlanIssues(steps), []);
assert.ok(certaintyPlanIssues({ ...steps, stepsWaitDays: "1.5" }).length);
assert.ok(certaintyPlanIssues({ ...planned, entryMechanism: "断板反包", ticketStrategy: "CS-2 小碎步阳线潜伏" }).length);
console.log("回撤与日内闸门、样本去重、收益归因、未知值与小碎步等待条件检查通过");
