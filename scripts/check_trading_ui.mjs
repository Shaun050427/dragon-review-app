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
const RealDate=Date;const fixed=new RealDate('2026-10-28T10:00:00+08:00').getTime();globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}};
const {act}=await import('react'),{createRoot}=await import('react-dom/client');
const {DashboardClient}=await import('../app/dashboard-client.tsx');
const sessions=['2026-10-21','2026-10-22','2026-10-23','2026-10-26','2026-10-27'];
const calendar={schemaVersion:1,source:'fixture',coveredFrom:sessions[0],coveredThrough:'2026-10-28',sessions:[...sessions,'2026-10-28']};
const picks=['000001','000002'].map((code,i)=>({code,name:'候选'+(i+1),queue:'A',strategy:'S1',low:'7',high:'8',trigger:'stop then H',abandon:'sector fail',coreEvidence:'proof',liquidityConfirmed:true,ma5Confirmed:false,rotationEvidence:''}));
const plan=freezePlan('2026-10-28',sessions,[],picks,false,new RealDate('2026-10-27T20:00:00+08:00'));
const book=defaultBook();book.repair.enabled=false;
const fields={candidatePlan:JSON.stringify(plan),candidateDraft:JSON.stringify(picks),plannedCode:'000001',executionCandidate:'候选1',candidate:'候选1',candidate2:'候选2',currentEquity:'100000',startEquity:'100000',peakEquity:'100000',action:'空仓',tradeMode:'空仓观察',riskPerTradePct:'.5',maxPosition:'10'};
for(const [k,v] of Object.entries({auction:'yes',auctionEvidence:'auction proof',sector:'yes',sectorEvidence:'peers proof',low:'7.5',high:'7.6',price:'7.7',time:'09:35:00',stopped:'yes',breakout:'yes',evidence:'minute proof'}))fields['execution_000001_'+k]=v;
let doc={schemaVersion:7,updatedAt:'fixture',unknownRoot:{keep:true},disciplineBook:book,records:{'2026-10-28':{payload:{fields,checks:{}},updatedAt:'fixture'},'2026-10-27':{payload:{fields:{sentinel:'old-date'},checks:{}},updatedAt:'fixture'}}},sha='sha-0',writes=0,holdWrite=null;
const response=v=>({ok:true,status:200,json:async()=>structuredClone(v)});
globalThis.fetch=async(input,init={})=>{const url=String(input);if(url.startsWith('https://api.github.com/')){
 if(url.includes('/contents/')){if(init.method==='PUT'){const body=JSON.parse(init.body);assert.equal(body.sha,sha);if(holdWrite){const wait=holdWrite;holdWrite=null;await wait;}doc=JSON.parse(Buffer.from(body.content,'base64').toString('utf8'));sha='sha-'+(++writes);return response({content:{sha},commit:{sha:'commit-'+writes}});}return response({sha,content:Buffer.from(JSON.stringify(doc)).toString('base64')});}return response({default_branch:'main'});
 }if(url.includes('trading-calendar.json'))return response(calendar);
 const date=url.match(/daily\/\d{4}\/\d{2}\/(\d{4}-\d{2}-\d{2})\.json/)?.[1];if(date)return response({schemaVersion:1,tradeDate:date,stocks:date===sessions.at(-1)?picks.map(p=>({code:p.code,name:p.name,industry:'fixture',boards:2,turnover:2e8})):[]});
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
 await act(async()=>{node.render((await import('react')).createElement(DashboardClient));});await settle();assert.ok(w.document.body.textContent.includes('盘前有限观察池'));
 assert.equal(w.document.querySelectorAll('.workflow tbody tr').length,2);
 await click(button('交易纪律'));assert.equal(w.document.querySelectorAll('.discipline-rule').length,7);
 await click(button('增加交易纪律'));let titles=[...w.document.querySelectorAll('input[aria-label="纪律标题"]')];assert.equal(titles.length,8);await input(titles.at(-1),'自定义测试纪律');
 await click(buttons('附加经典案例').at(-1));let last=w.document.querySelectorAll('.discipline-rule')[7];assert.ok(last.textContent.includes('新经典案例'));
 const title=last.querySelector('.classic-case input');await input(title,'保留关联案例');
 const handles=[...w.document.querySelectorAll('.drag-handle')];const transfer={getData:()=>handles[7].getAttribute('aria-label')?book.rules[0].id:'',setData(_k,v){this.value=v;},effectAllowed:''};transfer.getData=()=>transfer.value;
 await act(async()=>{const start=new w.Event('dragstart',{bubbles:true});Object.defineProperty(start,'dataTransfer',{value:transfer});handles[7].dispatchEvent(start);const drop=new w.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(drop,'dataTransfer',{value:transfer});w.document.querySelectorAll('.discipline-rule')[0].dispatchEvent(drop);});
 assert.equal(w.document.querySelector('input[aria-label="纪律标题"]').value,'自定义测试纪律');assert.ok(w.document.querySelector('.discipline-rule').textContent.includes('保留关联案例'));
 await click(button('保存纪律修改'));assert.equal(doc.disciplineBook.rules[0].title,'自定义测试纪律');assert.equal(doc.disciplineBook.rules[0].cases[0].title,'保留关联案例');assert.deepEqual(doc.unknownRoot,{keep:true});assert.equal(doc.records['2026-10-27'].payload.fields.sentinel,'old-date');
 await click(buttons('删除纪律')[0]);assert.equal(w.document.querySelectorAll('.discipline-rule').length,7);await click(button('撤销上次删除'));assert.equal(w.document.querySelectorAll('.discipline-rule').length,8);
 await input(w.document.querySelector('#trade-date'),'2026-10-27');assert.equal(w.document.querySelector('input[aria-label="纪律标题"]').value,'自定义测试纪律');await input(w.document.querySelector('#trade-date'),'2026-10-28');
 await click(button('盘中执行'));await click(button('记录首次合格信号'));assert.ok(button('记录首次合格信号').disabled);assert.ok(w.document.body.textContent.includes('首次信号'));
 await click(button('立即提交'));assert.equal(doc.records['2026-10-28'].payload.fields.executionSamples.includes('09:35:00'),true);
 await click(button('交易纪律'));let r=w.document.querySelector('.discipline-rule');await click(r.querySelector('details button')); // import current execution as a case
 assert.ok(w.document.querySelector('.discipline-rule').textContent.includes('候选1 · 模拟'));
 // Simultaneous remote edits are surfaced, local edits survive.
 const remote=structuredClone(doc.disciplineBook);remote.rules[0].title='远端新版本';doc.disciplineBook=remote;sha='remote-new';
 await act(async()=>{await intervals.find(x=>x.ms===30000).fn();});await settle();assert.ok(button('载入远端纪律'));assert.equal(w.document.querySelector('input[aria-label="纪律标题"]').value,'自定义测试纪律');
 await click(button('载入远端纪律'));assert.equal(w.document.querySelector('input[aria-label="纪律标题"]').value,'远端新版本');
 // Edits made during a network save must remain dirty and be saved next.
 await input(w.document.querySelector('input[aria-label="纪律标题"]'),'第一稿');let release;holdWrite=new Promise(r=>release=r);await act(async()=>{button('保存纪律修改').click();await new Promise(r=>setTimeout(r,10));});await input(w.document.querySelector('input[aria-label="纪律标题"]'),'保存期间第二稿');await act(async()=>release());await settle();assert.ok(button('保存纪律修改'));assert.equal(doc.disciplineBook.rules[0].title,'第一稿');await click(button('保存纪律修改'));assert.equal(doc.disciplineBook.rules[0].title,'保存期间第二稿');
 console.log('PASS: Dashboard rule CRUD, native drag and case integrity, cross-date book, synthetic two-board list, first-signal dedup, unknown/root/date preservation, remote conflicts and in-flight edits');
} finally {await act(async()=>node.unmount());w.close();globalThis.Date=RealDate;}
