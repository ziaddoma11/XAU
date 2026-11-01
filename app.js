const TF={'1m':[6e4,'دقيقة','من دقائق إلى ساعة تقريباً'],'5m':[3e5,'5 دقائق','حوالي 30 دقيقة إلى 3 ساعات'],'15m':[9e5,'15 دقيقة','حوالي 1 إلى 6 ساعات'],'30m':[18e5,'30 دقيقة','حوالي 3 إلى 12 ساعة'],'1h':[36e5,'ساعة','حوالي 6 ساعات إلى يوم']};
let tf=localStorage.getItem('gss_tf')||'15m',D=null,timer;const $=id=>document.getElementById(id);
const f2=n=>n==null?'—':Number(n).toFixed(2),usd=n=>n==null?'—':(n>=0?'+':'−')+'$'+Math.abs(n).toFixed(2);
const tz=t=>new Date(t).toLocaleString('ar-LY',{timeZone:'Africa/Tripoli',hour12:false,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
const opts=()=>({lot:+$('lot').value||0,vpl:+$('vpl').value||0,spread:+$('spr').value||0,comm:+$('com').value||0});
$('tfs').innerHTML=Object.keys(TF).map(k=>`<button data-k="${k}">${TF[k][1]}</button>`).join('');
$('tfs').onclick=e=>{const k=e.target.dataset.k;if(k){tf=k;localStorage.setItem('gss_tf',k);refresh()}};
['lot','vpl','spr','com'].forEach(i=>$(i).oninput=()=>D&&render());
setInterval(()=>$('clock').textContent='ليبيا: '+new Date().toLocaleTimeString('ar-LY',{timeZone:'Africa/Tripoli',hour12:false}),1000);
// XAUUSD feed adapter. Configure a public CORS-enabled candle endpoint in
// XAUUSD_FEED_URL below. Expected response: array of candles with
// {time,open,high,low,close} (time may be ms or ISO string), or standard
// Twelve Data time_series response {values:[{datetime,open,high,low,close}]}.
const XAUUSD_FEED_URL = ''; // e.g. your serverless proxy endpoint; do not put secret API keys in client code.
async function load(){
 if(!XAUUSD_FEED_URL) throw Error('XAUUSD data feed not configured. Add a live XAUUSD candle endpoint; PAXG/Binance data is intentionally disabled.');
 const r=await fetch(XAUUSD_FEED_URL); if(!r.ok) throw Error('HTTP '+r.status);
 const j=await r.json(); const arr=Array.isArray(j)?j:(j.values||j.data||[]);
 if(!arr.length) throw Error('No XAUUSD candles returned');
 const candles=arr.map(k=>{
  const t=k.time??k.datetime??k.timestamp;
  const ms=typeof t==='number'?(t<1e12?t*1000:t):Date.parse(t);
  return {t:ms,o:+(k.open??k.o),h:+(k.high??k.h),l:+(k.low??k.l),c:+(k.close??k.c),ct:ms+TF[tf][0]-1};
 }).filter(k=>Number.isFinite(k.t)&&[k.o,k.h,k.l,k.c].every(Number.isFinite)).sort((a,b)=>a.t-b.t);
 if(!candles.length) throw Error('Unsupported XAUUSD candle format');
 return candles;
}
async function refresh(){clearTimeout(timer);document.querySelectorAll('#tfs button').forEach(b=>b.classList.toggle('on',b.dataset.k==tf));
 $('hold').textContent=`فريم الشارت: ${TF[tf][1]} (مدى تحليل الشموع). مدة الاحتفاظ التقريبية: ${TF[tf][2]} — تقدير وليست مختبرة. صلاحية الإشارة: ${GSS.CFG.validBars} شموع.`;
 try{const all=await load(),now=Date.now(),closed=all.filter(c=>c.ct<now);D={all,closed,live:all[all.length-1]};D.I=GSS.indicators(closed);D.fetched=now;$('err').hidden=true;render()}
 catch(e){D=null;$('err').hidden=false;$('err').textContent='تعذّر جلب بيانات السوق ('+e.message+'). لا تُعرض أسعار بديلة. تحقق من الاتصال أو أن Binance غير محجوبة في منطقتك، ثم أعد المحاولة.';$('cardBody').textContent='لا توجد بيانات.'}
 timer=setTimeout(refresh,30000)}
function render(){const o=opts(),c=D.closed,I=D.I,n=c.length-1,last=c[n],price=D.live.c,stale=Date.now()-last.ct>3*TF[tf][0]+6e4;
 $('upd').textContent='آخر تحديث: '+tz(D.fetched)+(stale?' (قديمة!)':'');
 const T=GSS.backtest(c,I,o),S=GSS.stats(T),sig=T[T.length-1];let act=null,why='';
 if(sig){const age=n-sig.idx,sameTrend=I.st.T[n]==sig.side;
  if(sig.res.st=='open'&&age<=GSS.CFG.validBars&&sameTrend)act=sig;else why=sig.res.st=='open'?(sameTrend?'انتهت صلاحية آخر إشارة':'أُلغيت: انقلب اتجاه القناة'):'آخر إشارة انتهت بنتيجتها'}
 $('card').className='card '+(stale?'wait':act?(act.side>0?'buy':'sell'):'wait');
 if(stale)$('cardBody').innerHTML='<div class="big">WAIT</div>البيانات قديمة — الإشارات موقوفة.';
 else if(act){const s=act,b=s.side>0,cur=GSS.pnl(s.side,s.entry,price,o),p=i=>GSS.net(GSS.pnl(s.side,s.entry,s.tp[i],o),o);
  $('cardBody').innerHTML=`<div class="big">${b?'BUY شراء':'SELL بيع'} <span class="tag">${TF[tf][1]}</span></div><div class="lv"><div>الدخول<b>${f2(s.entry)}</b></div><div>وقف الخسارة<b>${f2(s.sl)}</b>${usd(GSS.net(GSS.pnl(s.side,s.entry,s.sl,o),o))}</div><div>TP1 (1:1)<b>${f2(s.tp[0])}</b>${usd(p(0))}</div><div>TP2 (1:2)<b>${f2(s.tp[1])}</b>${usd(p(1))}</div><div>TP3 (1:3)<b>${f2(s.tp[2])}</b>${usd(p(2))}</div><div>الحالي (${f2(price)})<b class="${cur>=0?'g':'r'}">${usd(cur)}</b></div></div>
  <ul>${s.why.map(w=>`<li>${w}</li>`).join('')}</ul><div class="note">ظهرت: ${tz(s.time)} • تنتهي: ${tz(s.time+GSS.CFG.validBars*TF[tf][0])}<br>تُلغى إذا: أُغلقت شمعة عند SL، أو انقلب اتجاه القناة، أو مرت 5 شموع. ادخل يدوياً قرب سعر الدخول فقط؛ إن ابتعد السعر أكثر من 0.3×ATR فتجاهلها.</div>`}
 else $('cardBody').innerHTML=`<div class="big">WAIT انتظار</div>لا توجد إشارة قوية الآن.${sig?`<div class="note">${why} — ${sig.side>0?'BUY':'SELL'} قديمة بتاريخ ${tz(sig.time)} (لا تُدخل عليها).</div>`:''}`;
 $('chips').innerHTML=`<span>السعر ${f2(price)}</span><span>ATR14 ${f2(I.atr[n])}</span><span>RSI14 ${f2(I.rsi[n])}</span><span>CMO ${f2(I.cmo[n])}</span><span>القناة ${I.st.T[n]>0?'صاعدة':'هابطة'}</span>`;
 $('stats').innerHTML=[['إجمالي الإشارات',S.total],['رابحة',S.wins],['خاسرة',S.losses],['نسبة النجاح',S.rate==null?'—':S.rate.toFixed(0)+'%'],['صافي افتراضي',usd(S.net)],['متوسط ربح',usd(S.avgW)],['متوسط خسارة',usd(S.avgL)],['أقصى خسائر متتالية',S.streak],['غير محسومة',S.amb],['مفتوحة',S.open]].map(x=>`<div class="st">${x[0]}<b>${x[1]}</b></div>`).join('');
 $('jr').innerHTML='<tr><th>الوقت</th><th>النوع</th><th>دخول</th><th>SL</th><th>TP1</th><th>النتيجة</th><th>±</th></tr>'+T.slice(-15).reverse().map(t=>`<tr><td>${tz(t.time)}</td><td class="${t.side>0?'g':'r'}">${t.side>0?'BUY':'SELL'}</td><td>${f2(t.entry)}</td><td>${f2(t.sl)}</td><td>${f2(t.tp[0])}</td><td>${{win:'ربح'+(t.res.hi>1?' (TP'+t.res.hi+')':''),loss:'خسارة',open:'مفتوحة',ambiguous:'غير محسومة'}[t.res.st]}</td><td class="${t.pl>0?'g':'r'}">${usd(t.pl)}</td></tr>`).join('');
 draw(act||(sig&&sig.idx>n-70?sig:null))}
function draw(sg){const cv=$('ch'),dpr=devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight;cv.width=W*dpr;cv.height=H*dpr;const g=cv.getContext('2d');g.scale(dpr,dpr);
 const N=70,all=D.all,off=Math.max(0,all.length-N),V=all.slice(off),I=D.I,R=48,st=(W-R)/N,bw=Math.max(2,st*.6);let hi=-1e9,lo=1e9;V.forEach(k=>{hi=Math.max(hi,k.h);lo=Math.min(lo,k.l)});
 if(sg)sg.tp.concat([sg.sl]).forEach(v=>{hi=Math.max(hi,v);lo=Math.min(lo,v)});const pad=(hi-lo)*.05;hi+=pad;lo-=pad;const Y=v=>H-14-(v-lo)/(hi-lo)*(H-28),X=i=>(i-off)*st+st/2;
 g.fillStyle='#0e0d0a';g.fillRect(0,0,W,H);g.font='11px sans-serif';g.textAlign='left';
 for(let i=0;i<=5;i++){const v=lo+(hi-lo)*i/5;g.strokeStyle='#241f12';g.beginPath();g.moveTo(0,Y(v));g.lineTo(W-R,Y(v));g.stroke();g.fillStyle='#948c78';g.fillText(v.toFixed(1),W-R+4,Y(v)+4)}
 if(sg){const x0=X(sg.idx),line=(v,col,txt,dash)=>{g.strokeStyle=col;g.setLineDash(dash||[]);g.beginPath();g.moveTo(x0,Y(v));g.lineTo(W-R,Y(v));g.stroke();g.setLineDash([]);g.fillStyle=col;g.fillText(txt+' '+v.toFixed(2),W-R+2-0,Y(v)-3)}
  g.fillStyle='rgba(31,191,117,.13)';g.fillRect(x0,Y(sg.tp[2]),W-R-x0,Y(sg.entry)-Y(sg.tp[2]));g.fillStyle='rgba(229,72,77,.15)';g.fillRect(x0,Math.min(Y(sg.entry),Y(sg.sl)),W-R-x0,Math.abs(Y(sg.sl)-Y(sg.entry)));
  g.font='10px sans-serif';line(sg.entry,'#d4af37','Entry');line(sg.sl,'#e5484d','SL');line(sg.tp[0],'#1fbf75','TP1',[4,3]);line(sg.tp[1],'#1fbf75','TP2',[4,3]);line(sg.tp[2],'#1fbf75','TP3',[4,3]);g.font='11px sans-serif'}
 const nb=D.closed.length-1,piv=I.piv,lc=D.live.c;[piv.hi.filter(p=>p.p>lc).pop(),piv.lo.filter(p=>p.p<lc).pop()].forEach(p=>{if(!p||p.i<off-30)return;g.strokeStyle='#6d6650';g.setLineDash([2,4]);g.beginPath();g.moveTo(0,Y(p.p));g.lineTo(W-R,Y(p.p));g.stroke();g.setLineDash([])});
 const ln=(arr,col)=>{g.strokeStyle=col;g.lineWidth=1.3;g.beginPath();let s=0;for(let i=off;i<=nb;i++){const x=X(i),y=Y(arr[i]);s++?g.lineTo(x,y):g.moveTo(x,y)}g.stroke();g.lineWidth=1};ln(I.e20,'#4da3ff');ln(I.e50,'#c77dff');
 V.forEach((k,j)=>{const i=off+j,x=X(i),up=k.c>=k.o;g.strokeStyle=g.fillStyle=up?'#1fbf75':'#e5484d';g.beginPath();g.moveTo(x,Y(k.h));g.lineTo(x,Y(k.l));g.stroke();g.fillRect(x-bw/2,Math.min(Y(k.o),Y(k.c)),bw,Math.max(1,Math.abs(Y(k.o)-Y(k.c))))});
 g.textAlign='center';GSS.backtest(D.closed,I,opts()).filter(s=>s.idx>=off).forEach(s=>{g.fillStyle=s.side>0?'#1fbf75':'#e5484d';const b=s.side>0;g.fillText(b?'▲BUY':'▼SELL',X(s.idx),b?Y(D.closed[s.idx].l)+12:Y(D.closed[s.idx].h)-6)});
 const r=$('rs'),w=r.clientWidth,h=r.clientHeight;r.width=w*dpr;r.height=h*dpr;const q=r.getContext('2d');q.scale(dpr,dpr);q.fillStyle='#0e0d0a';q.fillRect(0,0,w,h);[30,50,70].forEach(v=>{q.strokeStyle='#241f12';q.beginPath();q.moveTo(0,h-v/100*h);q.lineTo(w,h-v/100*h);q.stroke()});
 q.strokeStyle='#d4af37';q.beginPath();let s=0;for(let i=off;i<=nb;i++){if(I.rsi[i]==null)continue;const x=(i-off)*st+st/2,y=h-I.rsi[i]/100*h;s++?q.lineTo(x,y):q.moveTo(x,y)}q.stroke();q.fillStyle='#948c78';q.font='10px sans-serif';q.fillText('RSI14',4,10)}
addEventListener('resize',()=>D&&render());refresh();
