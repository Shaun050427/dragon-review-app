import type { TradingCalendar } from "./low-absorption";
export function preparationWindow(executionDate:string,calendar:TradingCalendar|null,now=new Date(),asOf?:string) {
  const china=new Date(now.getTime()+8*3600000),today=china.toISOString().slice(0,10);
  const previous=(date:string)=>new Date(Date.parse(date+"T00:00:00Z")-86400000).toISOString().slice(0,10);
  const completedThrough=china.getUTCHours()>=15?today:previous(today);
  const cutoff=[previous(executionDate),completedThrough].sort()[0];
  if(!calendar||calendar.coveredThrough<cutoff)return {sessions:[] as string[],expected:"",warning:`交易日历${calendar?`仅覆盖至 ${calendar.coveredThrough}`:"尚不可用"}，无法确认 ${cutoff} 前的最新已收盘交易日；暂停使用旧候选。`};
  const eligible=calendar.sessions.filter(d=>d<executionDate&&d<=completedThrough),expected=eligible.at(-1)||"";
  const sessions=eligible.filter(d=>!asOf||d<=asOf).slice(-5);
  return {sessions,expected,warning:asOf&&sessions.at(-1)!==expected?`当前手动截止日早于应有准备日 ${expected}，请清空截止日恢复自动跟随。`:""};
}
