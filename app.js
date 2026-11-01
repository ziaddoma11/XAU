'use strict';
const API='https://biquote.io/api/XAUUSD';
const TFS={'5m':300,'15m':900};

/* ---------- المؤشرات ---------- */
function ema(a,p){const k=2/(p+1),r=[];let e=null;a.forEach((v,i)=>{if(i<p-1){r.push(null);return}
e=e===null?a.slice(0,p).reduce((x,y)=>x+y,0)/p:v*k+e*(1-k);r.push(e)});return r}
function rsi(c,p=14){const r=new Array(c.length).fill(null);if(c.length<=p)return r;let g=0,l=0;
for(let i=1;i<=p;i++){const d=c[i]-c[i-1];d>0?g+=d:l-=d}g/=p;l/=p;r[p]=l===0?100:100-100/(1+g/l);
for(let i=p+1;i<c.length;i++){const d=c[i]-c[i-1];g=(g*(p-1)+Math.max(d,0))/p;l=(l*(p-1)+Math.max(-d,0))/p;r[i]=l===0?100:100-100/(1+g/l)}return r}
function atr(cs,p=14){const r=new Array(cs.length).fill(null);if(cs.length<=p)return r;
const tr=cs.map((x,i)=>i?Math.max(x.h-x.l,Math.abs(x.h-cs[i-1].c),Math.abs(x.l-cs[i-1].c)):x.h-x.l);
let a=0;for(let i=1;i<=p;i++)a+=tr[i];a/=p;r[p]=a;for(let i=p+1;i<cs.length;i++){a=(a*(p-1)+tr[i])/p;r[i]=a}return r}
function levels(cs,price){const hi=[],lo=[],n=cs.length;
for(let i=3;i<n-3;i++){let h=true,l=true;for(let j=1;j<=3;j++){
if(cs[i].h<=cs[i-j].h||cs[i].h<=cs[i+j].h)h=false;if(cs[i].l>=cs[i-j].l||cs[i].l>=cs[i+j].l)l=false}
if(h)hi.push(cs[i].h);if(l)lo.push(cs[i].l)}
const res=hi.filter(x=>x>price).sort((a,b)=>a-b)[0]??null;
const sup=lo.filter(x=>x<price).sort((a,b)=>b-a)[0]??null;return{res,sup}}

/* ---------- تحليل وإشارة ---------- */
function marketOpen(d){const day=d.getUTCDay(),h=d.getUTCHours();
if(day===6)return false;if(day===5&&h>=22)return false;if(day===0&&h<22)return false;
if(day>=1&&day<=4&&h===22)return false;return true}
function analyze(cs,price,tfSec,now,open){
const out={signal:'WAIT',reasons:[],score:null,trade:null,ind:null};
if(!cs||cs.length<60){out.reasons.push('بيانات الشموع ناقصة (أقل من 60 شمعة)');return out}
if(!Number.isFinite(price)){out.reasons.push('السعر الحالي غير متوفر');return out}
const c=cs.map(x=>x.c),e20=ema(c,20),e50=ema(c,50),rs=rsi(c),at=atr(cs),n=cs.length-1;
const A=at[n],R=rs[n],E20=e20[n],E50=e50[n];
if([A,R,E20,E50,e20[n-3]].some(v=>v==null)){out.reasons.push('تعذر حساب المؤشرات');return out}
const lv=levels(cs,price),last=cs[n-1]||cs[n],body=last.c-last.o,bodyAtr=Math.abs(body)/A;
out.ind={ema20:E20,ema50:E50,rsi:R,atr:A,res:lv.res,sup:lv.sup,body,bodyAtr,
trend:E20>E50&&price>E50?'صاعد':E20<E50&&price<E50?'هابط':'عرضي',
mom:R>=60?'زخم صاعد قوي':R>=52?'زخم صاعد':R<=40?'زخم هابط قوي':R<=48?'زخم هابط':'محايد'};
if(!open){out.reasons.push('السوق مغلق (تقديري)');return out}
const age=now-cs[n].t;if(age>tfSec*1000*3){out.reasons.push('البيانات قديمة: آخر شمعة قبل '+Math.round(age/60000)+' دقيقة');return out}
if(Math.abs(price-cs[n].c)>2*A){out.reasons.push('تضارب: السعر الحالي بعيد عن آخر شمعة');return out}
let bull=0,bear=0;const rB=[],rS=[];
if(E20>E50){bull++;rB.push('EMA20 فوق EMA50')}else{bear++;rS.push('EMA20 تحت EMA50')}
if(price>E20){bull++;rB.push('السعر فوق EMA20')}else{bear++;rS.push('السعر تحت EMA20')}
if(E20>e20[n-3]){bull++;rB.push('EMA20 صاعد')}else{bear++;rS.push('EMA20 هابط')}
if(R>=52&&R<=70){bull++;rB.push('RSI '+R.toFixed(0)+' زخم صاعد غير متشبع')}
if(R<=48&&R>=30){bear++;rS.push('RSI '+R.toFixed(0)+' زخم هابط غير متشبع')}
if(body>0&&bodyAtr>=0.4){bull++;rB.push('شمعة صاعدة قوية')}
if(body<0&&bodyAtr>=0.4){bear++;rS.push('شمعة هابطة قوية')}
let sig='WAIT';
if(bull>=4&&bear<=1)sig='BUY';else if(bear>=4&&bull<=1)sig='SELL';
else out.reasons.push('المؤشرات متضاربة أو غير كافية (شراء '+bull+'/5، بيع '+bear+'/5)');
if(sig==='BUY'&&R>75){sig='WAIT';out.reasons.push('RSI تشبع شرائي')}
if(sig==='SELL'&&R<25){sig='WAIT';out.reasons.push('RSI تشبع بيعي')}
if(sig==='BUY'&&lv.res!=null&&lv.res-price<A){sig='WAIT';out.reasons.push('مقاومة قريبة جداً')}
if(sig==='SELL'&&lv.sup!=null&&price-lv.sup<A){sig='WAIT';out.reasons.push('دعم قريب جداً')}
out.signal=sig;
if(sig!=='WAIT'){const d=sig==='BUY'?1:-1,risk=1.5*A;
out.reasons=(sig==='BUY'?rB:rS).slice();out.score=Math.max(bull,bear)/5;
out.trade={entry:price,sl:price-d*risk,tp1:price+d*1.5*risk,tp2:price+d*2.5*risk,risk,rr1:1.5,rr2:2.5};
out.reasons.push('SL = 1.5×ATR، الأهداف 1.5R و2.5R')}
else out.score=Math.max(bull,bear)/5;
return out}

/* ---------- تحليل استجابة API (دفاعي: الحقول غير مؤكدة) ---------- */
const pick=(o,k)=>{for(const x of k)if(o[x]!=null)return o[x]};
const toMs=t=>{if(typeof t==='string'&&isNaN(+t))return Date.parse(t);t=+t;return t<1e11?t*1000:t};
function parseCandles(j){const a=Array.isArray(j)?j:Object.values(j||{}).find(Array.isArray);
if(!a)throw new Error('شكل استجابة الشموع غير معروف');
const cs=a.map(x=>Array.isArray(x)?{t:toMs(x[0]),o:+x[1],h:+x[2],l:+x[3],c:+x[4]}:
{t:toMs(pick(x,['t','time','timestamp','ts','openTime','date'])),o:+pick(x,['o','open']),h:+pick(x,['h','high']),l:+pick(x,['l','low']),c:+pick(x,['c','close'])})
.filter(x=>[x.t,x.o,x.h,x.l,x.c].every(Number.isFinite)).sort((a,b)=>a.t-b.t);
if(!cs.length)throw new Error('لا توجد شموع صالحة في الاستجابة');return cs}
function parseTick(j){j=j&&j.data&&!Array.isArray(j.data)?j.data:j;if(Array.isArray(j))j=j[0];
const bid=+pick(j,['bid']),ask=+pick(j,['ask']);let p=+pick(j,['mid']);
if(!Number.isFinite(p)&&Number.isFinite(bid)&&Number.isFinite(ask))p=(bid+ask)/2;
if(!Number.isFinite(p))throw new Error('تعذر قراءة السعر من الاستجابة');
const tt=pick(j,['time','timestamp','ts','t']);
return{price:p,bid,ask,pct:+pick(j,['dayDiffPercent']),t:tt!=null?toMs(tt):null}}

if(typeof module!=='undefined')module.exports={ema,rsi,atr,levels,analyze,parseCandles,parseTick,marketOpen};

/* ---------- الواجهة ---------- */
if(typeof document!=='undefined'){
const $=id=>document.getElementById(id);
const S=Object.assign({tf:'5m',cap:30,risk:2,cs:'',notify:false},JSON.parse((()=>{try{return localStorage.getItem('gatp')||'{}'}catch(e){return'{}'}})()));
const save=()=>{try{localStorage.setItem('gatp',JSON.stringify(S))}catch(e){}};
let candles=[],tick=null,res=null,prevSig=null,lastOk=null,netErr=null;
const f=(v,d=2)=>Number.isFinite(v)?v.toFixed(d):'--';
const libya=d=>d.toLocaleTimeString('en-GB',{timeZone:'Africa/Tripoli',hour:'2-digit',minute:'2-digit',second:'2-digit'});

async function getJSON(u){const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}
async function load(){
try{const [t,c]=await Promise.all([getJSON(API),getJSON(API+'/ohlc?interval='+S.tf+'&limit=180')]);
tick=parseTick(t);candles=parseCandles(c);lastOk=Date.now();netErr=null}
catch(e){netErr=navigator.onLine?'تعذر جلب البيانات: '+e.message+' (قد يكون المصدر متوقفاً أو يمنع الطلبات من المتصفح CORS). لا تُعرض أسعار بديلة وهمية.':'لا يوجد اتصال بالإنترنت.'}
compute();render()}
function compute(){if(netErr||!tick||!candles.length){res=null;return}
res=analyze(candles,tick.price,TFS[S.tf],Date.now(),marketOpen(new Date()));
if(prevSig!==null&&res.signal!==prevSig&&res.signal!=='WAIT')alertSig(res.signal);prevSig=res.signal}
function alertSig(s){const m='إشارة جديدة: '+(s==='BUY'?'شراء BUY':'بيع SELL')+' على XAUUSD '+S.tf;
document.title=m;try{navigator.vibrate&&navigator.vibrate(200)}catch(e){}
if(S.notify){try{const a=new (window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator();o.connect(a.destination);o.frequency.value=880;o.start();o.stop(a.currentTime+.25)}catch(e){}
try{if(Notification.permission==='granted')new Notification('GOLD AI TRADER PRO',{body:m})}catch(e){}}}

function render(){
const open=marketOpen(new Date());
$('market').textContent=open?'السوق مفتوح (تقديري)':'السوق مغلق (تقديري)';$('market').className='pill '+(open?'ok':'bad');
$('net').textContent=netErr?'غير متصل / خطأ':'متصل';$('net').className='pill '+(netErr?'bad':'ok');
$('err').hidden=!netErr;$('err').textContent=netErr||'';
document.querySelectorAll('.tf button').forEach(b=>b.classList.toggle('on',b.dataset.tf===S.tf));
if(tick&&!netErr){$('price').textContent=f(tick.price);
$('chg').textContent=Number.isFinite(tick.pct)?(tick.pct>0?'+':'')+tick.pct.toFixed(2)+'%':'--';
$('chg').style.color=tick.pct>0?'#26a69a':tick.pct<0?'#ef5350':'';
$('spread').textContent=Number.isFinite(tick.ask-tick.bid)?f(tick.ask-tick.bid):'غير متوفر';
$('upd').textContent=libya(new Date(lastOk))}else{$('price').textContent='--';$('chg').textContent='--';$('spread').textContent='--'}
const r=res||{signal:'WAIT',reasons:[netErr||'لا توجد بيانات'],score:null,trade:null,ind:null};
$('sig').textContent=r.signal;$('sig').className='sig '+r.signal;
$('sigAr').textContent={BUY:'شراء',SELL:'بيع',WAIT:'انتظار'}[r.signal];
$('score').textContent=r.score==null?'--':Math.round(r.score*100)+'%';
$('reasons').innerHTML='';r.reasons.forEach(t=>{const li=document.createElement('li');li.textContent=t;$('reasons').appendChild(li)});
const t=r.trade;$('entry').textContent=t?f(t.entry):'--';$('sl').textContent=t?f(t.sl):'--';$('tp1').textContent=t?f(t.tp1):'--';
$('tp2').textContent=t?f(t.tp2):'--';$('rr1').textContent=t?'1 : '+t.rr1:'--';$('rr2').textContent=t?'1 : '+t.rr2:'--';
const i=r.ind;$('ind').innerHTML='';
if(i)[['EMA 20',f(i.ema20)],['EMA 50',f(i.ema50)],['RSI 14',f(i.rsi,1)],['ATR 14',f(i.atr)],['الاتجاه',i.trend],['الزخم',i.mom],
['الدعم',i.sup!=null?f(i.sup):'—'],['المقاومة',i.res!=null?f(i.res):'—'],['اتجاه الشمعة',i.body>0?'صاعدة':'هابطة'],['حجم الشمعة',f(i.bodyAtr,2)+' ATR']]
.forEach(([k,v])=>{const d=document.createElement('div');d.textContent=k;const b=document.createElement('b');b.textContent=v;d.appendChild(b);$('ind').appendChild(d)});
calc(t);draw(t)}

function calc(t){const cap=+S.cap,rk=+S.risk,rusd=cap*rk/100,rows=[['مبلغ المخاطرة','$'+f(rusd)],['أقصى خسارة','-$'+f(rusd)],
['ربح TP1',t?'+$'+f(rusd*t.rr1):'--'],['ربح TP2',t?'+$'+f(rusd*t.rr2):'--']];
const cs=+S.cs;let lot='يلزم إدخال حجم العقد';
if(t&&cs>0)lot=f(rusd/(Math.abs(t.entry-t.sl)*cs),3)+' لوت';else if(!t&&cs>0)lot='بانتظار إشارة';
rows.push(['حجم اللوت',lot]);$('calc').innerHTML='';
rows.forEach(([k,v])=>{const d=document.createElement('div');d.textContent=k;const b=document.createElement('b');b.textContent=v;d.appendChild(b);$('calc').appendChild(d)})}

function draw(t){const cv=$('chart'),dpr=window.devicePixelRatio||1,W=cv.clientWidth,H=300;cv.width=W*dpr;cv.height=H*dpr;
const x=cv.getContext('2d');x.scale(dpr,dpr);x.clearRect(0,0,W,H);
if(!candles.length||netErr){x.fillStyle='#777';x.font='14px sans-serif';x.textAlign='center';x.fillText('لا توجد بيانات للعرض',W/2,H/2);return}
const N=Math.min(70,candles.length),v=candles.slice(-N),c=candles.map(k=>k.c),e20=ema(c,20).slice(-N),e50=ema(c,50).slice(-N);
let hi=Math.max(...v.map(k=>k.h)),lo=Math.min(...v.map(k=>k.l));
if(t)[t.sl,t.tp1,t.tp2,t.entry].forEach(p=>{hi=Math.max(hi,p);lo=Math.min(lo,p)});
const pad=(hi-lo)*.05||1;hi+=pad;lo-=pad;const pw=52,cw=(W-pw)/N,Y=p=>H-(p-lo)/(hi-lo)*H;
x.font='11px sans-serif';x.textAlign='left';x.fillStyle='#777';x.strokeStyle='#222';
for(let g=0;g<5;g++){const p=lo+(hi-lo)*g/4;x.beginPath();x.moveTo(0,Y(p));x.lineTo(W-pw,Y(p));x.stroke();x.fillText(p.toFixed(1),W-pw+4,Y(p)-2)}
v.forEach((k,i)=>{const cx=i*cw+cw/2,up=k.c>=k.o;x.strokeStyle=x.fillStyle=up?'#26a69a':'#ef5350';
x.beginPath();x.moveTo(cx,Y(k.h));x.lineTo(cx,Y(k.l));x.stroke();x.fillRect(cx-cw*.35,Math.min(Y(k.o),Y(k.c)),cw*.7,Math.max(1,Math.abs(Y(k.o)-Y(k.c))))});
[[e20,'#d4af37'],[e50,'#4fc3f7']].forEach(([e,col])=>{x.strokeStyle=col;x.lineWidth=1.5;x.beginPath();let s=false;
e.forEach((p,i)=>{if(p==null)return;const px=i*cw+cw/2;s?x.lineTo(px,Y(p)):(x.moveTo(px,Y(p)),s=true)});x.stroke();x.lineWidth=1});
if(t)[['Entry',t.entry,'#ffffff'],['SL',t.sl,'#ef5350'],['TP1',t.tp1,'#26a69a'],['TP2',t.tp2,'#66bb6a']].forEach(([n,p,col])=>{
x.strokeStyle=col;x.setLineDash([5,4]);x.beginPath();x.moveTo(0,Y(p));x.lineTo(W-pw,Y(p));x.stroke();x.setLineDash([]);x.fillStyle=col;x.fillText(n,4,Y(p)-3)});
x.fillStyle='#d4af37';x.fillText('EMA20',4,12);x.fillStyle='#4fc3f7';x.fillText('EMA50',50,12)}

function sessions(){const h=new Date().getUTCHours()+new Date().getUTCMinutes()/60,L=n=>String((n+2)%24).padStart(2,'0')+':00';
const S2=[['آسيا',0,9],['أوروبا',7,16],['أمريكا',13,22]];$('sessions').innerHTML='';
S2.forEach(([n,a,b])=>{const on=marketOpen(new Date())&&h>=a&&h<b,d=document.createElement('div');d.className='ses'+(on?' on':'');
d.textContent=n+(on?' ● نشطة':'');const s=document.createElement('span');s.textContent=L(a)+' – '+L(b);d.appendChild(s);$('sessions').appendChild(d)})}
function tick1s(){const n=new Date(),sec=TFS[S.tf],rem=Math.ceil(sec-(n.getTime()/1000)%sec);
$('timer').textContent=String(Math.floor(rem/60)).padStart(2,'0')+':'+String(rem%60).padStart(2,'0');$('clock').textContent=libya(n)}

document.querySelectorAll('.tf button').forEach(b=>b.onclick=()=>{S.tf=b.dataset.tf;save();prevSig=null;load()});
$('refresh').onclick=load;
$('cap').value=S.cap;$('risk').value=S.risk;$('riskV').textContent=S.risk;$('cs').value=S.cs;$('notify').checked=S.notify;
$('cap').oninput=e=>{S.cap=e.target.value;save();calc(res&&res.trade)};
$('risk').oninput=e=>{S.risk=e.target.value;$('riskV').textContent=S.risk;save();calc(res&&res.trade)};
$('cs').oninput=e=>{S.cs=e.target.value;save();calc(res&&res.trade)};
$('notify').onchange=e=>{S.notify=e.target.checked;save();if(S.notify&&window.Notification&&Notification.permission==='default')Notification.requestPermission()};
window.addEventListener('online',load);window.addEventListener('offline',load);window.addEventListener('resize',()=>draw(res&&res.trade));
sessions();tick1s();setInterval(tick1s,1000);setInterval(sessions,60000);setInterval(load,20000);load()}
