const G=require('./core.js');let ok=0,bad=0;const t=(n,c)=>{c?ok++:(bad++,console.log('FAIL',n))};
const mk=(arr)=>arr.map((v,i)=>({t:i*6e4,ct:i*6e4+59999,o:v[0],h:v[1],l:v[2],c:v[3]}));
// EMA
t('ema',G.ema([1,1,1],3).every(x=>x==1));t('ema2',Math.abs(G.ema([1,2],3)[1]-1.5)<1e-9);
// RSI: only rising => 100 ; only falling => 0
const up=mk(Array.from({length:30},(_,i)=>[i,i+1,i,i+1])),dn=mk(Array.from({length:30},(_,i)=>[30-i,30-i,29-i,29-i]));
t('rsi up',G.rsi(up)[29]==100);t('rsi dn',Math.abs(G.rsi(dn)[29])<1e-9);
t('cmo',G.cmo(up)[29]==100&&G.cmo(dn)[29]==-100);
// ATR constant range 2, no gaps => 2
const flat=mk(Array.from({length:30},()=>[10,11,9,10]));t('atr',Math.abs(G.atr(flat)[29]-2)<1e-9);
// P/L formula: 0.01 lot, $100 per 1.0 move per lot => $1 per $1
const o={lot:0.01,vpl:100,spread:0,comm:0};
t('buy pnl',Math.abs(G.pnl(1,2000,2005,o)-5)<1e-9);t('sell pnl',Math.abs(G.pnl(-1,2000,1995,o)-5)<1e-9);
t('sell loss',Math.abs(G.pnl(-1,2000,2003,o)+3)<1e-9);t('net',Math.abs(G.net(5,{lot:.01,vpl:100,spread:0.3,comm:0.1})-(5-0.3-0.001))<1e-9);
// Outcome rules
const S=(side)=>({side,idx:0,entry:100,sl:100-side*2,tp:[1,2,3].map(n=>100+side*2*n)});
const bar=(h,l)=>({o:100,h,l,c:100,t:0,ct:0});
t('win',G.evaluate(S(1),[bar(100,100),bar(102.5,99.5)]).st=='win');
t('loss',G.evaluate(S(1),[bar(100,100),bar(101,97.9)]).st=='loss');
t('ambiguous',G.evaluate(S(1),[bar(100,100),bar(103,97)]).st=='ambiguous');
t('sell win tp3',G.evaluate(S(-1),[bar(100,100),bar(100.5,93.9)]).hi==3);
t('open',G.evaluate(S(1),[bar(100,100),bar(101,99)]).st=='open');
t('loss then tp ignored',G.evaluate(S(1),[bar(100,100),bar(100.5,97.5),bar(110,100)]).st=='loss');
// Stats / losing streak
const T=[5,-3,-3,-3,4].map(p=>({pl:p,res:{st:p>0?'win':'loss'}}));const s=G.stats(T);t('stats',s.wins==2&&s.losses==3&&s.streak==3&&Math.abs(s.rate-40)<1e-9&&Math.abs(s.net+0)<1e-9+1e-9);
// Signal fires on a hand-built reversal series; and is stable (does not change when future bars appended)
let p=2000,arr=[];for(let i=0;i<80;i++){p-=0.6+0.3*Math.sin(i);arr.push([p+0.3,p+0.8,p-0.8,p])}
for(let i=0;i<40;i++){const q=p;p+=1.4+0.2*Math.sin(i);arr.push([q,p+0.7,q-0.6,p])}
const c=mk(arr),I=G.indicators(c),all=[];for(let k=0;k<c.length;k++){const x=G.signalAt(c,I,k);if(x)all.push(x)}
console.log('signals on synthetic reversal (logic test only, NOT performance):',all.map(x=>`${x.side>0?'BUY':'SELL'}@${x.idx}`).join(',')||'none');
t('stable',(()=>{const c2=c.slice(0,100),I2=G.indicators(c2);return all.filter(x=>x.idx<100).every(x=>{const y=G.signalAt(c2,I2,x.idx);return y&&y.side==x.side&&Math.abs(y.entry-x.entry)<1e-9&&Math.abs(y.sl-x.sl)<1e-9})})());
all.forEach(x=>{t('levels',x.side>0?(x.sl<x.entry&&x.tp[0]>x.entry&&x.tp[2]>x.tp[1]):(x.sl>x.entry&&x.tp[0]<x.entry&&x.tp[2]<x.tp[1]));t('rr',Math.abs(Math.abs(x.tp[1]-x.entry)/x.risk-2)<1e-9)});
console.log(`passed ${ok}, failed ${bad}`);process.exit(bad?1:0);
