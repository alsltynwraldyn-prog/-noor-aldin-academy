
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
  white: "#ffffff"
};

function generateCandle(previousClose) {
  const open = previousClose ?? (Math.random() * 100 + 150);
  const close = open + (Math.random() - 0.5) * 35;

  return {
    open: +open.toFixed(2),
    close: +close.toFixed(2),
    high: +(Math.max(open, close) + Math.random() * 15).toFixed(2),
    low: +(Math.min(open, close) - Math.random() * 15).toFixed(2)
  };
}

function drawChart() {
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, w, h);

  const max = Math.max(...candles.map(c => c.high)) + 15;
  const min = Math.min(...candles.map(c => c.low)) - 15;
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
    const y = top + (chartHeight / 5) * i;

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();

    const price = max - (range / 5) * i;
    ctx.fillText(price.toFixed(2), 8, y - 5);
  }

  // رسم الشموع
  const spacing = (w - 70) / Math.max(candles.length, 1);
  const bodyWidth = Math.min(18, spacing * 0.55);

  candles.forEach((c, i) => {
    const x = 50 + i * spacing + spacing / 2;
    const color = c.close >= c.open
      ? colors.bullish
      : colors.bearish;

    const highY = priceY(c.high);
    const lowY = priceY(c.low);
    const openY = priceY(c.open);
    const closeY = priceY(c.close);

    // الفتيل
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, highY);
    ctx.lineTo(x, lowY);
    ctx.stroke();

    // جسم الشمعة
    ctx.fillStyle = color;
    ctx.fillRect(
      x - bodyWidth / 2,
      Math.min(openY, closeY),
      bodyWidth,
      Math.max(Math.abs(openY - closeY), 3)
    );

    // تحديد الشمعة المختارة
    if (i === selectedCandle) {
      ctx.strokeStyle = colors.gold;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - bodyWidth, highY - 5, bodyWidth * 2, lowY - highY + 10);
    }
  });
}

// إضافة شمعة
function addCandle() {
  const previous = candles.length
    ? candles[candles.length - 1].close
    : undefined;

  candles.push(generateCandle(previous));

  if (candles.length > 30) {
    candles.shift();
  }

  selectedCandle = candles.length - 1;
  drawChart();
  updateEditor();
}

// إعادة ضبط
function resetChart() {
  candles = [];

  let previous = 200;

  for (let i = 0; i < 15; i++) {
    const candle = generateCandle(previous);
    candles.push(candle);
    previous = candle.close;
  }

  selectedCandle = -1;
  drawChart();
  updateEditor();
}

// حذف الشمعة المختارة
function deleteCandle() {
  if (selectedCandle < 0) return;

  candles.splice(selectedCandle, 1);
  selectedCandle = -1;
  drawChart();
  updateEditor();
}

// اختيار شمعة بالضغط عليها
canvas.addEventListener("click", function(event) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = (event.clientX - rect.left) * canvas.width / rect.width;

  const spacing = (canvas.width - 70) / Math.max(candles.length, 1);

  const index = Math.floor((mouseX - 50) / spacing);

  if (index >= 0 && index < candles.length) {
    selectedCandle = index;
    drawChart();
    updateEditor();
  }
});

// إنشاء لوحة تعديل الأسعار
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

function updateEditor() {
  if (selectedCandle < 0 || !candles[selectedCandle]) {
    editor.innerHTML = `
      <h3 style="color:#d5b45b">مختبر الشموع اليابانية</h3>
      <p>اضغط على أي شمعة في الرسم لتحديدها وتعديل أسعارها.</p>
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

function field(label, key, value) {
  return `
    <label style="display:block">
      ${label}
      <input type="number" step="0.01" value="${value}"
        onchange="changePrice('${key}',this.value)"
        style="width:100%;box-sizing:border-box;padding:10px;margin-top:5px">
    </label>
  `;
}

// تعديل الأسعار مع التحقق من صحة الشمعة
function changePrice(key, value) {
  const c = candles[selectedCandle];
  if (!c) return;

  const number = Number(value);

  if (value === "" || !Number.isFinite(number)) {
    updateEditor();
    return;
  }

  const updated = { ...c, [key]: number };

  if (
    updated.high < Math.max(updated.open, updated.close) ||
    updated.low > Math.min(updated.open, updated.close) ||
    updated.high < updated.low
  ) {
    document.getElementById("editorError").textContent =
      "خطأ: تأكد من أن الأعلى أكبر من الافتتاح والإغلاق، والأدنى أقل منهما.";
    return;
  }

  candles[selectedCandle] = updated;
  drawChart();
  updateEditor();
}

// تجهيز المختبر
resetChart();
