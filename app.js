const TF={'1m':[6e4,'دقيقة','من دقائق إلى ساعة تقريباً','1min'],'5m':[3e5,'5 دقائق','حوالي 30 دقيقة إلى 3 ساعات','5min'],'15m':[9e5,'15 دقيقة','حوالي 1 إلى 6 ساعات','15min'],'30m':[18e5,'30 دقيقة','حوالي 3 إلى 12 ساعة','30min'],'1h':[36e5,'ساعة','حوالي 6 ساعات إلى يوم','1h']};
let tf=localStorage.getItem('gss_tf')||'15m',D=null,timer;const $=id=>document.getElementById(id);
const f2=n=>n==null?'—':Number(n).toFixed(2),usd=n=>n==null?'—':(n>=0?'+':'−')+'$'+Math.abs(n).toFixed(2);
const tz=t=>new Date(t).toLocaleString('ar-LY',{timeZone:'Africa/Tripoli',hour12:false,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
const opts=()=>({lot:+$('lot').value||0,vpl:+$('vpl').value||0,spread:+$('spr').value||0,comm:+$('com').value||0});
$('tfs').innerHTML=Object.keys(TF).map(k=>`<button data-k="${k}">${TF[k][1]}</button>`).join('');
$('tfs').onclick=e=>{const k=e.target.dataset.k;if(k){tf=k;localStorage.setItem('gss_tf',k);refresh()}};
['lot','vpl','spr','com'].forEach(i=>$(i).oninput=()=>D&&render());
setInterval(()=>$('clock').textContent='ليبيا: '+new Date().toLocaleTimeString('ar-LY',{timeZone:'Africa/Tripoli',hour12:false}),1000);
const API='https://biquote.io/api/XAUUSD',IV={'1m':'1m','5m':'5m','15m':'15m','30m':'30m','1h':'1h'};
async function gj(u){const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);return r.json()}
async function ohlc(iv,ms,lim){return GSS.parseBQ(await gj(`${API}/ohlc?interval=${iv}&limit=${lim}`),ms)}
async function load(){const ms=TF[tf][0];let cs;
 try{cs=await ohlc(IV[tf],ms,500)}catch(e){ // احتياط: 30m/1h من شموع 15m عند عدم دعم الفريم مباشرة
  if(tf=='30m'||tf=='1h'){cs=GSS.aggregate(await ohlc('15m',9e5,500),9e5,ms);if(!cs.length)throw e;D&&(D.agg=true)}else throw e}
 const tick=GSS.parseTick(await gj(API));return{cs,tick}}
async function refresh(){clearTimeout(timer);document.querySelectorAll('#tfs button').forEach(b=>b.classList.toggle('on',b.dataset.k==tf));
 $('hold').textContent=`فريم الشارت: ${TF[tf][1]} (مدى تحليل الشموع). مدة الاحتفاظ التقريبية: ${TF[tf][2]} — تقدير وليست مختبرة. صلاحية الإشارة: ${GSS.CFG.validBars} شموع.`;
 try{const {cs:all,tick}=await load(),now=Date.now(),closed=all.filter(c=>c.ct<now);D={all,closed,live:all[all.length-1],tick};D.I=GSS.indicators(closed);D.fetched=now;$('err').hidden=true;render()}
 catch(e){D=null;$('err').hidden=false;$('err').textContent='تعذّر جلب بيانات السوق ('+e.message+'). لا تُعرض أسعار بديلة. تحقق من الاتصال أو أن المصدر biquote.io متوقف أو يمنع الطلبات من المتصفح.';$('cardBody').textContent='لا توجد بيانات.'}
 timer=setTimeout(refresh,15000)}
function render(){const o=opts(),c=D.closed,I=D.I,n=c.length-1,last=c[n],price=D.tick.price,stale=Date.now()-last.ct>3*TF[tf][0]+6e4;
 $('upd').textContent='آخر تحديث: '+tz(D.fetched)+(stale?' (قديمة!)':'');
 const T=GSS.backtest(c,I,o),S=GSS.stats(T),sig=T[T.length-1];let act=null,why='';
 if(sig){const age=n-sig.idx,sameTrend=I.st.T[n]==sig.side;
  if(sig.res.st=='open'&&age<=GSS.CFG.validBars&&sameTrend)act=sig;else why=sig.res.st=='open'?(sameTrend?'انتهت صلاحية آخر إشارة':'أُلغيت: انقلب اتجاه القناة'):'آخر إشارة انتهت بنتيجتها'}
 $('stats').innerHTML=[['إجمالي الإشارات',S.total],['رابحة',S.wins],['خاسرة',S.losses],['نسبة النجاح',S.rate==null?'—':S.rate.toFixed(0)+'%'],['صافي افتراضي',usd(S.net)],['متوسط ربح',usd(S.avgW)],['متوسط خسارة',usd(S.avgL)],['أقصى خسائر متتالية',S.streak],['غير محسومة',S.amb],['مفتوحة',S.open]].map(x=>`<div class="st">${x[0]}<b>${x[1]}</b></div>`).join('');
 $('jr').innerHTML='<tr><th>الوقت</th><th>النوع</th><th>دخول</th><th>SL</th><th>TP1</th><th>النتيجة</th><th>±</th></tr>'+T.slice(-15).reverse().map(t=>`<tr><td>${tz(t.time)}</td><td class="${t.side>0?'g':'r'}">${t.side>0?'BUY':'SELL'}</td><td>${f2(t.entry)}</td><td>${f2(t.sl)}</td><td>${f2(t.tp[0])}</td><td>${{win:'ربح'+(t.res.hi>1?' (TP'+t.res.hi+')':''),loss:'خسارة',open:'مفتوحة',ambiguous:'غير محسومة'}[t.res.st]}</td><td class="${t.pl>0?'g':'r'}">${usd(t.pl)}</td></tr>`).join('');
 D.T=T;D.sig=sig;liveRender()}
function draw(sg){const cv=$('ch'),dpr=devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight;cv.width=W*dpr;cv.height=H*dpr;const g=cv.getContext('2d');g.scale(dpr,dpr);
 const N=70,all=D.all,off=Math.max(0,all.length-N),V=all.slice(off),I=D.LI||D.I,R=84,st=(W-R)/N,bw=Math.max(2,st*.6);let hi=-1e9,lo=1e9;V.forEach(k=>{hi=Math.max(hi,k.h);lo=Math.min(lo,k.l)});hi=Math.max(hi,D.tick.price);lo=Math.min(lo,D.tick.price);
 if(sg)sg.tp.concat([sg.sl]).forEach(v=>{hi=Math.max(hi,v);lo=Math.min(lo,v)});const pad=(hi-lo)*.05;hi+=pad;lo-=pad;const Y=v=>H-14-(v-lo)/(hi-lo)*(H-28),X=i=>(i-off)*st+st/2;
 g.fillStyle='#0e0d0a';g.fillRect(0,0,W,H);g.font='12px sans-serif';g.textAlign='left';
 for(let i=0;i<=5;i++){const v=lo+(hi-lo)*i/5;g.strokeStyle='#241f12';g.beginPath();g.moveTo(0,Y(v));g.lineTo(W-R,Y(v));g.stroke();g.fillStyle='#5f594a';g.fillText(v.toFixed(1),4,Y(v)-3)}
 if(sg){const x0=X(sg.idx),line=(v,col,txt,dash)=>{g.strokeStyle=col;g.setLineDash(dash||[]);g.beginPath();g.moveTo(x0,Y(v));g.lineTo(W-R,Y(v));g.stroke();g.setLineDash([]);g.fillStyle=col;g.fillText(txt+' '+v.toFixed(2),W-R+2-0,Y(v)-3)}
  g.fillStyle='rgba(31,191,117,.13)';g.fillRect(x0,Y(sg.tp[2]),W-R-x0,Y(sg.entry)-Y(sg.tp[2]));g.fillStyle='rgba(229,72,77,.15)';g.fillRect(x0,Math.min(Y(sg.entry),Y(sg.sl)),W-R-x0,Math.abs(Y(sg.sl)-Y(sg.entry)));
  g.font='600 11px sans-serif';line(sg.entry,'#d4af37','Entry');line(sg.sl,'#e5484d','SL');line(sg.tp[0],'#1fbf75','TP1',[4,3]);line(sg.tp[1],'#1fbf75','TP2',[4,3]);line(sg.tp[2],'#1fbf75','TP3',[4,3]);g.font='11px sans-serif'}
 const nb=(D.LI?D.LI.e20.length:D.closed.length)-1,piv=I.piv,lc=D.live.c;[piv.hi.filter(p=>p.p>lc).pop(),piv.lo.filter(p=>p.p<lc).pop()].forEach(p=>{if(!p||p.i<off-30)return;g.strokeStyle='#6d6650';g.setLineDash([2,4]);g.beginPath();g.moveTo(0,Y(p.p));g.lineTo(W-R,Y(p.p));g.stroke();g.setLineDash([])});
 const ln=(arr,col)=>{g.strokeStyle=col;g.lineWidth=1.3;g.beginPath();let s=0;for(let i=off;i<=nb;i++){const x=X(i),y=Y(arr[i]);s++?g.lineTo(x,y):g.moveTo(x,y)}g.stroke();g.lineWidth=1};ln(I.e20,'#4da3ff');ln(I.e50,'#c77dff');
 V.forEach((k,j)=>{const i=off+j,x=X(i),up=k.c>=k.o;g.strokeStyle=g.fillStyle=up?'#1fbf75':'#e5484d';g.beginPath();g.moveTo(x,Y(k.h));g.lineTo(x,Y(k.l));g.stroke();g.fillRect(x-bw/2,Math.min(Y(k.o),Y(k.c)),bw,Math.max(1,Math.abs(Y(k.o)-Y(k.c))))});
 {const p=D.tick.price,y=Y(p);g.strokeStyle='#f1ead6';g.setLineDash([3,3]);g.beginPath();g.moveTo(0,y);g.lineTo(W-R,y);g.stroke();g.setLineDash([]);g.fillStyle='#f1ead6';g.fillRect(W-R,y-8,R,16);g.fillStyle='#000';g.textAlign='left';g.font='bold 11px sans-serif';g.fillText(p.toFixed(2),W-R+4,y+4);g.font='11px sans-serif'}
 g.textAlign='center';(D.T||[]).filter(s=>s.idx>=off).forEach(s=>{g.fillStyle=s.side>0?'#1fbf75':'#e5484d';const b=s.side>0;g.fillText(b?'▲BUY':'▼SELL',X(s.idx),b?Y(D.closed[s.idx].l)+12:Y(D.closed[s.idx].h)-6)});
 const r=$('rs'),w=r.clientWidth,h=r.clientHeight;r.width=w*dpr;r.height=h*dpr;const q=r.getContext('2d');q.scale(dpr,dpr);q.fillStyle='#0e0d0a';q.fillRect(0,0,w,h);[30,50,70].forEach(v=>{q.strokeStyle='#241f12';q.beginPath();q.moveTo(0,h-v/100*h);q.lineTo(w,h-v/100*h);q.stroke()});
 q.strokeStyle='#d4af37';q.beginPath();let s=0;for(let i=off;i<=nb;i++){if(I.rsi[i]==null)continue;const x=(i-off)*st+st/2,y=h-I.rsi[i]/100*h;s++?q.lineTo(x,y):q.moveTo(x,y)}q.stroke();q.fillStyle='#948c78';q.font='10px sans-serif';q.fillText('RSI14',4,10)}
addEventListener('resize',()=>D&&render());refresh();

let prevP=null,tickOk=Date.now(),busy=false;
function paintPrice(){if(!D)return;const t=D.tick,p=t.price,el=$('pr');el.textContent=p.toFixed(2);if(prevP!=null&&p!==prevP){el.className='pr '+(p>prevP?'up':'dn')}prevP=p;
 $('pm').textContent=`Bid ${f2(t.bid)} • Ask ${f2(t.ask)} • السبريد ${f2(t.ask-t.bid)}`+(Number.isFinite(t.pct)?` • اليوم ${t.pct>=0?'+':''}${t.pct.toFixed(2)}%`:'')+(Date.now()-tickOk>10000?' • ⚠ السعر متوقف':'')}
async function fast(){if(!D||busy)return;busy=true;try{const t=GSS.parseTick(await gj(API)),p=t.price,ms=TF[tf][0],now=Date.now();D.tick=t;tickOk=now;
 if(D.live.ct>=now){D.live.c=p;D.live.h=Math.max(D.live.h,p);D.live.l=Math.min(D.live.l,p)}
 else{const s=D.live.t+ms*Math.floor((now-D.live.t)/ms);D.live={t:s,o:p,h:p,l:p,c:p,ct:s+ms-1};D.all.push(D.live)}
 liveRender()}catch(e){console.error(e);paintPrice()}busy=false}
setInterval(fast,1000);

function cardHTML(s,tag,p,o){const b=s.side>0,cur=GSS.pnl(s.side,s.entry,p,o),pp=i=>GSS.net(GSS.pnl(s.side,s.entry,s.tp[i],o),o);
 return `<div class="hd"><span class="big">${b?'BUY شراء':'SELL بيع'}</span><span class="tag">${tag} · ${TF[tf][1]}</span></div>
<div class="rows"><div class="row ent"><span>سعر الدخول</span><b>${f2(s.entry)}</b><i></i></div>
<div class="row"><span>وقف الخسارة SL</span><b>${f2(s.sl)}</b><i class="r">${usd(GSS.net(GSS.pnl(s.side,s.entry,s.sl,o),o))}</i></div>
<div class="row"><span>الهدف 1 · 1:1</span><b>${f2(s.tp[0])}</b><i class="g">${usd(pp(0))}</i></div>
<div class="row"><span>الهدف 2 · 1:2</span><b>${f2(s.tp[1])}</b><i class="g">${usd(pp(1))}</i></div>
<div class="row"><span>الهدف 3 · 1:3</span><b>${f2(s.tp[2])}</b><i class="g">${usd(pp(2))}</i></div>
<div class="row now"><span>الربح/الخسارة الآن</span><b class="${cur>=0?'g':'r'}">${usd(cur)}</b><i></i></div></div>
<div class="note">${s.early?'إشارة على شمعة لم تُغلق: الدخول = السعر الحالي ويتحرك، وقد تختفي أو تنعكس قبل الإغلاق.':`ظهرت ${tz(s.time)} · تنتهي ${tz(s.time+GSS.CFG.validBars*TF[tf][0])}`}</div>
<details class="why"><summary>سبب الإشارة وشروط الإلغاء</summary><ul>${s.why.map(w=>`<li>${w}</li>`).join('')}</ul><div class="note">تُلغى إذا بلغ السعر SL، أو انعكس اتجاه القناة، أو مرت 5 شموع. ادخل يدوياً قرب سعر الدخول فقط؛ إن ابتعد السعر أكثر من 0.3×ATR فتجاهلها. الإشارة المؤكدة لا تُسجَّل في السجل إلا بعد إغلاق شمعتها.</div></details>`}
// يعمل كل ثانية: يعيد تقييم الإشارة على السعر الحي (SL/TP/انعكاس القناة) ويكشف الإشارة المبكرة. الإشارة المؤكدة تُثبَّت فقط عند إغلاق الشمعة.
function liveRender(){if(!D)return;const o=opts(),now=Date.now(),c=D.closed,n=c.length-1,p=D.tick.price,stale=now-c[n].ct>3*TF[tf][0]+6e4;
 const forming=D.live&&D.live.ct>=now?[D.live]:[],cc=c.concat(forming),L=cc.length-1,I2=GSS.indicators(cc);D.LI=I2;
 const w=document.querySelector('.why');if(w)D.whyOpen=w.open;
 let html,cls='wait',s=null,tag='',msg='',sig=D.sig;
 if(stale)html='<div class="big">WAIT</div>البيانات قديمة — الإشارات موقوفة.';
 else{
  if(sig){const r=GSS.evaluate(sig,cc),rev=I2.st.T[L]!=sig.side;
   if(r.st=='open'&&n-sig.idx<=GSS.CFG.validBars&&!rev){s=sig;tag='مؤكدة'}
   else msg=r.st=='loss'?'ضُربت SL — أُغلقت الإشارة بخسارة.':r.st=='win'?`تحقق TP${r.hi} — أُغلقت الإشارة.`:r.st=='ambiguous'?'غير محسومة (SL وTP1 في شمعة واحدة).':r.st=='open'&&rev?'انعكس السوق — أُلغيت الإشارة.':'انتهت صلاحية الإشارة.'}
  if(!s&&forming.length){const e=GSS.signalAt(cc,I2,L);if(e){const k=e.side;s={...e,entry:p,sl:p-k*e.risk,tp:[1,2,3].map(x=>p+k*e.risk*x),time:now,early:true};tag='مبكرة غير مؤكدة'}}
  if(D.prevEarly&&!s)D.earlyGone=now;D.prevEarly=!!(s&&s.early);
  if(s){cls=s.side>0?'buy':'sell';html=cardHTML(s,tag,p,o)}
  else{if(!msg&&D.earlyGone&&now-D.earlyGone<120000)msg='انعكس السعر — اختفت الإشارة المبكرة.';
   html=`<div class="big">WAIT انتظار</div>لا توجد إشارة قوية الآن.${msg?`<div class="note">${msg}</div>`:''}${sig?`<div class="note">آخر إشارة مؤكدة: ${sig.side>0?'BUY':'SELL'} بتاريخ ${tz(sig.time)} (قديمة، لا تُدخل عليها).</div>`:''}`}}
 $('card').className='card '+cls;$('cardBody').innerHTML=html;if(D.whyOpen){const x=document.querySelector('.why');if(x)x.open=true}
 D.act=s&&!s.early?s:null;D.sg=s||(sig&&sig.idx>n-70?sig:null);
 $('chips').innerHTML=`<span>السعر ${f2(p)}</span><span>السبريد ${Number.isFinite(D.tick.ask-D.tick.bid)?f2(D.tick.ask-D.tick.bid):'غير متوفر'}</span><span>ATR14 ${f2(I2.atr[L])}</span><span>RSI14 ${f2(I2.rsi[L])}</span><span>CMO ${f2(I2.cmo[L])}</span><span>القناة ${I2.st.T[L]>0?'صاعدة':'هابطة'}</span>`;
 paintPrice();draw(D.sg)}
