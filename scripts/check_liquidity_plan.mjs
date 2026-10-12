import assert from "node:assert/strict";
import { liquidityPlanIssues, sameTimeVolumeRatio } from "../lib/liquidity-plan.ts";

const planned = {
  liquidityEnvironment: "缩量但承接稳定", liquidityTime: "10:30", liquidityReferenceTime: "10:30",
  liquidityAmount: "8000", liquidityReferenceAmount: "10000", liquidityBasis: "前一交易日同时间，沪深A股",
  liquiditySource: "人工核对终端，数据截至10:30", liquidityEvidence: "核心承接稳定、同伴未转弱",
  liquidityBuyPlan: "只观察核心的承接后转强；失效后暂停", exitThesis: "超跌反抽",
  ticketStock: "测试标的", ticketStrategy: "LM-1 龙回头", ticketEntry: "回踩后主动转强",
  ticketExit: "压力区滞涨按计划兑现", ticketInvalidation: "预定支撑破位且反抽无法收复",
  exitRiskLimit: "预设账户风险预算", exitReducePct: "50", exitRemainder: "原逻辑失效退出可卖仓位",
  holdingConditions: "原逻辑、相对强弱和风险预算仍成立",
};

assert.equal(sameTimeVolumeRatio(planned), 0.8);
assert.deepEqual(liquidityPlanIssues(planned), []); // Shrinkage alone does not deny a trade.
assert.equal(sameTimeVolumeRatio({ ...planned, liquidityReferenceTime: "15:00" }), null);
for (const value of ["", "0", "-1", "Infinity", "not-a-number"]) {
  assert.equal(sameTimeVolumeRatio({ ...planned, liquidityReferenceAmount: value }), null);
  assert.ok(liquidityPlanIssues({ ...planned, exitReducePct: value }).length);
}
assert.ok(liquidityPlanIssues({}).length); // Legacy records do not silently pass new gates.
for (const key of ["ticketExit", "ticketInvalidation", "exitRiskLimit", "holdingConditions", "liquidityBuyPlan", "liquiditySource"]) {
  assert.ok(liquidityPlanIssues({ ...planned, [key]: " " }).length, `${key} cannot be blank`);
}
assert.ok(liquidityPlanIssues({ ...planned, exitReducePct: "101" }).length);
assert.deepEqual(liquidityPlanIssues({ ...planned, exitReducePct: "100" }), []);
assert.ok(liquidityPlanIssues({ ...planned, liquidityEnvironment: "缩量且负反馈扩大" }).some((issue) => issue.includes("暂停")));
assert.deepEqual(liquidityPlanIssues({ ...planned, liquidityEnvironment: "缩量且资金集中" }), []);
for (const holdingStage of ["原理由失效", "风险上限触发"]) {
  assert.ok(liquidityPlanIssues({ ...planned, holdingStage }).some((issue) => issue.includes("新增仓位")));
}
assert.deepEqual(liquidityPlanIssues({ ...planned, liquidityEnvironment: "缩量且负反馈扩大", exitThesis: "事件套利" }), []); // Still subject to the existing environment checks.
console.log("量能口径、旧记录、退出卡缺项与情绪接力否决检查通过");
