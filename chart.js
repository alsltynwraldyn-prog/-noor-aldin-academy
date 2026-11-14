
"use strict";

/* =========================================
   NOUR ALDIN ACADEMY
   Interactive Technical Analysis Engine
========================================= */

const canvas = document.getElementById("tradingChart");
const ctx = canvas.getContext("2d");
const indicatorArea = document.getElementById("indicatorCharts");
const editor = document.getElementById("editor");

const COLORS = {
  background: "#0d1727",
  grid: "#293951",
  text: "#9eacc0",
  gold: "#d8b45a",
  green: "#16c784",
  red: "#ea3943"
};

const indicatorNames = {
  ema:"EMA", sma:"SMA", adx:"ADX", sar:"Parabolic SAR",
  rsi:"RSI", macd:"MACD", stochastic:"Stochastic",
  cci:"CCI", williams:"Williams %R",
  bollinger:"Bollinger Bands", atr:"ATR",
  keltner:"Keltner Channels", std:"Standard Deviation",
  volume:"Volume", obv:"OBV", mfi:"MFI",
  volumeSma:"Volume SMA"
};

const settings = {};
Object.keys(indicatorNames).forEach(id => {
  settings[id] = {
    period: id === "ema" || id === "sma" ? 20 : 14,
    color: id === "volume" ? COLORS.gold : "#e8bd62",
    width: 2
  };
});

let candles = [];
let selected = -1;
let visibleCount = 55;
let offset = 0;
let dragging = false;
let dragStart = 0;
let initialOffset = 0;
let activePointer = null;

const $ = id => document.getElementById(id);

function randomBetween(a,b){
  return a + Math.random() * (b-a);
}

function makeCandle(previous){
  const open = previous ?? 100 + Math.random()*10;
  const close = open + randomBetween(-2.2,2.2);
  const high = Math.max(open,close) + randomBetween(.2,1.5);
  const low = Math.min(open,close) - randomBetween(.2,1.5);

  return {
    open, close, high, low,
    volume: Math.round(randomBetween(300,1800))
  };
}

function createData(){
  candles = [];
  let price = 100;

  for(let i=0;i<100;i++){
    const c = makeCandle(price);
    candles.push(c);
    price = c.close;
  }

  selected = candles.length-1;
  offset = 0;
  visibleCount = 55;
  render();
}

function addCandle(){
  const last = candles[candles.length-1];
  candles.push(makeCandle(last.close));
  selected = candles.length-1;
  offset = 0;
  render();
}

function deleteSelected(){
  if(candles.length <= 5) return;
  if(selected < 0) return;

  candles.splice(selected,1);
  selected = Math.min(selected,candles.length-1);
  render();
}

function resetChart(){
  createData();
}

function getVisible(){
  const end = Math.max(1,candles.length-offset);
  const start = Math.max(0,end-visibleCount);
  return {start,end,data:candles.slice(start,end)};
}

function resizeCanvas(){
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1,2);

  canvas.width = Math.round(rect.width*dpr);
  canvas.height = Math.round(rect.height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);

  render();
}

function average(values,period){
  return values.map((v,i)=>{
    if(i<period-1) return null;
    const part=values.slice(i-period+1,i+1);
    return part.reduce((a,b)=>a+b,0)/period;
  });
}

function ema(values,period){
  const result=[];
  const k=2/(period+1);
  let prev=null;

  values.forEach((v,i)=>{
    if(i===period-1){
      prev=values.slice(0,period).reduce((a,b)=>a+b,0)/period;
      result.push(prev);
    }else if(i>=period){
      prev=v*k+prev*(1-k);
      result.push(prev);
    }else result.push(null);
  });

  return result;
}

function trueRanges(data){
  return data.map((c,i)=>{
    if(i===0) return c.high-c.low;
    const prev=data[i-1].close;
    return Math.max(
      c.high-c.low,
      Math.abs(c.high-prev),
      Math.abs(c.low-prev)
    );
  });
}

function calcRSI(values,period){
  const out=Array(values.length).fill(null);
  if(values.length<=period) return out;

  let gains=0,losses=0;

  for(let i=1;i<=period;i++){
    const diff=values[i]-values[i-1];
    if(diff>0) gains+=diff;
    else losses-=diff;
  }

  let avgGain=gains/period;
  let avgLoss=losses/period;

  out[period]=avgLoss===0 ? 100 :
    100-(100/(1+avgGain/avgLoss));

  for(let i=period+1;i<values.length;i++){
    const diff=values[i]-values[i-1];
    avgGain=(avgGain*(period-1)+Math.max(diff,0))/period;
    avgLoss=(avgLoss*(period-1)+Math.max(-diff,0))/period;

    out[i]=avgLoss===0 ? 100 :
      100-(100/(1+avgGain/avgLoss));
  }

  return out;
}

function calcMACD(values){
  const fast=ema(values,12);
  const slow=ema(values,26);
  const line=values.map((v,i)=>
    fast[i]===null || slow[i]===null ? null : fast[i]-slow[i]
  );

  const valid=line.map(v=>v===null?0:v);
  const signal=ema(valid,9).map((v,i)=>
    line[i]===null ? null : v
  );

  const histogram=line.map((v,i)=>
    v===null || signal[i]===null ? null : v-signal[i]
  );

  return {line,signal,histogram};
}

function calcStochastic(data,period){
  const k=data.map((c,i)=>{
    if(i<period-1) return null;
    const part=data.slice(i-period+1,i+1);
    const high=Math.max(...part.map(x=>x.high));
    const low=Math.min(...part.map(x=>x.low));
    return high===low ? 50 : (c.close-low)/(high-low)*100;
  });

  const d=k.map((v,i)=>{
    if(i<period+2) return null;
    const part=k.slice(i-2,i+1);
    if(part.some(x=>x===null)) return null;
    return part.reduce((a,b)=>a+b,0)/3;
  });

  return {k,d};
}

function calcCCI(data,period){
  const tp=data.map(c=>(c.high+c.low+c.close)/3);
  const ma=average(tp,period);

  return tp.map((v,i)=>{
    if(ma[i]===null) return null;
    const part=tp.slice(i-period+1,i+1);
    const deviation=part.reduce((s,x)=>s+Math.abs(x-ma[i]),0)/period;
    return deviation===0 ? 0 : (v-ma[i])/(.015*deviation);
  });
}

function calcWilliams(data,period){
  return data.map((c,i)=>{
    if(i<period-1) return null;
    const part=data.slice(i-period+1,i+1);
    const high=Math.max(...part.map(x=>x.high));
    const low=Math.min(...part.map(x=>x.low));
    return high===low ? -50 : (high-c.close)/(high-low)*-100;
  });
}

function calcADX(data,period){
  const out=Array(data.length).fill(null);
  if(data.length<period*2) return out;

  const tr=trueRanges(data);
  const plusDM=Array(data.length).fill(0);
  const minusDM=Array(data.length).fill(0);

  for(let i=1;i<data.length;i++){
    const up=data[i].high-data[i-1].high;
    const down=data[i-1].low-data[i].low;
    plusDM[i]=up>down && up>0 ? up : 0;
    minusDM[i]=down>up && down>0 ? down : 0;
  }

  let trSum=0,plusSum=0,minusSum=0;
  for(let i=1;i<=period;i++){
    trSum+=tr[i];
    plusSum+=plusDM[i];
    minusSum+=minusDM[i];
  }

  const dx=Array(data.length).fill(null);
  for(let i=period;i<data.length;i++){
    if(i>period){
      trSum=trSum-trSum/period+tr[i];
      plusSum=plusSum-plusSum/period+plusDM[i];
      minusSum=minusSum-minusSum/period+minusDM[i];
    }
    const plusDI=trSum===0?0:100*plusSum/trSum;
    const minusDI=trSum===0?0:100*minusSum/trSum;
    const total=plusDI+minusDI;
    dx[i]=total===0?0:100*Math.abs(plusDI-minusDI)/total;
  }

  let seed=[];
  for(let i=period;i<data.length;i++){
    if(dx[i]!==null) seed.push(dx[i]);
    if(seed.length===period){
      const first=seed.reduce((a,b)=>a+b,0)/period;
      out[i]=first;
      let previous=first;
      for(let j=i+1;j<data.length;j++){
        previous=((previous*(period-1))+dx[j])/period;
        out[j]=previous;
      }
      break;
    }
  }
  return out;
}

function calcMFI(data,period){
  const typical=data.map(c=>(c.high+c.low+c.close)/3);
  const flow=typical.map((v,i)=>v*data[i].volume);
  const out=Array(data.length).fill(null);

  for(let i=period;i<data.length;i++){
    let positive=0,negative=0;

    for(let j=i-period+1;j<=i;j++){
      if(typical[j]>typical[j-1]) positive+=flow[j];
      else if(typical[j]<typical[j-1]) negative+=flow[j];
    }

    out[i]=negative===0 ? 100 :
      100-(100/(1+positive/negative));
  }

  return out;
}

function calculate(){
  const close=candles.map(c=>c.close);
  const periodFor=id=>Math.max(2,Math.min(200,Number(settings[id]?.period)||14));
  const tr=trueRanges(candles);
  const atr=average(tr,periodFor("atr"));
  const sma=average(close,periodFor("sma"));
  const e=ema(close,periodFor("ema"));
  const volatilityPeriod=periodFor("bollinger");

  const std=close.map((v,i)=>{
    if(i<volatilityPeriod-1) return null;
    const mean=close.slice(i-volatilityPeriod+1,i+1).reduce((a,b)=>a+b,0)/volatilityPeriod;
    const part=close.slice(i-volatilityPeriod+1,i+1);
    return Math.sqrt(part.reduce((s,x)=>s+(x-mean)**2,0)/volatilityPeriod);
  });

  const bb={
    upper:close.map((v,i)=>std[i]===null?null:
      close.slice(i-volatilityPeriod+1,i+1).reduce((a,b)=>a+b,0)/volatilityPeriod+2*std[i]),
    middle:close.map((v,i)=>i<volatilityPeriod-1?null:
      close.slice(i-volatilityPeriod+1,i+1).reduce((a,b)=>a+b,0)/volatilityPeriod),
    lower:close.map((v,i)=>std[i]===null?null:
      close.slice(i-volatilityPeriod+1,i+1).reduce((a,b)=>a+b,0)/volatilityPeriod-2*std[i])
  };

  const kc={
    upper:sma.map((v,i)=>v===null||atr[i]===null?null:v+2*atr[i]),
    middle:sma,
    lower:sma.map((v,i)=>v===null||atr[i]===null?null:v-2*atr[i])
  };

  let obv=0;
  const obvData=close.map((v,i)=>{
    if(i>0){
      if(v>close[i-1]) obv+=candles[i].volume;
      if(v<close[i-1]) obv-=candles[i].volume;
    }
    return obv;
  });

  const sar=Array(candles.length).fill(null);
  let rising=true, extreme=candles[0].high, sarValue=candles[0].low, af=.02;

  for(let i=1;i<candles.length;i++){
    sarValue=sarValue+af*(extreme-sarValue);
    const c=candles[i];

    if(rising){
      sarValue=Math.min(sarValue,candles[i-1].low);
      if(i>1) sarValue=Math.min(sarValue,candles[i-2].low);
      if(c.low<sarValue){
        rising=false;
        sarValue=extreme;
        extreme=c.low;
        af=.02;
      }else if(c.high>extreme){
        extreme=c.high;
        af=Math.min(.2,af+.02);
      }
    }else{
      sarValue=Math.max(sarValue,candles[i-1].high);
      if(i>1) sarValue=Math.max(sarValue,candles[i-2].high);
      if(c.high>sarValue){
        rising=true;
        sarValue=extreme;
        extreme=c.high;
        af=.02;
      }else if(c.low<extreme){
        extreme=c.low;
        af=Math.min(.2,af+.02);
      }
    }
    sar[i]=sarValue;
  }

  const stoch=calcStochastic(candles,periodFor("stochastic"));
  const macd=calcMACD(close);

  return {
    ema:e,
    sma,
    rsi:calcRSI(close,periodFor("rsi")),
    macd,
    stochastic:stoch,
    cci:calcCCI(candles,periodFor("cci")),
    williams:calcWilliams(candles,periodFor("williams")),
    bollinger:bb,
    atr,
    adx:calcADX(candles,periodFor("adx")),
    keltner:kc,
    std,
    volume:candles.map(c=>c.volume),
    obv:obvData,
    mfi:calcMFI(candles,periodFor("mfi")),
    volumeSma:average(candles.map(c=>c.volume),periodFor("volumeSma")),
    sar
  };
}

function enabled(id){
  return !!($(id) && $(id).checked);
}

function drawGrid(w,h,min,max,left,right,top,bottom){
  ctx.strokeStyle=COLORS.grid;
  ctx.lineWidth=1;
  ctx.font="11px Arial";
  ctx.fillStyle=COLORS.text;

  for(let i=0;i<=5;i++){
    const y=top+(bottom-top)*i/5;
    ctx.beginPath();
    ctx.moveTo(left,y);
    ctx.lineTo(right,y);
    ctx.stroke();

    const value=max-(max-min)*i/5;
    ctx.fillText(value.toFixed(2),right+5,y+4);
  }
}

function drawSeries(values,start,step,priceY,color,width=2,dashed=false){
  ctx.save();
  ctx.strokeStyle=color;
  ctx.lineWidth=width;
  if(dashed) ctx.setLineDash([5,4]);

  ctx.beginPath();
  let started=false;

  values.forEach((v,i)=>{
    if(v===null || !Number.isFinite(v)){
      started=false;
      return;
    }
    const x=start+i*step;
    const y=priceY(v);
    if(!started){
      ctx.moveTo(x,y);
      started=true;
    }else ctx.lineTo(x,y);
  });

  ctx.stroke();
  ctx.restore();
}

function drawMain(){
  const rect=canvas.getBoundingClientRect();
  const w=rect.width,h=rect.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle=COLORS.background;
  ctx.fillRect(0,0,w,h);

  const {start,data}=getVisible();
  if(!data.length) return;

  const left=12,right=w-65,top=18,bottom=h-25;
  const highs=data.map(c=>c.high);
  const lows=data.map(c=>c.low);
  let min=Math.min(...lows),max=Math.max(...highs);

  const values=calculate();
  const overlayIds=["ema","sma","bollinger","keltner","sar"];

  overlayIds.forEach(id=>{
    if(!enabled(id)) return;
    const v=values[id];
    if(!v) return;
    const list=Array.isArray(v)?v:
      id==="bollinger" ? [...v.upper,...v.lower] :
      [...v.upper,...v.lower];

    const nums=list.filter(x=>x!==null&&Number.isFinite(x));
    if(nums.length){
      min=Math.min(min,...nums);
      max=Math.max(max,...nums);
    }
  });

  const padding=(max-min)*.12 || 1;
  min-=padding;
  max+=padding;

  drawGrid(w,h,min,max,left,right,top,bottom);

  const priceY=v=>bottom-(v-min)/(max-min)*(bottom-top);
  const step=(right-left)/data.length;
  const candleW=Math.max(3,Math.min(13,step*.62));

  data.forEach((c,i)=>{
    const x=left+step*(i+.5);
    const up=c.close>=c.open;
    const color=up?COLORS.green:COLORS.red;

    ctx.strokeStyle=color;
    ctx.fillStyle=color;
    ctx.lineWidth=1.4;

    ctx.beginPath();
    ctx.moveTo(x,priceY(c.high));
    ctx.lineTo(x,priceY(c.low));
    ctx.stroke();

    const y1=priceY(c.open);
    const y2=priceY(c.close);
    const bodyH=Math.max(1,Math.abs(y2-y1));

    ctx.fillRect(
      x-candleW/2,
      Math.min(y1,y2),
      candleW,
      bodyH
    );

    const absolute=start+i;
    if(absolute===selected){
      ctx.strokeStyle=COLORS.gold;
      ctx.lineWidth=1.5;
      ctx.strokeRect(x-candleW/2-3,Math.min(y1,y2)-3,candleW+6,bodyH+6);
    }
  });

  const line=(id,color,width)=>{
    if(!enabled(id)) return;
    drawSeries(values[id].slice(start,start+data.length),
      left+step/2,step,priceY,
      settings[id].color || color,
      settings[id].width || width);
  };

  line("ema","#e8bd62",2);
  line("sma","#56a8ff",2);

  if(enabled("bollinger")){
    const b=values.bollinger;
    ["upper","middle","lower"].forEach((key,i)=>{
      drawSeries(b[key].slice(start,start+data.length),
        left+step/2,step,priceY,
        i===1?"#d8b45a":"#7e8fa9",1.5,i!==1);
    });
  }

  if(enabled("keltner")){
    const b=values.keltner;
    ["upper","middle","lower"].forEach((key,i)=>{
      drawSeries(b[key].slice(start,start+data.length),
        left+step/2,step,priceY,
        i===1?"#b78cff":"#8b72b9",1.5,i!==1);
    });
  }

  if(enabled("sar")){
    ctx.fillStyle=settings.sar.color;
    values.sar.slice(start,start+data.length).forEach((v,i)=>{
      if(v===null) return;
      ctx.beginPath();
      ctx.arc(left+step*(i+.5),priceY(v),3,0,Math.PI*2);
      ctx.fill();
    });
  }

  ctx.fillStyle=COLORS.text;
  ctx.fillText("السعر",left,12);
}

function subSeries(id,values){
  const wrap=document.createElement("div");
  wrap.className="panel";
  wrap.style.marginTop="10px";
  wrap.style.padding="10px";

  const title=document.createElement("div");
  title.style.color=COLORS.gold;
  title.style.fontWeight="bold";
  title.style.marginBottom="7px";
  title.textContent=indicatorNames[id];

  const cv=document.createElement("canvas");
  cv.style.width="100%";
  cv.style.height="125px";
  cv.style.display="block";

  wrap.append(title,cv);
  indicatorArea.appendChild(wrap);

  const r=cv.getBoundingClientRect();
  const dpr=Math.min(window.devicePixelRatio||1,2);
  cv.width=Math.round(r.width*dpr);
  cv.height=Math.round(125*dpr);

  const c=cv.getContext("2d");
  c.scale(dpr,dpr);

  const w=r.width,h=125;
  c.fillStyle=COLORS.background;
  c.fillRect(0,0,w,h);

  const {start,data}=getVisible();
  const shown=values.slice(start,start+data.length);
  const nums=shown.filter(v=>v!==null&&Number.isFinite(v));

  if(!nums.length) return;

  let min=Math.min(...nums),max=Math.max(...nums);
  if(min===max){min-=1;max+=1;}
  const pad=(max-min)*.12;
  min-=pad;max+=pad;

  c.strokeStyle=COLORS.grid;
  c.lineWidth=1;
  for(let i=0;i<3;i++){
    const y=10+(h-20)*i/2;
    c.beginPath();c.moveTo(5,y);c.lineTo(w-5,y);c.stroke();
  }

  const xStep=(w-20)/Math.max(1,shown.length-1);
  const y=v=>h-10-(v-min)/(max-min)*(h-20);

  c.strokeStyle=settings[id].color||COLORS.gold;
  c.lineWidth=settings[id].width||2;
  c.beginPath();
  let started=false;

  shown.forEach((v,i)=>{
    if(v===null||!Number.isFinite(v)){
      started=false;return;
    }
    const px=10+i*xStep,py=y(v);
    if(!started){c.moveTo(px,py);started=true;}
    else c.lineTo(px,py);
  });
  c.stroke();

  if(id==="rsi"){
    [30,70].forEach(level=>{
      const py=y(level);
      c.strokeStyle="#8b7180";
      c.setLineDash([4,4]);
      c.beginPath();c.moveTo(5,py);c.lineTo(w-5,py);c.stroke();
      c.setLineDash([]);
    });
  }
}

function drawMACD(){
  if(!enabled("macd")) return;

  const values=calculate().macd;
  const wrap=document.createElement("div");
  wrap.className="panel";
  wrap.style.marginTop="10px";
  wrap.style.padding="10px";

  const title=document.createElement("div");
  title.textContent="MACD";
  title.style.color=COLORS.gold;
  title.style.fontWeight="bold";

  const cv=document.createElement("canvas");
  cv.style.width="100%";
  cv.style.height="125px";
  cv.style.display="block";
  wrap.append(title,cv);
  indicatorArea.appendChild(wrap);

  const r=cv.getBoundingClientRect();
  const dpr=Math.min(window.devicePixelRatio||1,2);
  cv.width=r.width*dpr;cv.height=125*dpr;
  const c=cv.getContext("2d");
  c.scale(dpr,dpr);

  const {start,data}=getVisible();
  const line=values.line.slice(start,start+data.length);
  const signal=values.signal.slice(start,start+data.length);
  const hist=values.histogram.slice(start,start+data.length);

  const all=[...line,...signal,...hist].filter(v=>v!==null);
  if(!all.length) return;

  let min=Math.min(0,...all),max=Math.max(0,...all);
  if(min===max){min-=1;max+=1;}
  const y=v=>115-(v-min)/(max-min)*105;
  const zero=y(0);
  const step=(r.width-20)/Math.max(1,data.length);

  c.strokeStyle=COLORS.grid;
  c.beginPath();c.moveTo(5,zero);c.lineTo(r.width-5,zero);c.stroke();

  hist.forEach((v,i)=>{
    if(v===null)return;
    c.fillStyle=v>=0?COLORS.green:COLORS.red;
    const x=10+(i+.5)*step;
    c.fillRect(x,Math.min(y(v),zero),Math.max(2,step*.5),Math.abs(zero-y(v)));
  });

  const plot=(arr,color)=>{
    c.strokeStyle=color;
    c.lineWidth=2;
    c.beginPath();
    let started=false;
    arr.forEach((v,i)=>{
      if(v===null){started=false;return;}
      const x=10+(i+.5)*step,py=y(v);
      if(!started){c.moveTo(x,py);started=true;}
      else c.lineTo(x,py);
    });
    c.stroke();
  };

  plot(line,COLORS.gold);
  plot(signal,"#63a9ff");
}

function renderIndicators(){
  indicatorArea.innerHTML="";
  const v=calculate();

  const ids=[
    "rsi","stochastic","cci","williams","adx","atr",
    "std","volume","obv","mfi","volumeSma"
  ];

  ids.forEach(id=>{
    if(enabled(id)) subSeries(id,v[id]);
  });

  drawMACD();
}

function renderStats(){
  if($("candleCount")) $("candleCount").textContent=candles.length;
  if($("selectedNumber")) $("selectedNumber").textContent=
    selected>=0 ? selected+1 : "—";
}

function renderCandleEditor(){
  if(!editor) return;

  const c=candles[selected];
  if(!c){
    editor.innerHTML="";
    return;
  }

  editor.innerHTML=`
    <div class="panel" style="margin-top:12px">
      <div style="color:#d8b45a;font-weight:bold;margin-bottom:12px">
        تعديل بيانات الشمعة رقم ${selected+1}
      </div>

      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px">
        ${["open","high","low","close","volume"].map(key=>`
          <label style="font-size:12px;color:#9eacc0">
            ${key.toUpperCase()}
            <input data-candle="${key}" type="number" step="any"
              value="${Number(c[key].toFixed(3))}"
              style="display:block;width:100%;margin-top:5px;padding:10px;background:#0d1727;color:white;border:1px solid #293951;border-radius:7px">
          </label>
        `).join("")}
      </div>

      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="primary" id="saveCandle">حفظ التعديل</button>
        <button id="removeCandle">حذف الشمعة</button>
      </div>
    </div>
  `;

  $("saveCandle").onclick=()=>{
    const next={};
    editor.querySelectorAll("[data-candle]").forEach(input=>{
      next[input.dataset.candle]=Number(input.value);
    });

    if(Object.values(next).some(v=>!Number.isFinite(v))) return;
    if(next.high<Math.max(next.open,next.close) ||
       next.low>Math.min(next.open,next.close) ||
       next.high<next.low || next.volume<0) return;

    candles[selected]=next;
    render();
  };

  $("removeCandle").onclick=deleteSelected;
}

function renderSettings(){
  if(!editor) return;

  const active=Object.keys(indicatorNames).filter(enabled);
  const settingsHTML=`
    <div class="panel">
      <div style="color:#d8b45a;font-weight:bold;margin-bottom:12px">
        إعدادات المؤشرات النشطة
      </div>
      ${
        active.length ? active.map(id=>`
          <div style="padding:10px 0;border-bottom:1px solid #293951">
            <strong style="display:block;margin-bottom:8px">${indicatorNames[id]}</strong>
            <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px">
              <label style="font-size:11px;color:#9eacc0">
                الفترة
                <input type="number" min="2" max="200"
                  data-setting="${id}" data-key="period"
                  value="${settings[id].period}"
                  style="width:100%;padding:8px;background:#0d1727;color:white;border:1px solid #293951;border-radius:6px">
              </label>
              <label style="font-size:11px;color:#9eacc0">
                اللون
                <input type="color"
                  data-setting="${id}" data-key="color"
                  value="${settings[id].color}"
                  style="width:100%;height:35px;background:#0d1727;border:1px solid #293951;border-radius:6px">
              </label>
              <label style="font-size:11px;color:#9eacc0">
                السُمك
                <input type="number" min="1" max="5"
                  data-setting="${id}" data-key="width"
                  value="${settings[id].width}"
                  style="width:100%;padding:8px;background:#0d1727;color:white;border:1px solid #293951;border-radius:6px">
              </label>
            </div>
          </div>
        `).join("") : `<div style="color:#9eacc0;font-size:13px">فعّل مؤشراً لعرض إعداداته.</div>`
      }
    </div>
  `;

  const old=editor.querySelector("#settingsPanel");
  if(old) old.remove();

  const box=document.createElement("div");
  box.id="settingsPanel";
  box.innerHTML=settingsHTML;
  editor.prepend(box);

  box.querySelectorAll("[data-setting]").forEach(input=>{
    input.addEventListener("change",()=>{
      const id=input.dataset.setting;
      const key=input.dataset.key;
      let value=key==="color" ? input.value : Number(input.value);

      if(key==="period") value=Math.max(2,Math.min(200,value||14));
      if(key==="width") value=Math.max(1,Math.min(5,value||2));

      settings[id][key]=value;
      render();
    });
  });
}

function render(){
  if(!canvas) return;
  drawMain();
  renderIndicators();
  renderStats();
  renderCandleEditor();
  renderSettings();
}

/* Mouse and touch navigation */

canvas.addEventListener("pointerdown",e=>{
  dragging=true;
  dragStart=e.clientX;
  initialOffset=offset;
  activePointer=e.pointerId;
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove",e=>{
  if(!dragging || activePointer!==e.pointerId) return;
  const step=canvas.getBoundingClientRect().width/visibleCount;
  const change=Math.round((dragStart-e.clientX)/Math.max(1,step));
  offset=Math.max(0,Math.min(candles.length-5,initialOffset+change));
  render();
});

canvas.addEventListener("pointerup",e=>{
  if(!dragging)return;
  dragging=false;
  activePointer=null;

  const rect=canvas.getBoundingClientRect();
  const {start,data}=getVisible();
  const left=12,right=rect.width-65;
  const step=(right-left)/Math.max(1,data.length);
  const index=Math.floor((e.clientX-rect.left-left)/step);

  if(index>=0 && index<data.length){
    selected=start+index;
    render();
  }
});

canvas.addEventListener("pointercancel",()=>{
  dragging=false;
  activePointer=null;
});

canvas.addEventListener("wheel",e=>{
  e.preventDefault();
  const change=e.deltaY>0?4:-4;
  visibleCount=Math.max(12,Math.min(100,visibleCount+change));
  offset=Math.min(offset,Math.max(0,candles.length-5));
  render();
},{passive:false});

Object.keys(indicatorNames).forEach(id=>{
  const input=$(id);
  if(input) input.addEventListener("change",render);
});

window.addEventListener("resize",resizeCanvas);

createData();
resizeCanvas();
