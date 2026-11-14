
const canvas = document.getElementById("tradingChart");
const ctx = canvas.getContext("2d");

let candles = [];
let selectedCandle = -1;

const colors = {
  background: "#101827",
  grid: "#34465c",
  gold: "#d5b45b",
  bullish: "#00c087",
  bearish: "#ef5350",
  ema: "#ffb74d",
  sma: "#42a5f5"
};

const emaToggle = document.getElementById("showEMA");
const smaToggle = document.getElementById("showSMA");

function generateCandle(previousClose) {
  const open = previousClose ?? 200 + Math.random() * 30;
  const close = open + (Math.random() - 0.5) * 35;

  return {
    open: +open.toFixed(2),
    close: +close.toFixed(2),
    high: +(Math.max(open, close) + Math.random() * 15).toFixed(2),
    low: +(Math.min(open, close) - Math.random() * 15).toFixed(2)
  };
}

// المتوسط المتحرك البسيط SMA
function calculateSMA(period = 5) {
  return candles.map((c, i) => {
    if (i < period - 1) return null;

    const values = candles
      .slice(i - period + 1, i + 1)
      .map(item => item.close);

    return values.reduce((a, b) => a + b, 0) / period;
  });
}

// المتوسط المتحرك الأسي EMA
function calculateEMA(period = 5) {
  const result = [];
  const multiplier = 2 / (period + 1);

  let previous = null;

  candles.forEach((c, i) => {
    if (i === period - 1) {
      const initial = candles
        .slice(0, period)
        .reduce((sum, item) => sum + item.close, 0) / period;

      previous = initial;
      result.push(initial);
    } else if (i >= period) {
      previous = (c.close - previous) * multiplier + previous;
      result.push(previous);
    } else {
      result.push(null);
    }
  });

  return result;
}

function drawChart() {
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, w, h);

  if (!candles.length) return;

  const allValues = candles.flatMap(c => [c.high, c.low]);

  const max = Math.max(...allValues) + 15;
  const min = Math.min(...allValues) - 15;
  const range = max - min || 1;

  const top = 30;
  const bottom = h - 35;
  const chartHeight = bottom - top;

  function priceY(price) {
    return bottom - ((price - min) / range) * chartHeight;
  }

  // شبكة الأسعار
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.font = "12px Arial";
  ctx.fillStyle = colors.gold;

  for (let i = 0; i <= 5; i++) {
    const y = top + chartHeight / 5 * i;

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();

    const price = max - range / 5 * i;
    ctx.fillText(price.toFixed(2), 8, y - 5);
  }

  const spacing = (w - 70) / Math.max(candles.length, 1);
  const bodyWidth = Math.min(18, spacing * 0.55);

  // رسم الشموع
  candles.forEach((c, i) => {
    const x = 50 + i * spacing + spacing / 2;

    const color = c.close >= c.open
      ? colors.bullish
      : colors.bearish;

    const highY = priceY(c.high);
    const lowY = priceY(c.low);
    const openY = priceY(c.open);
    const closeY = priceY(c.close);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(x, highY);
    ctx.lineTo(x, lowY);
    ctx.stroke();

    ctx.fillStyle = color;

    ctx.fillRect(
      x - bodyWidth / 2,
      Math.min(openY, closeY),
      bodyWidth,
      Math.max(Math.abs(openY - closeY), 3)
    );

    if (i === selectedCandle) {
      ctx.strokeStyle = colors.gold;
      ctx.lineWidth = 2;
      ctx.strokeRect(
        x - bodyWidth,
        highY - 5,
        bodyWidth * 2,
        lowY - highY + 10
      );
    }
  });

  // رسم EMA
  if (emaToggle?.checked) {
    drawIndicator(calculateEMA(5), colors.ema, priceY);
  }

  // رسم SMA
  if (smaToggle?.checked) {
    drawIndicator(calculateSMA(5), colors.sma, priceY);
  }
}

function drawIndicator(values, color, priceY) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;

  const spacing = (canvas.width - 70) / candles.length;
  let started = false;

  values.forEach((value, i) => {
    if (value === null) return;

    const x = 50 + i * spacing + spacing / 2;
    const y = priceY(value);

    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();
}

// لوحة تعديل الشمعة
const editor = document.createElement("div");

editor.style.cssText = `
background:#172b43;
color:white;
padding:15px;
margin:15px 0;
border:1px solid #d5b45b;
border-radius:12px;
`;

canvas.parentNode.after(editor);

function field(label, key, value) {
  return `
    <label style="display:block">
      ${label}
      <input type="number" step="0.01"
        value="${value}"
        onchange="changePrice('${key}',this.value)"
        style="width:100%;box-sizing:border-box;padding:10px;margin-top:5px">
    </label>
  `;
}

function updateEditor() {
  if (selectedCandle < 0 || !candles[selectedCandle]) {
    editor.innerHTML = `
      <h3 style="color:#d5b45b">مختبر الشموع اليابانية</h3>
      <p>اضغط على شمعة لتحديدها وتعديل أسعارها.</p>
      <p>عدد الشموع: ${candles.length}</p>
    `;
    return;
  }

  const c = candles[selectedCandle];

  editor.innerHTML = `
    <h3 style="color:#d5b45b">تعديل الشمعة رقم ${selectedCandle + 1}</h3>

    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
      ${field("الافتتاح", "open", c.open)}
      ${field("الإغلاق", "close", c.close)}
      ${field("أعلى سعر", "high", c.high)}
      ${field("أدنى سعر", "low", c.low)}
    </div>

    <p id="editorError" style="color:#ef5350"></p>

    <button onclick="deleteCandle()"
      style="background:#ef5350;color:white;padding:10px;border:0;border-radius:7px;margin-top:12px">
      حذف الشمعة
    </button>
  `;
}

function changePrice(key, value) {
  const c = candles[selectedCandle];
  if (!c) return;

  if (value === "" || !Number.isFinite(Number(value))) {
    updateEditor();
    return;
  }

  const updated = { ...c, [key]: Number(value) };

  if (
    updated.high < Math.max(updated.open, updated.close) ||
    updated.low > Math.min(updated.open, updated.close) ||
    updated.high < updated.low
  ) {
    document.getElementById("editorError").textContent =
      "تحقق من صحة أسعار الشمعة.";
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

  for (let i = 0; i < 15; i++) {
    const c = generateCandle(previous);
    candles.push(c);
    previous = c.close;
  }

  selectedCandle = -1;
  drawChart();
  updateEditor();
}

// اختيار الشمعة بالضغط عليها
canvas.addEventListener("click", event => {
  const rect = canvas.getBoundingClientRect();

  const mouseX =
    (event.clientX - rect.left) * canvas.width / rect.width;

  const spacing = (canvas.width - 70) / candles.length;
  const index = Math.floor((mouseX - 50) / spacing);

  if (index >= 0 && index < candles.length) {
    selectedCandle = index;
    drawChart();
    updateEditor();
  }
});

// تشغيل وإيقاف المؤشرات
emaToggle?.addEventListener("change", drawChart);
smaToggle?.addEventListener("change", drawChart);

// تشغيل المختبر
resetChart();
