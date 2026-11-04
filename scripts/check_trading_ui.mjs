// Full dashboard integration. All GitHub/public requests use synthetic fixtures.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve as resolvePath } from 'node:path';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { defaultBook } from '../lib/trading-discipline.ts';
import { freezePlan } from '../lib/candidate-workflow.ts';
const rootDir=fileURLToPath(new URL('../',import.meta.url));
registerHooks({resolve(spec,context,next){if(spec.startsWith('@/'))return {url:pathToFileURL(resolvePath(rootDir,spec.slice(2)+(spec.endsWith('.ts')||spec.endsWith('.tsx')?'':spec.startsWith('@/lib/')?'.ts':'.tsx'))).href,shortCircuit:true};return next(spec,context);},load(url,context,next){if(url.startsWith('file:')&&!url.includes('/node_modules/')&&/\.tsx?$/.test(url)){return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};}return next(url,context);}});
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid/'}),w=dom.window;
for(const k of ['window','document','localStorage','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','Element','Node','MutationObserver','Event','MouseEvent','KeyboardEvent','CustomEvent','DocumentFragment','getComputedStyle'])Object.defineProperty(globalThis,k,{configurable:true,value:w[k]});
for(const k of Object.getOwnPropertyNames(w).filter(k=>/^(HTML|SVG).*Element$/.test(k)))Object.defineProperty(globalThis,k,{configurable:true,value:w[k]});
globalThis.confirm=()=>true;
Object.defineProperty(globalThis,'navigator',{configurable:true,value:w.navigator});globalThis.PointerEvent=w.MouseEvent;w.PointerEvent=w.MouseEvent;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.requestAnimationFrame=fn=>setTimeout(fn,0);globalThis.cancelAnimationFrame=clearTimeout;
globalThis.ResizeObserver=class {observe(){}unobserve(){}disconnect(){}};w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLElement.prototype.hasPointerCapture=()=>false;w.HTMLElement.prototype.releasePointerCapture=()=>{};
const RealDate=Date;let fixed=new RealDate('2026-10-28T10:00:00+08:00').getTime();globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}};
const {act}=await import('react'),{createRoot}=await import('react-dom/client');
const {DashboardClient}=await import('../app/dashboard-client.tsx');
const sessions=['2026-10-21','2026-10-22','2026-10-23','2026-10-26','2026-10-27'];
const calendar={schemaVersion:1,source:'fixture',coveredFrom:sessions[0],coveredThrough:'2026-11-04',sessions:[...sessions,'2026-10-28','2026-10-29','2026-10-30','2026-11-02','2026-11-03','2026-11-04']};
const picks=['000001','000002'].map((code,i)=>({code,name:'候选'+(i+1),queue:'A',strategy:'S1',low:'7',high:'8',trigger:'stop then H',abandon:'sector fail',coreEvidence:'proof',liquidityConfirmed:true,ma5Confirmed:false,rotationEvidence:''}));
const plan=freezePlan('2026-10-28',sessions,[],picks,false,new RealDate('2026-10-27T20:00:00+08:00'));
const book=defaultBook();book.repair.enabled=false;book.rules[0].required=true; // Legacy required flags must no longer add a daily gate.
const fields={candidatePlan:JSON.stringify(plan),candidateDraft:JSON.stringify(picks),plannedCode:'000001',executionCandidate:'候选1',candidate:'候选1',candidate2:'候选2',currentEquity:'100000',startEquity:'100000',peakEquity:'100000',action:'空仓',tradeMode:'空仓观察',riskPerTradePct:'.5',maxPosition:'10',drawdownStopPct:'10',scenarioA:'历史情景保留'};
for(const [k,v] of Object.entries({auction:'yes',auctionEvidence:'auction proof',sector:'yes',sectorEvidence:'peers proof',low:'7.5',high:'7.6',price:'7.7',time:'09:35:00',stopped:'yes',breakout:'yes',evidence:'minute proof'}))fields['execution_000001_'+k]=v;
let doc={schemaVersion:7,updatedAt:'fixture',unknownRoot:{keep:true},disciplineBook:book,records:{'2026-11-03':{payload:{fields:{...fields,candidatePlan:'',candidateDraft:JSON.stringify(picks.map(p=>({...p,theme:'fixture新题材',supportPlan:'VWAP和量能确认',exitPlan:'失效退出'}))),marketTemperature:'震荡/分歧',capitalStyle:'低位新题材',marketContextEvidence:'fixture dated close'},checks:{}},updatedAt:'fixture'},'2026-10-28' :{payload:{fields,checks:{}},updatedAt:'fixture'},'2026-10-27':{payload:{fields:{sentinel:'old-date'},checks:{}},updatedAt:'fixture'}}},sha='sha-0',writes=0,holdWrite=null;
const response=v=>({ok:true,status:200,json:async()=>structuredClone(v)});
let nov3Published=false;
globalThis.fetch=async(input,init={})=>{const url=String(input);if(url.startsWith('https://api.github.com/')){
 if(url.includes('/contents/')){if(init.method==='PUT'){const body=JSON.parse(init.body);assert.equal(body.sha,sha);if(holdWrite){const wait=holdWrite;holdWrite=null;await wait;}doc=JSON.parse(Buffer.from(body.content,'base64').toString('utf8'));sha='sha-'+(++writes);return response({content:{sha},commit:{sha:'commit-'+writes}});}return response({sha,content:Buffer.from(JSON.stringify(doc)).toString('base64')});}return response({default_branch:'main'});
 }if(url.includes('session-calendar.json'))return response(calendar);if(url.includes('trading-calendar.json'))return response(calendar);
 const date=url.match(/daily\/\d{4}\/\d{2}\/(\d{4}-\d{2}-\d{2})\.json/)?.[1];if(date==='2026-11-03')return nov3Published?response({schemaVersion:1,tradeDate:date,stocks:picks.map((p,i)=>({...p,code:'00000'+(i+3),name:'最新候选'+(i+1),industry:'新行业',boards:2,turnover:2e8}))}):{ok:false,status:404};if(date)return response({schemaVersion:1,tradeDate:date,stocks:[sessions.at(-1),'2026-11-02'].includes(date)?picks.map(p=>({code:p.code,name:p.name,industry:'fixture',boards:2,turnover:2e8})):[]});
 return {ok:false,status:404,json:async()=>({})};};
w.localStorage.setItem('ashare_github_config_v1',JSON.stringify({owner:'fixture',repo:'private-fixture',branch:'main',path:'records.json',device:'test'}));w.localStorage.setItem('ashare_github_token_v1','dummy-test-token');
const intervals=[];const realInterval=w.setInterval.bind(w);w.setInterval=(fn,ms,...args)=>{intervals.push({fn,ms});return realInterval(fn,ms,...args);};
const node=createRoot(w.document.getElementById('root'));
async function settle(){await act(async()=>{await new Promise(r=>setTimeout(r,30));});}
async function click(el){assert.ok(el,'click target');await act(async()=>{el.dispatchEvent(new w.MouseEvent('mousedown',{bubbles:true,button:0}));el.click();});await settle();}
const buttons=(text)=>[...w.document.querySelectorAll('button')].filter(b=>b.textContent.trim()===text);
const button=(text)=>buttons(text)[0];
async function input(el,value){assert.ok(el,'input target');await act(async()=>{const proto=el instanceof w.HTMLTextAreaElement?w.HTMLTextAreaElement.prototype:w.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new w.Event('input',{bubbles:true}));el.dispatchEvent(new w.Event('change',{bubbles:true}));});}
try {
 await act(async()=>{node.render((await import('react')).createElement(DashboardClient));});await settle();assert.ok(w.document.body.textContent.includes('盘前有限观察池'));assert.equal(button('今晚计划'),undefined);assert.ok(w.document.body.textContent.includes('账户与风险设置'));
 assert.equal(w.document.querySelectorAll('.candidate-pool-table tbody tr').length,2);
 await click(button('交易纪律'));assert.equal(w.document.querySelectorAll('.compact-rule').length,7);
 assert.equal(w.document.querySelectorAll('.discipline-list input[type="checkbox"]').length,0);
 assert.equal(w.document.querySelectorAll('.discipline-list textarea').length,0); // Read view, not seven permanent forms.
 assert.equal(w.document.body.textContent.includes('执行前必查'),false);
 const editor=()=>w.document.querySelector('textarea[aria-label="纪律内容"]');
 await click(button('增加交易纪律'));assert.equal(w.document.querySelectorAll('.compact-rule').length,8);await input(editor(),'自定义测试纪律\n保留完整内容');
 await click(buttons('附加经典案例').at(-1));let last=w.document.querySelectorAll('.compact-rule')[7];assert.ok(last.textContent.includes('新经典案例'));
 const title=last.querySelector('.classic-case input');await input(title,'保留关联案例');
 const handles=[...w.document.querySelectorAll('.drag-handle')];const transfer={value:'',getData(){return this.value;},setData(_k,v){this.value=v;},effectAllowed:''};
 await act(async()=>{const start=new w.Event('dragstart',{bubbles:true});Object.defineProperty(start,'dataTransfer',{value:transfer});handles[7].dispatchEvent(start);const drop=new w.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(drop,'dataTransfer',{value:transfer});w.document.querySelectorAll('.compact-rule')[0].dispatchEvent(drop);});
 assert.equal(editor().value,'自定义测试纪律\n保留完整内容');assert.ok(w.document.querySelector('.compact-rule').textContent.includes('保留关联案例'));
 await click(button('保存纪律修改'));assert.equal(doc.disciplineBook.rules[0].title,'自定义测试纪律');assert.equal(doc.disciplineBook.rules[0].detail,'保留完整内容');assert.equal(doc.disciplineBook.rules[0].cases[0].title,'保留关联案例');assert.deepEqual(doc.unknownRoot,{keep:true});assert.equal(doc.records['2026-10-27'].payload.fields.sentinel,'old-date');
 await click(button('完成编辑'));assert.ok(w.document.querySelector('.discipline-content').textContent.includes('自定义测试纪律'));
 await click(buttons('删除纪律')[0]);assert.equal(w.document.querySelectorAll('.compact-rule').length,7);await click(button('撤销上次删除'));assert.equal(w.document.querySelectorAll('.compact-rule').length,8);
 await input(w.document.querySelector('#trade-date'),'2026-10-27');assert.ok(w.document.querySelector('.discipline-content').textContent.includes('自定义测试纪律'));await input(w.document.querySelector('#trade-date'),'2026-10-28');
 await click(button('盘中执行'));assert.equal(w.document.body.textContent.includes('必查纪律未核对'),false);assert.equal(w.document.body.textContent.includes('下单授权闸门'),false);assert.equal(w.document.body.textContent.includes('开盘事实与动作'),false);assert.ok(w.document.body.textContent.includes('stop then H'));assert.equal(w.document.querySelectorAll('select[aria-label="冻结名单内选择执行候选"] option').length,3);await click(button('返回盘前候选'));assert.ok(w.document.body.textContent.includes('盘前有限观察池'));await click(button('盘中执行'));await click(button('记录首次合格信号'));assert.ok(button('记录首次合格信号').disabled);assert.ok(w.document.body.textContent.includes('首次信号'));
 await click(button('立即提交'));assert.equal(doc.records['2026-10-28'].payload.fields.executionSamples.includes('09:35:00'),true);assert.equal(doc.records['2026-10-28'].payload.fields.scenarioA,'历史情景保留');
 await click(button('交易纪律'));let r=w.document.querySelector('.compact-rule');await click(r.querySelector('.case-toggle'));await click(r.querySelector('details button'));
 assert.ok(w.document.querySelector('.compact-rule').textContent.includes('候选1 · 模拟'));
 // Simultaneous remote edits are surfaced, local edits survive.
 const remote=structuredClone(doc.disciplineBook);remote.rules[0].title='远端新版本';doc.disciplineBook=remote;sha='remote-new';
 await act(async()=>{await intervals.find(x=>x.ms===30000).fn();});await settle();assert.ok(button('载入远端纪律'));assert.ok(w.document.querySelector('.discipline-content').textContent.includes('自定义测试纪律'));
 await click(button('载入远端纪律'));assert.ok(w.document.querySelector('.discipline-content').textContent.includes('远端新版本'));
 // Edits made during a network save must remain dirty and be saved next.
 await click(buttons('编辑纪律')[0]);await input(editor(),'第一稿');let release;holdWrite=new Promise(r=>release=r);await act(async()=>{button('保存纪律修改').click();await new Promise(r=>setTimeout(r,10));});await input(editor(),'保存期间第二稿');await act(async()=>release());await settle();assert.ok(button('保存纪律修改'));assert.equal(doc.disciplineBook.rules[0].title,'第一稿');await click(button('保存纪律修改'));assert.equal(doc.disciplineBook.rules[0].title,'保存期间第二稿');
 // Knowledge shares durable book storage, with independently ordered risk notes.
 await click(button('操盘知识'));assert.equal(w.document.querySelectorAll('[role="tab"]').length,6);
 const noteGrid=()=>w.document.querySelector('.knowledge-grid[data-section="notes"]'),riskGrid=()=>w.document.querySelector('.knowledge-grid[data-section="risks"]');
 assert.equal(noteGrid().children.length,5);assert.equal(riskGrid(),null);
 assert.equal(w.document.querySelectorAll('.knowledge-grid textarea').length,0);
 assert.ok(noteGrid().textContent.includes('七成可用资金'));assert.ok(noteGrid().textContent.includes('哈药、精华'));
 await click(button('增加知识点'));await input(w.document.querySelector('textarea[aria-label="知识点内容"]'),'自定义知识\n第二行内容');assert.equal(noteGrid().children.length,6);
 const knowledgeTransfer={value:'',getData(){return this.value;},setData(_k,v){this.value=v;}};
 await act(async()=>{const start=new w.Event('dragstart',{bubbles:true});Object.defineProperty(start,'dataTransfer',{value:knowledgeTransfer});noteGrid().querySelectorAll('.knowledge-drag')[5].dispatchEvent(start);const drop=new w.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(drop,'dataTransfer',{value:knowledgeTransfer});noteGrid().children[0].dispatchEvent(drop);});
 await click(button('完成编辑'));assert.ok(noteGrid().children[0].textContent.includes('自定义知识'));
 await click(button('交易风险'));assert.equal(noteGrid(),null);assert.equal(riskGrid().children.length,7);const priorRisk=riskGrid().children[0].textContent;
 await act(async()=>{const drop=new w.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(drop,'dataTransfer',{value:knowledgeTransfer});riskGrid().children[0].dispatchEvent(drop);});assert.equal(riskGrid().children[0].textContent,priorRisk);await click(button('操盘知识')); // A drag cannot move an experience into the risk queue.
 await click(button('保存知识修改'));assert.equal(doc.disciplineBook.knowledge.notes[0].content,'自定义知识\n第二行内容');assert.equal(doc.disciplineBook.knowledge.risks.length,7);assert.equal(doc.disciplineBook.rules[0].title,'保存期间第二稿');
 await click([...noteGrid().querySelectorAll('button')].find(b=>b.textContent==='删除'));assert.equal(noteGrid().children.length,5);await click(button('撤销上次删除'));assert.equal(noteGrid().children.length,6);
 await click(button('交易风险'));await input(w.document.querySelector('textarea[aria-label="当日风险汇总"]'),'测试日期的已核实事件与应对');await click(button('立即提交'));assert.equal(doc.records['2026-10-28'].payload.fields.knowledgeRiskSummary,'测试日期的已核实事件与应对');
 await input(w.document.querySelector('#trade-date'),'2026-10-27');assert.equal(riskGrid().children.length,7);assert.equal(w.document.querySelector('textarea[aria-label="当日风险汇总"]').value,'');await input(w.document.querySelector('#trade-date'),'2026-10-28');assert.equal(w.document.querySelector('textarea[aria-label="当日风险汇总"]').value,'测试日期的已核实事件与应对');
 await click(button('操盘知识'));assert.equal(noteGrid().children.length,6);await click([...noteGrid().querySelectorAll('button')].find(b=>b.textContent==='编辑'));await input(w.document.querySelector('textarea[aria-label="知识点内容"]'),'本地未提交知识');
 const remoteKnowledge=structuredClone(doc.disciplineBook);remoteKnowledge.knowledge.notes[0].content='其他设备的知识';doc.disciplineBook=remoteKnowledge;sha='remote-knowledge';await act(async()=>{await intervals.find(x=>x.ms===30000).fn();});await settle();assert.ok(button('载入远端知识'));assert.equal(w.document.querySelector('textarea[aria-label="知识点内容"]').value,'本地未提交知识');await click(button('载入远端知识'));assert.ok(noteGrid().textContent.includes('其他设备的知识'));
 for(let i=0;i<6;i++)await click([...noteGrid().querySelectorAll('button')].find(b=>b.textContent==='删除'));
 await click(button('保存知识修改'));assert.deepEqual(doc.disciplineBook.knowledge.notes,[]);await click(button('交易纪律'));await click(button('操盘知识'));assert.equal(noteGrid().querySelectorAll('.knowledge-item').length,0);assert.equal(riskGrid(),null);await click(button('交易风险'));assert.equal(riskGrid().children.length,7);assert.equal(noteGrid(),null);assert.equal(doc.unknownRoot.keep,true);

 // New preparation freezes environment, and observe mode cannot become live authorization.
 fixed=new RealDate('2026-11-03T09:00:00+08:00').getTime();
 await input(w.document.querySelector('#trade-date'),'2026-11-03');await click(button('盘前候选'));await settle();
 assert.ok(w.document.body.textContent.includes('市场环境 → 题材 → 候选'));
 assert.equal(w.document.querySelectorAll('.candidate-pool-table tbody tr').length,2);
 assert.equal(w.document.querySelectorAll('.theme-leads tbody tr').length,1);
 assert.equal(button('冻结盘前名单').disabled,false);await input(w.document.querySelector('textarea[aria-label="候选1 题材真实性"]'),'fixture thematic evidence');await click(button('冻结盘前名单'));await click(button('立即提交'));
 let saved=JSON.parse(doc.records['2026-11-03'].payload.fields.candidatePlan);assert.equal(saved.context.permission,'observe');assert.equal(saved.sourceDate,'2026-11-02');assert.equal(saved.picks[0].evidence.authenticity,'fixture thematic evidence');
 await click(button('盘中执行'));assert.ok(w.document.body.textContent.includes('冻结环境仅允许观察或模拟'));assert.ok(button('记录首次合格信号').disabled);
 await click(button('返回盘前候选'));
 const fieldByText=label=>[...w.document.querySelectorAll('label')].find(l=>l.querySelector('span')?.textContent===label)?.querySelector('input,textarea,select');
 const permission=fieldByText('新增交易权限');await act(async()=>{permission.value='evaluate';permission.dispatchEvent(new w.Event('change',{bubbles:true}));});
 await input(fieldByText('权限调整依据（观察状态不等于漏填）'),'fixture reason');await click(button('冻结盘前名单'));await click(button('立即提交'));
 saved=JSON.parse(doc.records['2026-11-03'].payload.fields.candidatePlan);assert.equal(saved.context.permission,'evaluate');assert.equal(JSON.parse(doc.records['2026-11-03'].payload.fields.candidatePlanHistory).at(-1).context.permission,'observe');
 fixed=new RealDate('2026-11-03T10:00:00+08:00').getTime();await click(button('盘中执行'));
 await input(fieldByText('开盘后承接确认时间'),'09:36:00');await input(fieldByText('VWAP站回或守住的证据'),'fixture VWAP');await input(fieldByText('量能与主动承接证据'),'fixture volume');assert.ok(button('记录首次合格信号').disabled);
 await input(fieldByText('开盘后承接确认时间'),'09:33:00');assert.equal(button('记录首次合格信号').disabled,false);
 await click(button('暂停新增交易'));assert.ok(button('记录首次合格信号').disabled);await click(button('恢复新增判断'));await click(button('记录首次合格信号'));await click(button('立即提交'));
 const newSignal=JSON.parse(doc.records['2026-11-03'].payload.fields.executionSamples)[0];assert.equal(newSignal.supportTime,'09:33:00');assert.equal(newSignal.entryStage,'confirmed');assert.equal(newSignal.exitPlan,'失效退出');
 await click(button('返回盘前候选'));await act(async()=>{await intervals.find(x=>x.ms===1000).fn();});assert.ok(button('冻结盘前名单').disabled);assert.ok(fieldByText('新增交易权限').matches(':disabled'));

 // After the close, Nov4 requires Nov3, even when the newest published archive is Nov2.
 fixed=new RealDate('2026-11-03T19:00:00+08:00').getTime();
 await input(w.document.querySelector('#trade-date'),'2026-11-04');await settle();
 assert.ok(w.document.body.textContent.includes('应读取 2026-11-03'));
 assert.equal(w.document.querySelectorAll('.candidate-pool-table tbody tr').length,0);
 assert.ok(button('冻结盘前名单').disabled);
 await input(fieldByText('A池成交额下限 · 万元（可调整）'),'5000');
 nov3Published=true;await act(async()=>{await intervals.filter(x=>x.ms===60000).at(-1).fn();});await settle();
 assert.equal(w.document.querySelectorAll('.candidate-pool-table tbody tr').length,2);
 assert.ok(w.document.querySelector('.candidate-pool-table').textContent.includes('最新候选1'));
 assert.equal(w.document.querySelector('.candidate-pool-table').textContent.includes('候选1 000001'),false);
 assert.ok(w.document.body.textContent.includes('已核对准备日 2026-11-03'));
 assert.equal(fieldByText('A池成交额下限 · 万元（可调整）').value,'5000');

 // Review1104 adds evidence without new navigation or rewriting frozen rules.
 fixed=new RealDate('2026-10-28T10:00:00+08:00').getTime();await input(w.document.querySelector('#trade-date'),'2026-10-28');
 const originalFrozen=doc.records['2026-10-28'].payload.fields.candidatePlan;
 await click(button('市场环境'));assert.equal(w.document.querySelectorAll('.cross-market .knowledge-item').length,6);assert.equal(w.document.querySelectorAll('[role="tab"]').length,6);
 await input(fieldByText('信号发生时间（北京时间）'),'2026-10-28T09:45');await input(fieldByText('信息来源 / 快照链接'),'fixture source');await input(fieldByText('已发生的事实（与预判分开）'),'fixture SOX rise');await input(fieldByText('可能传导的A股方向 / 标的，仅作映射'),'fixture A-share mapping');
 assert.ok(w.document.querySelector('.cross-market').textContent.includes('时间有效'));
 await click(button('立即提交'));assert.equal(JSON.parse(doc.records['2026-10-28'].payload.fields.crossMarketSignals)[0].facts,'fixture SOX rise');
 await click(button('盘前候选'));assert.equal(w.document.querySelector('textarea[aria-label="候选1 题材真实性"]').matches(':disabled'),false);await input(w.document.querySelector('textarea[aria-label="候选1 题材真实性"]'),"retrospective research only");await click(button("立即提交"));assert.equal(doc.records['2026-10-28'].payload.fields.candidatePlan,originalFrozen);
 await click(button('盘中执行'));await click(button('人工标记市场环境改变'));assert.ok(w.document.body.textContent.includes('需先保存资金风格复核'));
 await input(fieldByText('变化发生时间（北京时间）'),'2026-10-28T09:50');await input(fieldByText('信息来源或快照链接'),'fixture timestamped source');await input(fieldByText('变化后的资金风格'),'tech rotation');await input(fieldByText('放量、集体突破等已发生事实'),'fixture collective breakout');
 await click(button('保存风格复核'));await click(button('立即提交'));const reviewed=doc.records['2026-10-28'].payload.fields;
 assert.equal(reviewed.styleChangePending,'no');assert.equal(JSON.parse(reviewed.styleReviews)[0].decision,'observe');assert.equal(JSON.parse(reviewed.styleReviews)[0].planCapturedAt,JSON.parse(originalFrozen).capturedAt);assert.equal(reviewed.candidatePlan,originalFrozen);
 console.log('PASS: cross-market timestamp/source persistence, five evidence columns, manual style audit and frozen-plan immutability');
 console.log('PASS: Nov4 rejects missing Nov3 archive, automatically refreshes to newly published Nov3 candidates and preserves edits');
 console.log('PASS: Nov3 environment and candidate freeze, observe gate, audited permission update, support evidence, pause/resume and post-auction lock');
 console.log('PASS: Dashboard rule CRUD, native drag and case integrity, cross-date book, synthetic two-board list, first-signal dedup, unknown/root/date preservation, remote conflicts and in-flight edits; dense knowledge CRUD, isolated drag queues, cross-day risk summary and empty-list persistence');
} finally {await act(async()=>node.unmount());w.close();globalThis.Date=RealDate;}
