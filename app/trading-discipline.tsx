"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { moveRule, newId, safeCaseUrl, type ClassicCase, type Discipline, type DisciplineBook } from "@/lib/trading-discipline";
import type { TradingCalendar } from "@/lib/low-absorption";
import { repairStatus, type ExecutionSample } from "@/lib/candidate-workflow";

export function TradingDiscipline({book,onChange,dirty,onSave,conflict,onLoadRemote,onOverwrite,date,calendar,samples}:{book:DisciplineBook;onChange:(b:DisciplineBook)=>void;dirty:boolean;onSave:()=>void;conflict:boolean;onLoadRemote:()=>void;onOverwrite:()=>void;date:string;calendar:TradingCalendar|null;samples:ExecutionSample[]}) {
  const [drag,setDrag]=useState("");
  const [editing,setEditing]=useState("");
  const [editingText,setEditingText]=useState("");
  const [caseRule,setCaseRule]=useState("");
  const [editingCase,setEditingCase]=useState("");
  const [deleted,setDeleted]=useState<{rule:Discipline;index:number}|null>(null);
  const change=(id:string,patch:Partial<Discipline>)=>onChange({...book,rules:book.rules.map(r=>r.id===id?{...r,...patch}:r)});
  const changeCase=(r:Discipline,id:string,patch:Partial<ClassicCase>)=>change(r.id,{cases:r.cases.map(c=>c.id===id?{...c,...patch}:c)});
  const addCase=(r:Discipline,s?:ExecutionSample)=>{
    const id=newId();
    change(r.id,{cases:[...r.cases,{id,title:s?`${s.name} · ${s.mode==="live"?"实盘":"模拟"}`:"新经典案例",date:s?date:"",stock:s?.name||"",pattern:s?.strategy||"",facts:s?.evidence||"",planned:s?`首次信号 ${s.signalTime} / ${s.signalPrice}`:"",actual:s?`发现 ${s.seenTime} / ${s.seenPrice}；成交 ${s.fillTime} / ${s.fillPrice}`:"",lesson:s?.review||"",sourceUrl:"",imageUrl:""}]});
    setCaseRule(r.id);setEditingCase(id);
  };
  const status=repairStatus(book,date,calendar);
  return <div className="space-y-4 workflow discipline-board">
    <Card><CardHeader className="history-head"><div><CardTitle>交易纪律 · 我的规则与经典案例</CardTitle><p>纪律内容 + 经典案例。拖拽排序，点击编辑。</p></div><div className="workflow-actions"><Button variant="outline" onClick={()=>{const id=newId();onChange({...book,rules:[...book.rules,{id,title:"新交易纪律",detail:"",required:false,cases:[]}]});setEditing(id);setEditingText("新交易纪律");}}>增加交易纪律</Button><Button onClick={onSave}>{dirty?"保存纪律修改":"纪律已保存"}</Button></div></CardHeader><CardContent>
      {conflict && <div className="conflict-row"><div><strong>另一台设备更新了交易纪律</strong><p>本页修改仍保留。先选择要保留的版本。</p></div><Button onClick={()=>{setEditing("");onLoadRemote();}} variant="outline">载入远端纪律</Button><Button onClick={onOverwrite} variant="destructive">提交本页纪律版本</Button></div>}
      {deleted && <Button variant="outline" size="sm" onClick={()=>{const rules=[...book.rules];rules.splice(deleted.index,0,deleted.rule);onChange({...book,rules});setDeleted(null);}}>撤销上次删除</Button>}
      {!book.rules.length && <p>还没有纪律，可从自己的执行记录开始整理。</p>}
      <div className="discipline-list">{book.rules.map((r,i)=><article className="discipline-rule compact-rule" key={r.id} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData("text/plain")||drag;onChange(moveRule(book,id,r.id));setDrag("");}}>
        <button type="button" className="drag-handle" draggable onDragStart={e=>{setDrag(r.id);e.dataTransfer.setData("text/plain",r.id);e.dataTransfer.effectAllowed="move";}} onDragEnd={()=>setDrag("")} aria-label={`拖拽排序 ${r.title}`} title="拖拽排序">⠿<small>{i+1}</small></button>
        <div className="discipline-content">{editing===r.id?<label className="field"><span className="sr-only">纪律内容</span><Textarea className="discipline-content-editor" aria-label="纪律内容" rows={2} autoFocus value={editingText} onChange={e=>{setEditingText(e.target.value);const [title,...detail]=e.target.value.split("\n");change(r.id,{title,detail:detail.join("\n")});}}/></label>:<p><strong>{r.title||"未命名纪律"}</strong>{r.detail&&<span>{r.detail}</span>}</p>}</div>
        <div className="discipline-case-links"><button type="button" className="case-toggle" onClick={()=>setCaseRule(caseRule===r.id?"":r.id)} aria-expanded={caseRule===r.id} aria-label={`经典案例 ${r.title}`}>经典案例{r.cases.length?`（${r.cases.length}）`:""}</button>{r.cases.length>0&&<span className="case-preview">{r.cases.map(c=>c.title||"未命名案例").join("、")}</span>}<button type="button" className="case-add" onClick={()=>addCase(r)}>附加经典案例</button></div>
        <div className="discipline-row-actions"><button type="button" onClick={()=>{setEditing(editing===r.id?"":r.id);setEditingText([r.title,r.detail].filter(Boolean).join("\n"));}}>{editing===r.id?"完成编辑":"编辑纪律"}</button><button type="button" disabled={i===0} aria-label={`上移 ${r.title}`} title="上移" onClick={()=>onChange(moveRule(book,r.id,book.rules[i-1].id))}>↑</button><button type="button" disabled={i===book.rules.length-1} aria-label={`下移 ${r.title}`} title="下移" onClick={()=>onChange(moveRule(book,r.id,book.rules[i+1].id))}>↓</button><button type="button" className="rule-delete" onClick={()=>{setDeleted({rule:r,index:i});onChange({...book,rules:book.rules.filter(x=>x.id!==r.id)});}}>删除纪律</button></div>
        {caseRule===r.id&&<div className="discipline-case-panel"><details><summary>关联已有执行记录</summary><div className="workflow-actions">{samples.map(s=><Button key={s.id} size="sm" variant="outline" onClick={()=>addCase(r,s)}>{s.name} {s.signalTime} · {s.mode==="live"?"实盘":"模拟"}</Button>)}{!samples.length&&<p>当前日期暂无执行记录，可直接附加案例。</p>}</div></details>
          {!r.cases.length&&<p className="premium-source">暂无经典案例。</p>}
          {r.cases.map(c=><section key={c.id} className="classic-case"><div className="workflow-actions"><strong>{c.title||"未命名案例"}</strong><small>{[c.date,c.stock,c.pattern].filter(Boolean).join(" · ")}</small><Button size="sm" variant="ghost" onClick={()=>setEditingCase(editingCase===c.id?"":c.id)}>{editingCase===c.id?"收起案例编辑":"编辑案例"}</Button></div>
            {editingCase===c.id?<div className="form-grid two">{([["title","案例标题"],["date","案例日期"],["stock","股票"],["pattern","模式"]] as const).map(([k,label])=><label className="field" key={k}><span>{label}</span><Input type={k==="date"?"date":"text"} value={c[k]} onChange={e=>changeCase(r,c.id,{[k]:e.target.value})}/></label>)}{([["facts","当时事实与来源"],["planned","计划买点"],["actual","实际执行"],["lesson","教训与适用边界"],["sourceUrl","案例来源链接"],["imageUrl","截图链接（http/https）"]] as const).map(([k,label])=><label className="field" key={k}><span>{label}</span><Textarea value={c[k]} onChange={e=>changeCase(r,c.id,{[k]:e.target.value})}/></label>)}</div>:<div className="case-facts">{([["facts","事实"],["planned","计划"],["actual","执行"],["lesson","教训"]] as const).map(([k,label])=>c[k]&&<p key={k}><b>{label}：</b>{c[k]}</p>)}</div>}
            <div className="workflow-actions">{safeCaseUrl(c.sourceUrl)&&<a href={safeCaseUrl(c.sourceUrl)!} target="_blank" rel="noreferrer">打开来源</a>}{safeCaseUrl(c.imageUrl)&&<a href={safeCaseUrl(c.imageUrl)!} target="_blank" rel="noreferrer">查看截图</a>}<Button variant="ghost" size="sm" onClick={()=>change(r.id,{cases:r.cases.filter(x=>x.id!==c.id)})}>删除案例</Button></div>
          </section>)}
        </div>}
      </article>)}</div>
    </CardContent></Card>
    <details className="repair-settings"><summary>五个交易日 · 修复期设置</summary><Card><CardHeader><CardTitle>执行修复实验</CardTitle><p>设置开始日后按真实交易日计数。计划风险不保证隔夜跳空、跌停时的实际损失。</p></CardHeader><CardContent className="space-y-4"><label><input type="checkbox" checked={book.repair.enabled} onChange={e=>onChange({...book,repair:{...book.repair,enabled:e.target.checked}})}/> 启用修复期约束</label><div className="form-grid two">{([["startDate","修复开始日","date"],["riskCap","单笔计划风险上限 %（≤1）","number"],["positionCap","单票集中度上限 %（自行设定）","number"],["maxNewPositions","每天最多新增笔数（修复期为1）","number"]] as const).map(([k,label,type])=><label className="field" key={k}><span>{label}</span><Input type={type} step={type==="number"?"any":undefined} value={book.repair[k]} onChange={e=>onChange({...book,repair:{...book.repair,[k]:e.target.value}})}/></label>)}</div><p>{!book.repair.startDate?"尚未设置开始日。":status.covered?`已覆盖${status.count}个交易日；${status.active?"修复约束生效":"当前日期不在五日修复期"}。` : "日历暂未覆盖计数区间，不能当作已完成五日；到开始日后按修复约束保守处理。"}</p></CardContent></Card></details>
  </div>;
}
