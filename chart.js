
const canvas = document.getElementById("tradingChart");
const ctx = canvas.getContext("2d");

let candles = [];
let selectedCandle = -1;

const C = {
  bg: "#101827",
  grid: "#34465c",
  gold: "#d5b45b",
  green: "#00c087",
  red: "#ef5350",
  blue: "#42a5f5",
  orange: "#ffb74d",
  purple: "#b388ff",
  white: "#ffffff"
};

const indicatorNames = {
  showEMA: "EMA - المتوسط الأسي",
  showSMA: "SMA - المتوسط البسيط",
  showADX: "ADX - قوة الاتجاه",
  showSAR: "Parabolic SAR",
  showRSI: "RSI - القوة النسبية",
  showMACD: "MACD",
  showStochastic: "Stochastic",
  showCCI: "CCI",
  showWilliams: "Williams %R",
  showBB: "Bollinger Bands",
  showATR: "ATR",
  showKeltner: "Keltner Channels",
  showStdDev: "Standard Deviation",
  showVolume: "Volume",
  showOBV: "OBV",
  showMFI: "MFI",
  showVolumeSMA: "Volume SMA"
};

const editor = document.createElement("div");
editor.style.cssText = `
background:#172b43;color:white;padding:15px;
margin:15px 0;border:1px solid #d5b45b;
border-radius:12px;
`;

const subcharts = document.createElement("div");
subcharts.id = "indicatorCharts";

canvas.parentNode.insertAdjacentElement("afterend", editor);
editor.insertAdjacentElement("afterend", subcharts);

// إنشاء شمعة تجريبية
function generateCandle(previousClose) {
  const open = previousClose ?? 200 + Math.random() * 30;
  const close = open + (Math.random() - 0.5) * 35;

  return {
    open,
    close,
    high: Math.max(open, close) + Math.random() * 15,
    low: Math.min(open, close) - Math.random() * 15,
    volume: Math.round(500 + Math.random() * 9500)
  };
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length
    ? valid.reduce((a, b) => a + b, 0) / valid.length
    : null;
}

// المتوسط البسيط
function SMA(values, period) {
  return values.map((v, i) => {
    if (i < period - 1) return null;
    return average(values.slice(i - period + 1, i + 1));
  });
}

// المتوسط الأسي
function EMA(values, period) {
  const result = [];
  const multiplier = 2 / (period + 1);
  let previous = null;

  values.forEach((v, i) => {
    if (i === period - 1) {
      previous = average(values.slice(0, period));
      result.push(previous);
    } else if (i >= period) {
      previous = (v - previous) * multiplier + previous;
      result.push(previous);
    } else {
      result.push(null);
    }
  });

  return result;
}

const closes = () => candles.map(c => c.close);
const highs = () => candles.map(c => c.high);
const lows = () => candles.map(c => c.low);
const volumes = () => candles.map(c => c.volume);

function trueRanges() {
  return candles.map((c, i) => {
    if (i === 0) return c.high - c.low;

    const previous = candles[i - 1].close;

    return Math.max(
      c.high - c.low,
      Math.abs(c.high - previous),
      Math.abs(c.low - previous)
    );
  });
}

// ATR
function ATR(period = 14) {
  return SMA(trueRanges(), period);
}

// الانحراف المعياري
function STD(values, period = 20) {
  return values.map((v, i) => {
    if (i < period - 1) return null;

    const group = values.slice(i - period + 1, i + 1);
    const mean = average(group);

    return Math.sqrt(
      average(group.map(x => (x - mean) ** 2))
    );
  });
}

// RSI
function RSI(period = 14) {
  const values = closes();

  return values.map((v, i) => {
    if (i < period) return null;

    let gains = 0;
    let losses = 0;

    for (let j = i - period + 1; j <= i; j++) {
      const change = values[j] - values[j - 1];

      if (change > 0) gains += change;
      else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgGain === 0 && avgLoss === 0) return 50;
    if (avgLoss === 0) return 100;
    if (avgGain === 0) return 0;

    return 100 - 100 / (1 + avgGain / avgLoss);
  });
}

// MACD
function MACD() {
  const fast = EMA(closes(), 12);
  const slow = EMA(closes(), 26);

  const line = fast.map((v, i) =>
    v === null || slow[i] === null ? null : v - slow[i]
  );

  const valid = line.filter(v => v !== null);
  const signalValid = EMA(valid, 9);
  const signal = Array(line.length).fill(null);

  let j = 0;
  line.forEach((v, i) => {
    if (v !== null) signal[i] = signalValid[j++];
  });

  const histogram = line.map((v, i) =>
    v === null || signal[i] === null ? null : v - signal[i]
  );

  return { line, signal, histogram };
}

// Stochastic
function STOCH() {
  const result = candles.map((c, i) => {
    if (i < 13) return null;

    const highest = Math.max(...highs().slice(i - 13, i + 1));
    const lowest = Math.min(...lows().slice(i - 13, i + 1));

    return highest === lowest
      ? 50
      : ((c.close - lowest) / (highest - lowest)) * 100;
  });

  return { k: result, d: SMA(result.map(v => v ?? 0), 3)
    .map((v, i) => result[i] === null ? null : v) };
}

// CCI
function CCI(period = 20) {
  const typical = candles.map(c =>
    (c.high + c.low + c.close) / 3
  );

  return typical.map((v, i) => {
    if (i < period - 1) return null;

    const group = typical.slice(i - period + 1, i + 1);
    const mean = average(group);
    const deviation = average(group.map(x => Math.abs(x - mean)));

    return deviation === 0 ? 0 : (v - mean) / (0.015 * deviation);
  });
}

// Williams %R
function WILLIAMS(period = 14) {
  return candles.map((c, i) => {
    if (i < period - 1) return null;

    const high = Math.max(...highs().slice(i - period + 1, i + 1));
    const low = Math.min(...lows().slice(i - period + 1, i + 1));

    return high === low ? -50 :
      ((high - c.close) / (high - low)) * -100;
  });
}

// OBV
function OBV() {
  let total = 0;

  return candles.map((c, i) => {
    if (i > 0) {
      if (c.close > candles[i - 1].close) total += c.volume;
      if (c.close < candles[i - 1].close) total -= c.volume;
    }
    return total;
  });
}

// MFI
function MFI(period = 14) {
  const typical = candles.map(c =>
    (c.high + c.low + c.close) / 3
  );

  const money = typical.map((v, i) => v * candles[i].volume);

  return candles.map((c, i) => {
    if (i < period) return null;

    let positive = 0;
    let negative = 0;

    for (let j = i - period + 1; j <= i; j++) {
      if (typical[j] > typical[j - 1]) positive += money[j];
      else if (typical[j] < typical[j - 1]) negative += money[j];
    }

    if (positive === 0 && negative === 0) return 50;
    if (negative === 0) return 100;
    if (positive === 0) return 0;

    return 100 - 100 / (1 + positive / negative);
  });
}

// ADX تعليمي
function ADX(period = 14) {
  const tr = trueRanges();

  const dx = candles.map((c, i) => {
    if (i < period) return null;

    let plus = 0;
    let minus = 0;
    let range = 0;

    for (let j = i - period + 1; j <= i; j++) {
      const up = candles[j].high - candles[j - 1].high;
      const down = candles[j - 1].low - candles[j].low;

      if (up > down && up > 0) plus += up;
      if (down > up && down > 0) minus += down;

      range += tr[j];
    }

    if (range === 0) return 0;

    const p = plus / range * 100;
    const m = minus / range * 100;

    return p + m === 0 ? 0 :
      Math.abs(p - m) / (p + m) * 100;
  });

  return SMA(dx.map(v => v ?? 0), period)
    .map((v, i) => dx[i] === null ? null : v);
}

// Parabolic SAR - تقريب تعليمي
function SAR() {
  const result = [];
  let rising = true;
  let sar = candles[0]?.low ?? 0;
  let extreme = candles[0]?.high ?? 0;
  let acceleration = 0.02;

  candles.forEach((c, i) => {
    if (i === 0) {
      result.push(sar);
      return;
    }

    sar = sar + acceleration * (extreme - sar);

    if (rising) {
      sar = Math.min(sar, candles[i - 1].low);
      if (c.low < sar) {
        rising = false;
        sar = extreme;
        extreme = c.low;
        acceleration = 0.02;
      } else if (c.high > extreme) {
        extreme = c.high;
        acceleration = Math.min(acceleration + 0.02, 0.2);
      }
    } else {
      sar = Math.max(sar, candles[i - 1].high);
      if (c.high > sar) {
        rising = true;
        sar = extreme;
        extreme = c.high;
        acceleration = 0.02;
      } else if (c.low < extreme) {
        extreme = c.low;
        acceleration = Math.min(acceleration + 0.02, 0.2);
      }
    }

    result.push(sar);
  });

  return result;
}

// جميع المؤشرات
function getIndicators() {
  const close = closes();
  const sma20 = SMA(close, 20);
  const ema20 = EMA(close, 20);
  const std = STD(close, 20);
  const atr = ATR(14);

  return {
    ema: EMA(close, 5),
    sma: SMA(close, 5),
    adx: ADX(),
    sar: SAR(),
    rsi: RSI(),
    macd: MACD(),
    stoch: STOCH(),
    cci: CCI(),
    williams: WILLIAMS(),
    bbUpper: sma20.map((v, i) =>
      v === null || std[i] === null ? null : v + 2 * std[i]),
    bbLower: sma20.map((v, i) =>
      v === null || std[i] === null ? null : v - 2 * std[i]),
    keltnerUpper: ema20.map((v, i) =>
      v === null || atr[i] === null ? null : v + 2 * atr[i]),
    keltnerLower: ema20.map((v, i) =>
      v === null || atr[i] === null ? null : v - 2 * atr[i]),
    atr,
    std,
    volume: volumes(),
    obv: OBV(),
    mfi: MFI(),
    volumeSMA: SMA(volumes(), 5)
  };
}

function selected(id) {
  return document.getElementById(id)?.checked ?? false;
}

function drawLine(values, color, priceY, width = 2) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;

  let started = false;

  const spacing = (canvas.width - 70) / candles.length;

  values.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) {
      started = false;
      return;
    }

    const x = 50 + i * spacing + spacing / 2;
    const y = priceY(v);

    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();
}

function drawChart() {
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, w, h);

  if (!candles.length) return;

  const indicators = getIndicators();
  const values = [...candles.flatMap(c => [c.high, c.low])];

  [
    ["showEMA", indicators.ema],
    ["showSMA", indicators.sma],
    ["showBB", indicators.bbUpper, indicators.bbLower],
    ["showKeltner", indicators.keltnerUpper, indicators.keltnerLower],
    ["showSAR", indicators.sar]
  ].forEach(([id, ...arrays]) => {
    if (selected(id)) {
      arrays.forEach(arr => arr.forEach(v => {
        if (Number.isFinite(v)) values.push(v);
      }));
    }
  });

  const max = Math.max(...values) + 10;
  const min = Math.min(...values) - 10;
  const range = max - min || 1;
  const top = 25;
  const bottom = h - 35;
  const height = bottom - top;

  const priceY = v => bottom - (v - min) / range * height;

  // الشبكة
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  ctx.fillStyle = C.gold;
  ctx.font = "13px Arial";

  for (let i = 0; i <= 5; i++) {
    const y = top + height / 5 * i;

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();

    ctx.fillText(
      (max - range / 5 * i).toFixed(2),
      5,
      y - 5
    );
  }

  const spacing = (w - 70) / candles.length;
  const bodyWidth = Math.min(18, spacing * 0.55);

  // الشموع
  candles.forEach((c, i) => {
    const x = 50 + i * spacing + spacing / 2;
    const color = c.close >= c.open ? C.green : C.red;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(x, priceY(c.high));
    ctx.lineTo(x, priceY(c.low));
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.fillRect(
      x - bodyWidth / 2,
      Math.min(priceY(c.open), priceY(c.close)),
      bodyWidth,
      Math.max(Math.abs(priceY(c.open) - priceY(c.close)), 3)
    );

    if (i === selectedCandle) {
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 2;
      ctx.strokeRect(
        x - bodyWidth,
        priceY(c.high) - 5,
        bodyWidth * 2,
        priceY(c.low) - priceY(c.high) + 10
      );
    }
  });

  // المؤشرات المرسومة فوق السعر
  if (selected("showEMA")) drawLine(indicators.ema, C.orange, priceY);
  if (selected("showSMA")) drawLine(indicators.sma, C.blue, priceY);

  if (selected("showBB")) {
    drawLine(indicators.bbUpper, C.purple, priceY);
    drawLine(indicators.bbLower, C.purple, priceY);
  }

  if (selected("showKeltner")) {
    drawLine(indicators.keltnerUpper, C.orange, priceY);
    drawLine(indicators.keltnerLower, C.orange, priceY);
  }

  if (selected("showSAR")) {
    indicators.sar.forEach((v, i) => {
      if (v === null) return;
      const x = 50 + i * spacing + spacing / 2;

      ctx.fillStyle = C.gold;
      ctx.beginPath();
      ctx.arc(x, priceY(v), 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  document.getElementById("candleCount").textContent = candles.length;
  document.getElementById("selectedNumber").textContent =
    selectedCandle < 0 ? "لا يوجد" : selectedCandle + 1;

  drawSubcharts(indicators);
}

// رسم المؤشرات في نوافذ مستقلة
function drawSubcharts(ind) {
  const definitions = [
    ["showRSI", "RSI - القوة النسبية", ind.rsi, C.orange, [0, 100], [30, 70]],
    ["showMACD", "MACD - تقارب وتباعد المتوسطات", ind.macd.line, C.blue, null, null],
    ["showStochastic", "Stochastic", ind.stoch.k, C.purple, [0, 100], [20, 80]],
    ["showCCI", "CCI", ind.cci, C.orange, null, [-100, 100]],
    ["showWilliams", "Williams %R", ind.williams, C.blue, [-100, 0], [-80, -20]],
    ["showATR", "ATR - متوسط المدى الحقيقي", ind.atr, C.orange],
    ["showADX", "ADX - قوة الاتجاه", ind.adx, C.purple, [0, 100], [25]],
    ["showStdDev", "Standard Deviation", ind.std, C.blue],
    ["showVolume", "Volume - حجم التداول", ind.volume, C.green],
    ["showOBV", "OBV - حجم التداول التراكمي", ind.obv, C.orange],
    ["showMFI", "MFI - تدفق السيولة", ind.mfi, C.purple, [0, 100], [20, 80]],
    ["showVolumeSMA", "Volume SMA - متوسط الحجم", ind.volumeSMA, C.blue]
  ];

  subcharts.innerHTML = "";

  definitions.forEach(([id, title, values, color, fixed, levels]) => {
    if (!selected(id)) return;

    const box = document.createElement("div");
    box.style.cssText = `
      background:#172b43;border:1px solid #34465c;
      border-radius:10px;margin:14px 0;padding:12px;
    `;

    const heading = document.createElement("h3");
    heading.textContent = title;
    heading.style.color = C.gold;

    const chart = document.createElement("canvas");
    chart.width = 1000;
    chart.height = 180;
    chart.style.cssText = "width:100%;height:auto;display:block";

    box.append(heading, chart);
    subcharts.appendChild(box);

    const subctx = chart.getContext("2d");
    const valid = values.filter(Number.isFinite);

    if (!valid.length) {
      subctx.fillStyle = C.white;
      subctx.fillText("لا توجد بيانات كافية لحساب هذا المؤشر", 20, 40);
      return;
    }

    let min = fixed ? fixed[0] : Math.min(...valid);
    let max = fixed ? fixed[1] : Math.max(...valid);

    if (max === min) {
      max += 1;
      min -= 1;
    }

    const padding = (max - min) * 0.1;
    if (!fixed) {
      max += padding;
      min -= padding;
    }

    const y = v => 145 - ((v - min) / (max - min)) * 125;
    const x = i => 45 + i * (900 / candles.length);

    subctx.fillStyle = C.bg;
    subctx.fillRect(0, 0, 1000, 180);

    subctx.strokeStyle = C.grid;
    subctx.lineWidth = 1;

    [35, 75, 115, 155].forEach(level => {
      subctx.beginPath();
      subctx.moveTo(0, level);
      subctx.lineTo(1000, level);
      subctx.stroke();
    });

    if (levels) {
      levels.forEach(level => {
        subctx.strokeStyle = "#d5b45b88";
        subctx.setLineDash([5, 5]);
        subctx.beginPath();
        subctx.moveTo(0, y(level));
        subctx.lineTo(1000, y(level));
        subctx.stroke();
        subctx.setLineDash([]);
      });
    }

    if (id === "showVolume") {
      const maximum = Math.max(...valid) || 1;
      const barWidth = Math.max(3, 850 / candles.length * 0.6);

      values.forEach((v, i) => {
        if (!Number.isFinite(v)) return;

        const barHeight = v / maximum * 120;

        subctx.fillStyle =
          candles[i].close >= candles[i].open ? C.green : C.red;

        subctx.fillRect(
          x(i) - barWidth / 2,
          155 - barHeight,
          barWidth,
          barHeight
        );
      });

    } else if (id === "showMACD") {
      const signal = ind.macd.signal;
      const histogram = ind.macd.histogram;

      histogram.forEach((v, i) => {
        if (!Number.isFinite(v)) return;

        subctx.fillStyle = v >= 0 ? C.green : C.red;
        subctx.fillRect(x(i) - 3, y(0), 6, y(v) - y(0));
      });

      drawSubLine(subctx, values, x, y, C.blue);
      drawSubLine(subctx, signal, x, y, C.orange);

    } else {
      drawSubLine(subctx, values, x, y, color);
    }
  });
}

function drawSubLine(context, values, x, y, color) {
  context.beginPath();
  context.strokeStyle = color;
  context.lineWidth = 2;
  let started = false;

  values.forEach((v, i) => {
    if (!Number.isFinite(v)) {
      started = false;
      return;
    }

    if (!started) {
      context.moveTo(x(i), y(v));
      started = true;
    } else {
      context.lineTo(x(i), y(v));
    }
  });

  context.stroke();
}

// لوحة تعديل الشمعة
function updateEditor() {
  if (selectedCandle < 0 || !candles[selectedCandle]) {
    editor.innerHTML = `
      <h3 style="color:#d5b45b">مختبر الشموع اليابانية</h3>
      <p>اضغط على أي شمعة لتحديدها وتعديل أسعارها.</p>
    `;
    return;
  }

  const c = candles[selectedCandle];

  editor.innerHTML = `
    <h3 style="color:#d5b45b">تعديل الشمعة رقم ${selectedCandle + 1}</h3>

    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
      ${field("الافتتاح","open",c.open)}
      ${field("الإغلاق","close",c.close)}
      ${field("أعلى سعر","high",c.high)}
      ${field("أدنى سعر","low",c.low)}
      ${field("حجم التداول","volume",c.volume)}
    </div>

    <p id="editorError" style="color:#ef5350"></p>
    <button onclick="deleteCandle()" style="background:#ef5350;color:white">
      حذف الشمعة
    </button>
  `;
}

function field(label, key, value) {
  return `
    <label>
      ${label}
      <input type="number" step="0.01" value="${value}"
        onchange="changePrice('${key}',this.value)"
        style="width:100%;padding:10px;margin-top:5px;box-sizing:border-box">
    </label>
  `;
}

function changePrice(key, value) {
  const c = candles[selectedCandle];
  if (!c || value === "" || !Number.isFinite(Number(value))) return;

  const updated = {...c, [key]: Number(value)};

  if (
    updated.high < Math.max(updated.open, updated.close) ||
    updated.low > Math.min(updated.open, updated.close) ||
    updated.high < updated.low ||
    updated.volume < 0
  ) {
    document.getElementById("editorError").textContent =
      "تحقق من صحة الأسعار وحجم التداول.";
    return;
  }

  candles[selectedCandle] = updated;
  drawChart();
  updateEditor();
}

function addCandle() {
  const previous = candles.length
    ? candles[candles.length - 1].close
    : undefined;

  candles.push(generateCandle(previous));

  if (candles.length > 30) candles.shift();

  selectedCandle = candles.length - 1;
  drawChart();
  updateEditor();
}

function deleteCandle() {
  if (selectedCandle < 0) return;

  candles.splice(selectedCandle, 1);
  selectedCandle = -1;

  drawChart();
  updateEditor();
}

function resetChart() {
  candles = [];
  let previous = 200;

  for (let i = 0; i < 30; i++) {
    const c = generateCandle(previous);
    candles.push(c);
    previous = c.close;
  }

  selectedCandle = -1;
  drawChart();
  updateEditor();
}

// تحديد الشمعة بالضغط
canvas.addEventListener("click", event => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = (event.clientX - rect.left) * canvas.width / rect.width;

  const spacing = (canvas.width - 70) / candles.length;
  const index = Math.floor((mouseX - 50) / spacing);

  if (index >= 0 && index < candles.length) {
    selectedCandle = index;
    drawChart();
    updateEditor();
  }
});

// ربط جميع أزرار المؤشرات
Object.keys(indicatorNames).forEach(id => {
  document.getElementById(id)?.addEventListener("change", drawChart);
});

// تشغيل المختبر
resetChart();
