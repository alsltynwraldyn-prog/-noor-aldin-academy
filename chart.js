const canvas = document.getElementById("tradingChart");
const ctx = canvas.getContext("2d");

let candles = [];

function generateCandle() {
  const open = Math.random() * 200 + 100;
  const close = open + (Math.random() - 0.5) * 40;

  return {
    open,
    close,
    high: Math.max(open, close) + Math.random() * 20,
    low: Math.min(open, close) - Math.random() * 20
  };
}

function drawChart() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;

  for (let y = 0; y < canvas.height; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  candles.forEach((candle, index) => {
    const x = 30 + index * 35;

    const openY = canvas.height - candle.open;
    const closeY = canvas.height - candle.close;
    const highY = canvas.height - candle.high;
    const lowY = canvas.height - candle.low;

    const color = candle.close >= candle.open ? "#00c087" : "#ef5350";

    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    ctx.beginPath();
    ctx.moveTo(x, highY);
    ctx.lineTo(x, lowY);
    ctx.stroke();

    ctx.fillRect(
      x - 7,
      Math.min(openY, closeY),
      14,
      Math.max(Math.abs(openY - closeY), 2)
    );
  });
}

function addCandle() {
  candles.push(generateCandle());

  if (candles.length > 24) {
    candles.shift();
  }

  drawChart();
}

function resetChart() {
  candles = [];
  for (let i = 0; i < 15; i++) {
    candles.push(generateCandle());
  }
  drawChart();
}

resetChart();