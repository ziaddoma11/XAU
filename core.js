// GOLD SIGNAL STRATEGY PRO - core logic (no DOM). Original rules; inspired by publicly described Edge Algo ideas only.
(function(root){
const ema=(a,p)=>{const k=2/(p+1);let e;return a.map((v,i)=>e=i?v*k+e*(1-k):v)};
function atr(c,p=14){const r=c.map(()=>null);if(c.length<p)return r;const tr=c.map((x,i)=>i?Math.max(x.h-x.l,Math.abs(x.h-c[i-1].c),Math.abs(x.l-c[i-1].c)):x.h-x.l);let s=0;for(let i=0;i<p;i++)s+=tr[i];r[p-1]=s/p;for(let i=p;i<c.length;i++)r[i]=(r[i-1]*(p-1)+tr[i])/p;return r}
function rsi(c,p=14){const r=c.map(()=>null);if(c.length<=p)return r;let g=0,l=0;for(let i=1;i<=p;i++){const d=c[i].c-c[i-1].c;d>0?g+=d:l-=d}g/=p;l/=p;const f=()=>l==0?100:100-100/(1+g/l);r[p]=f();for(let i=p+1;i<c.length;i++){const d=c[i].c-c[i-1].c;g=(g*(p-1)+Math.max(d,0))/p;l=(l*(p-1)+Math.max(-d,0))/p;r[i]=f()}return r}
function cmo(c,p=14){return c.map((_,i)=>{if(i<p)return null;let u=0,d=0;for(let j=i-p+1;j<=i;j++){const x=c[j].c-c[j-1].c;x>0?u+=x:d-=x}return u+d==0?0:100*(u-d)/(u+d)})}
function supertrend(c,a,m=2.5){const T=[],U=[],D=[];let t=1;for(let i=0;i<c.length;i++){if(a[i]==null){T.push(null);U.push(null);D.push(null);continue}
const hl=(c[i].h+c[i].l)/2;let u=hl+m*a[i],d=hl-m*a[i];const pu=U[i-1],pd=D[i-1];
if(pu!=null){const pc=c[i-1].c;if(!(u<pu||pc>pu))u=pu;if(!(d>pd||pc<pd))d=pd;if(t==1&&c[i].c<pd)t=-1;else if(t==-1&&c[i].c>pu)t=1}
T.push(t);U.push(u);D.push(d)}return{T,U,D}}
function pivots(c,L=5){const hi=[],lo=[];for(let i=L;i<c.length-L;i++){let H=true,Lw=true;for(let j=i-L;j<=i+L;j++){if(j==i)continue;if(c[j].h>=c[i].h)H=false;if(c[j].l<=c[i].l)Lw=false}if(H)hi.push({i,p:c[i].h});if(Lw)lo.push({i,p:c[i].l})}return{hi,lo}}
const CFG={atrMult:1.5,stMult:2,pivL:5,validBars:5,maxTrack:300};
function indicators(c){const a=atr(c),st=supertrend(c,a,CFG.stMult);return{atr:a,rsi:rsi(c),cmo:cmo(c),e20:ema(c.map(x=>x.c),20),e50:ema(c.map(x=>x.c),50),st,piv:pivots(c,CFG.pivL)}}
// Signal on CLOSED candle k only. Uses data up to k (pivots confirmed pivL bars later are only used if i+pivL<=k).
function signalAt(c,I,k){
 if(k<60||I.st.T[k]==null||I.st.T[k-1]==null||I.st.T[k]==I.st.T[k-1])return null;
 const side=I.st.T[k],x=c[k],a=I.atr[k],R=I.rsi[k],M=I.cmo[k],e20=I.e20[k],e50=I.e50[k],why=[];
 let fl=0;for(let j=k-19;j<=k;j++)if(I.st.T[j]!=I.st.T[j-1])fl++;if(fl>3)return null; // choppy filter: too many trend flips in 20 bars
 const s3=I.e20[k-3];
 if(side==1){if(!(e20>s3&&M>0&&R>=40&&R<=80&&x.c>x.o))return null}else{if(!(e20<s3&&M<0&&R>=20&&R<=60&&x.c<x.o))return null}
 const risk=CFG.atrMult*a,hi=I.piv.hi.filter(p=>p.i+CFG.pivL<=k),lo=I.piv.lo.filter(p=>p.i+CFG.pivL<=k);
 const sup=lo.filter(p=>p.p<x.c).pop(),res=hi.filter(p=>p.p>x.c).pop();
 if(side==1){if(!sup||x.c-sup.p>8*a)return null;if(res&&res.p-x.c<risk)return null}
 else{if(!res||res.p-x.c>8*a)return null;if(sup&&x.c-sup.p<risk)return null}
 why.push(side==1?'اختراق قناة ATR للأعلى':'كسر قناة ATR للأسفل',side==1?'ميل EMA20 صاعد':'ميل EMA20 هابط',`RSI=${R.toFixed(0)} وCMO=${M.toFixed(0)} يدعمان الاتجاه`,side==1?'شمعة صاعدة + دعم قريب + مجال حتى TP1':'شمعة هابطة + مقاومة قريبة + مجال حتى TP1');
 const e=x.c;return{side,idx:k,time:x.ct,entry:e,sl:e-side*risk,tp:[1,2,3].map(n=>e+side*risk*n),risk,atr:a,why}}
function evaluate(s,c,from){let hi=0,st='open',j0=null;const E=s.side;
 for(let j=s.idx+1;j<c.length&&j<=s.idx+CFG.maxTrack;j++){const k=c[j];
  const sl=E==1?k.l<=s.sl:k.h>=s.sl,hit=n=>E==1?k.h>=s.tp[n]:k.l<=s.tp[n];
  if(st=='open'){if(sl&&hit(0))return{st:'ambiguous',hi:0,j};if(sl)return{st:'loss',hi:0,j};if(hit(0)){st='win';hi=1;j0=j}}
  if(st=='win'){if(hi<2&&hit(1))hi=2;if(hi<3&&hit(2))hi=3;if(hi==3)break}}
 return{st,hi,j:j0}}
// Fixed rule: WIN = TP1 reached before SL (profit booked at TP1). LOSS = SL first. Same candle both = ambiguous (no smaller-TF data used).
function pnl(side,entry,exit,o){return (side==1?exit-entry:entry-exit)*o.vpl*o.lot}
function net(g,o){return g-o.spread*o.vpl*o.lot-o.comm*o.lot}
function backtest(c,I,o){const out=[];for(let k=60;k<c.length;k++){const s=signalAt(c,I,k);if(!s)continue;const r=evaluate(s,c);s.res=r;
 s.pl=r.st=='win'?net(pnl(s.side,s.entry,s.tp[0],o),o):r.st=='loss'?net(pnl(s.side,s.entry,s.sl,o),o):null;out.push(s)}return out}
function stats(T){const d=T.filter(t=>t.pl!=null),w=d.filter(t=>t.pl>0),l=d.filter(t=>t.pl<=0);let m=0,cur=0;d.forEach(t=>{if(t.pl<=0){cur++;m=Math.max(m,cur)}else cur=0});
 const sum=a=>a.reduce((x,t)=>x+t.pl,0);return{total:T.length,wins:w.length,losses:l.length,open:T.filter(t=>t.res.st=='open').length,amb:T.filter(t=>t.res.st=='ambiguous').length,rate:d.length?100*w.length/d.length:null,net:sum(d),avgW:w.length?sum(w)/w.length:null,avgL:l.length?sum(l)/l.length:null,streak:m}}
// biquote.io feed (same source & tolerant parsing as the user's old site, which showed live data). Shape not verified from here.
const pick=(o,k)=>{for(const x of k)if(o&&o[x]!=null)return o[x]};
const toMs=t=>{if(typeof t==='string'&&isNaN(+t))return Date.parse(t);t=+t;return t<1e11?t*1000:t};
function parseBQ(j,ms){const a=Array.isArray(j)?j:Object.values(j||{}).find(Array.isArray);if(!a)throw Error('شكل استجابة الشموع غير معروف');
 const cs=a.map(x=>Array.isArray(x)?{t:toMs(x[0]),o:+x[1],h:+x[2],l:+x[3],c:+x[4]}:{t:toMs(pick(x,['t','time','timestamp','ts','openTime','date'])),o:+pick(x,['o','open']),h:+pick(x,['h','high']),l:+pick(x,['l','low']),c:+pick(x,['c','close'])})
 .filter(x=>[x.t,x.o,x.h,x.l,x.c].every(Number.isFinite)).sort((p,q)=>p.t-q.t);if(!cs.length)throw Error('لا توجد شموع صالحة في الاستجابة');return cs.map(x=>({...x,ct:x.t+ms-1}))}
function parseTick(j){j=j&&j.data&&!Array.isArray(j.data)?j.data:j;if(Array.isArray(j))j=j[0];const bid=+pick(j,['bid']),ask=+pick(j,['ask']);let p=+pick(j,['mid']);
 if(!Number.isFinite(p)&&Number.isFinite(bid)&&Number.isFinite(ask))p=(bid+ask)/2;if(!Number.isFinite(p))throw Error('تعذر قراءة السعر من الاستجابة');return{price:p,bid,ask,pct:+pick(j,['dayDiffPercent'])}}
function aggregate(cs,from,to){const out=[];cs.forEach(k=>{const b=Math.floor(k.t/to)*to,L=out[out.length-1];if(L&&L.t==b){L.h=Math.max(L.h,k.h);L.l=Math.min(L.l,k.l);L.c=k.c;L.n++}else out.push({t:b,o:k.o,h:k.h,l:k.l,c:k.c,n:1})});
 const per=to/from;return out.filter(x=>x.n==per).map(({n,...x})=>({...x,ct:x.t+to-1}))} // يُسقط المجمّعات غير المكتملة
const API={parseBQ,parseTick,aggregate,ema,atr,rsi,cmo,supertrend,pivots,indicators,signalAt,evaluate,pnl,net,backtest,stats,CFG};
if(typeof module!=='undefined')module.exports=API;else root.GSS=API;
})(this);
