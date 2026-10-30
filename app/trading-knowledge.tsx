"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { newId, type DisciplineBook } from "@/lib/trading-discipline";
import { defaultKnowledge, moveKnowledge, type KnowledgeItem, type KnowledgeSection } from "@/lib/trading-knowledge";

export function TradingKnowledge({book,onChange,dirty,onSave,conflict,onLoadRemote,onOverwrite,date,riskSummary,onRiskSummary}:{book:DisciplineBook;onChange:(book:DisciplineBook)=>void;dirty:boolean;onSave:()=>void;conflict:boolean;onLoadRemote:()=>void;onOverwrite:()=>void;date:string;riskSummary:string;onRiskSummary:(value:string)=>void}) {
  const knowledge=book.knowledge??defaultKnowledge();
  const [editing,setEditing]=useState("");
  const [drag,setDrag]=useState<{section:KnowledgeSection;id:string}|null>(null);
  const [deleted,setDeleted]=useState<{section:KnowledgeSection;item:KnowledgeItem;index:number}|null>(null);
  const update=(section:KnowledgeSection,items:KnowledgeItem[])=>onChange({...book,knowledge:{...knowledge,[section]:items}});
  const add=(section:KnowledgeSection)=>{const id=newId();const content=section==="notes"?"新操盘知识点":"新交易风险";update(section,[...knowledge[section],{id,content}]);setEditing(`${section}:${id}`);};
  const move=(section:KnowledgeSection,from:string,to:string)=>onChange({...book,knowledge:moveKnowledge(knowledge,section,from,to)});
  const renderSection=(section:KnowledgeSection)=><div className="knowledge-grid" data-section={section}>{knowledge[section].map((item,index)=>{
    const active=editing===`${section}:${item.id}`, [title,...lines]=item.content.split("\n");
    return <article className="knowledge-item" key={item.id} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();try{const source=JSON.parse(event.dataTransfer.getData("application/json")||"null")||drag;if(source?.section===section&&typeof source.id==="string")move(section,source.id,item.id);}catch{/* External text is not a knowledge item. */}setDrag(null);}}>
      <div className="knowledge-toolbar"><button type="button" className="knowledge-drag" draggable title="拖拽排序" aria-label={`拖拽排序 ${title}`} onDragStart={event=>{const source={section,id:item.id};setDrag(source);event.dataTransfer.setData("application/json",JSON.stringify(source));event.dataTransfer.effectAllowed="move";}} onDragEnd={()=>setDrag(null)}>⠿ <small>{index+1}</small></button><div><button type="button" disabled={index===0} aria-label={`上移 ${title}`} onClick={()=>move(section,item.id,knowledge[section][index-1].id)}>↑</button><button type="button" disabled={index===knowledge[section].length-1} aria-label={`下移 ${title}`} onClick={()=>move(section,item.id,knowledge[section][index+1].id)}>↓</button><button type="button" onClick={()=>{setEditing(active?"":`${section}:${item.id}`);}}>{active?"完成编辑":"编辑"}</button><button type="button" onClick={()=>{setDeleted({section,item,index});update(section,knowledge[section].filter(value=>value.id!==item.id));}}>删除</button></div></div>
      {active?<Textarea autoFocus className="knowledge-editor" aria-label={section==="notes"?"知识点内容":"交易风险内容"} value={item.content} onChange={event=>{update(section,knowledge[section].map(value=>value.id===item.id?{...value,content:event.target.value}:value));}}/>:<div className="knowledge-copy"><strong>{title||"待补充"}</strong>{lines.length>0&&<p>{lines.join("\n")}</p>}</div>}
    </article>;
  })}{!knowledge[section].length&&<p className="premium-source">暂无内容，点击增加即可补充。</p>}</div>;
  return <div className="workflow knowledge-board space-y-4"><Card><CardHeader className="history-head"><div><CardTitle>操盘小知识</CardTitle><p>我的经验笔记 · 待验证。紧凑展示，点击编辑，拖拽排序。</p></div><div className="workflow-actions"><Button variant="outline" onClick={()=>add("notes")}>增加知识点</Button><Button onClick={onSave}>{dirty?"保存知识修改":"知识已保存"}</Button></div></CardHeader><CardContent className="space-y-4">
    {conflict&&<div className="conflict-row"><div><strong>另一台设备更新了纪律或知识</strong><p>本页修改仍保留，请选择版本。</p></div><Button variant="outline" onClick={()=>{setEditing("");onLoadRemote();}}>载入远端知识</Button><Button variant="destructive" onClick={onOverwrite}>提交本页知识版本</Button></div>}
    {deleted&&<Button size="sm" variant="outline" onClick={()=>{const items=[...knowledge[deleted.section]];items.splice(deleted.index,0,deleted.item);update(deleted.section,items);setDeleted(null);}}>撤销上次删除</Button>}
    {renderSection("notes")}
  </CardContent></Card><Card><CardHeader className="history-head"><div><CardTitle>交易风险</CardTitle><p>财报、外围事件与跨市场风险提示。此处是可编辑观察清单，不是实时新闻或行情。</p></div><Button variant="outline" onClick={()=>add("risks")}>增加风险点</Button></CardHeader><CardContent className="space-y-4">
    {renderSection("risks")}
    <details className="daily-risk-summary"><summary>{date} · 当日风险汇总</summary><label className="field"><span>事件与时间 → 信息来源 → 受影响持仓/候选 → 应对或放弃条件</span><Textarea aria-label="当日风险汇总" value={riskSummary} onChange={event=>onRiskSummary(event.target.value)} placeholder="由我补充已核实的事实、来源和应对；按交易日保存。"/></label></details>
  </CardContent></Card></div>;
}
