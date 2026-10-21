import assert from "node:assert/strict";
import { readCalendar, tradingAge, scanDates, readArchive, discoverCandidates, memoryWindow, entrySignal, riskPlan, readWatchlist, stockFields, numeric, readRadar } from "../lib/low-absorption.ts";

// Holiday + weekend + missing archive: calendar time cannot shrink to archive time.
const calendar = readCalendar({ schemaVersion: 1, source: "fixture actual sessions", coveredFrom: "2026-09-30", coveredThrough: "2026-10-21", sessions: ["2026-09-30", "2026-10-09", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-19", "2026-10-20", "2026-10-21"] });
assert.ok(calendar);
assert.equal(tradingAge("2026-10-15", "2026-10-20", calendar), 3);
assert.equal(tradingAge("2026-09-30", "2026-10-09", calendar), 1);
assert.equal(tradingAge("2026-10-15", "2026-10-22", calendar), null);
assert.equal(tradingAge("2026-10-17", "2026-10-20", calendar), null);
assert.equal(readCalendar({ ...calendar, sessions: ["2026-02-30"] }), null);
assert.equal(readCalendar({ ...calendar, sessions: [...calendar.sessions].reverse() }), null);
assert.equal(readCalendar({ ...calendar, sessions: ["2026-10-15", "2026-10-15"] }), null);
const stock = { code: "000001", name: "fixture", industry: "fixture", boards: 4 };
const archive = (d, stocks) => readArchive({ schemaVersion: 1, tradeDate: d, stocks }, d);
assert.equal(readArchive({ schemaVersion: 1, tradeDate: "bad", stocks: [] }, "2026-10-20"), null);
assert.equal(archive("2026-10-15", [{ ...stock, boards: Infinity }]), null);
assert.equal(archive("2026-10-15", [stock, stock]), null);
const days = [archive("2026-10-15", [stock]), archive("2026-10-20", [])];
const pool = discoverCandidates(days, "2026-10-20", calendar);
assert.equal(pool[0].age, 3); // Missing 16th & 19th are still sessions.
assert.equal(pool[0].missingAfter, 2);
assert.equal(discoverCandidates(days, "2026-10-20", null)[0].age, null);
assert.equal(discoverCandidates([...days, archive("2026-10-21", [stock])], "2026-10-20", calendar)[0].lastBoard, "2026-10-15");
assert.equal(discoverCandidates([archive("2026-10-15", [stock])], "2026-10-15", calendar)[0].age, 0);
assert.equal(memoryWindow(0), "预备池：当日涨停");
assert.equal(memoryWindow(16), "扩展：16—20日（C2待核）");
assert.equal(scanDates("2026-02-30", null).length, 0);
assert.equal(scanDates("2026-10-20", calendar)[0], "2026-10-20");
for (const invalid of ["", " ", "NaN", "Infinity"]) assert.equal(numeric(invalid), null);

const a = { model: "A1", identity: "fixture market leader", peers: "yes", low: "8.47", high: "8.60", minuteClose: "8.70", volumeRatio: "1.5", stopped: "yes", firstTouch: "yes", buyMethod: "A", nextHeld: "yes", retest: "absent" };
assert.ok(entrySignal(a).triggered); // A may legitimately lack an L retest.
for (const patch of [{ nextHeld: "" }, { stopped: "" }, { firstTouch: "no" }, { retest: "failed" }, { minuteClose: "8.60" }, { volumeRatio: "1.49" }, { low: "Infinity" }, { high: "8.00" }, { peers: "no" }, { model: "" }]) assert.equal(entrySignal({ ...a, ...patch }).triggered, false);
const b = { ...a, buyMethod: "B", retest: "passed", pullbackLow: "8.60", reboundHigh: "8.65", pullbackHeld: "yes", pullbackVolume: "yes" };
assert.ok(entrySignal(b).triggered);
for (const patch of [{ pullbackLow: "8.40" }, { pullbackLow: "8.90" }, { reboundHigh: "8.71" }, { pullbackVolume: "no" }, { pullbackHeld: "" }, { retest: "absent" }]) assert.equal(entrySignal({ ...b, ...patch }).triggered, false);
const risk = { equity: "165000", riskPct: "1", positionCap: "20", entry: "10", stop: "9.5", target: "11", costPct: "0.1" };
const plan = riskPlan(risk);
assert.ok(plan.amount <= 33000 && plan.plannedLoss <= 1650 && plan.shares % 100 === 0);
assert.equal(riskPlan({ ...risk, stop: "10" }), null);
assert.equal(riskPlan({ ...risk, equity: "Infinity" }), null);
assert.equal(riskPlan({ ...risk, costPct: "" }), null);
assert.equal(riskPlan({ ...risk, riskPct: "0.001" }).shares, 0); // No forced one-lot trade over budget.
const data = { funnel_000001_low: "8.47", funnel_000002_low: "17", funnelLow: "99" };
assert.deepEqual(stockFields(data, "000001"), { low: "8.47" });
assert.deepEqual(readWatchlist("bad"), []);
assert.equal(readWatchlist(JSON.stringify([{ code: "000001", name: "one" }, { code: "000001", name: "dup" }, { code: "bad", name: "bad" }])).length, 1);
console.log("低吸漏斗：交易日/节假日/归档缺口、A/B买点、预算边界与串股隔离检查通过");

assert.equal(readRadar({ schemaVersion: 1, tradeDate: "2026-10-20", stocks: [{ code: "000001", averages: [null] }] }, "2026-10-20"), null);
assert.equal(readRadar({ schemaVersion: 1, tradeDate: "2026-10-19" }, "2026-10-20"), null);
