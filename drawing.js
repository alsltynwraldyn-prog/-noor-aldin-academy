
"use strict";

/* ORVEXAL - DRAWING TOOLS */

(function () {
  const chart = document.getElementById("tradingChart");
  if (!chart) return;

  const wrapper = chart.parentElement;
  wrapper.style.position = "relative";

  const tools = [
    ["cursor", "تحديد"],
    ["trend", "خط اتجاه"],
    ["horizontal", "دعم / مقاومة"],
    ["fib", "فيبوناتشي"],
    ["rectangle", "مستطيل"]
  ];

  let mode = "cursor";
  let drawings = [];
  let pending = null;
  let selectedDrawing = -1;

  const storageKey = "nourAcademyDrawings";

  try {
    drawings = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(drawings)) drawings = [];
  } catch {
    drawings = [];
  }

  const toolbar = document.createElement("div");
  toolbar.id = "drawingToolbar";
  toolbar.style.cssText = `
    display:flex;
    flex-wrap:wrap;
    gap:7px;
    padding:10px;
    margin-bottom:10px;
    background:#131f32;
    border:1px solid #293951;
    border-radius:10px;
  `;

  const buttons = {};

  tools.forEach(([id, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.cssText = `
      padding:9px 12px;
      border:1px solid #d8b45a;
      border-radius:7px;
      background:#24334a;
      color:white;
      font-size:12px;
    `;

    button.addEventListener("click", () => {
      mode = id;
      pending = null;
      selectedDrawing = -1;
      updateToolbar();
      drawAll();
    });

    buttons[id] = button;
    toolbar.appendChild(button);
  });

  function addAction(label, callback) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.cssText = `
      padding:9px 12px;
      border:1px solid #53677f;
      border-radius:7px;
      background:#192940;
      color:white;
      font-size:12px;
    `;
    button.addEventListener("click", callback);
    toolbar.appendChild(button);
    return button;
  }

  addAction("تراجع", () => {
    drawings.pop();
    selectedDrawing = -1;
    save();
    drawAll();
  });

  addAction("حذف المحدد", () => {
    if (selectedDrawing < 0) return;
    drawings.splice(selectedDrawing, 1);
    selectedDrawing = -1;
    save();
    drawAll();
  });

  addAction("مسح الكل", () => {
    if (!confirm("هل تريد حذف جميع الرسومات؟")) return;
    drawings = [];
    selectedDrawing = -1;
    pending = null;
    save();
    drawAll();
  });

  wrapper.parentElement.insertBefore(toolbar, wrapper);

  const layer = document.createElement("canvas");
  layer.id = "drawingLayer";
  layer.style.cssText = `
    position:absolute;
    top:0;
    left:0;
    width:100%;
    height:100%;
    z-index:5;
    pointer-events:none;
    touch-action:none;
  `;
  wrapper.appendChild(layer);

  const pen = layer.getContext("2d");

  function updateToolbar() {
    Object.entries(buttons).forEach(([id, button]) => {
      button.style.background =
        mode === id ? "#d8b45a" : "#24334a";
      button.style.color =
        mode === id ? "#101827" : "white";
    });

    layer.style.pointerEvents =
      mode === "cursor" ? "none" : "auto";

    layer.style.cursor =
      mode === "cursor" ? "default" : "crosshair";
  }

  function visibleData() {
    if (typeof getVisible !== "function") return null;
    return getVisible();
  }

  function priceRange() {
    const visible = visibleData();
    if (!visible || !visible.data.length) return null;

    const data = visible.data;
    let min = Math.min(...data.map(c => c.low));
    let max = Math.max(...data.map(c => c.high));

    const values = typeof calculate === "function"
      ? calculate() : {};

    ["ema", "sma", "bollinger", "keltner"].forEach(id => {
      if (typeof enabled !== "function" || !enabled(id)) return;

      const v = values[id];
      if (!v) return;

      const list = Array.isArray(v)
        ? v
        : [...(v.upper || []), ...(v.lower || [])];

      const nums = list.filter(Number.isFinite);
      if (nums.length) {
        min = Math.min(min, ...nums);
        max = Math.max(max, ...nums);
      }
    });

    const padding = (max - min) * .12 || 1;
    return { min: min - padding, max: max + padding };
  }

  function dimensions() {
    const rect = layer.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const width = rect.width;
    const height = rect.height;

    if (layer.width !== Math.round(width * dpr) ||
        layer.height !== Math.round(height * dpr)) {
      layer.width = Math.round(width * dpr);
      layer.height = Math.round(height * dpr);
    }

    pen.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height };
  }

  function coordinates() {
    const visible = visibleData();
    const range = priceRange();
    const { width, height } = dimensions();

    if (!visible || !range) return null;

    const left = 12;
    const right = width - 65;
    const top = 18;
    const bottom = height - 25;
    const step = (right - left) / visible.data.length;

    return {
      start: visible.start,
      count: visible.data.length,
      left, right, top, bottom, step,
      x(index) {
        return left + (index - visible.start + .5) * step;
      },
      y(price) {
        return bottom -
          (price - range.min) /
          (range.max - range.min) *
          (bottom - top);
      },
      price(y) {
        return range.min +
          (bottom - y) /
          (bottom - top) *
          (range.max - range.min);
      },
      index(x) {
        return Math.round(
          visible.start + (x - left) / step - .5
        );
      }
    };
  }

  function pointerPosition(event) {
    const rect = layer.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function makePoint(pos, map) {
    return {
      index: Math.max(0, Math.min(
        candles.length - 1, map.index(pos.x)
      )),
      price: map.price(pos.y)
    };
  }

  function distanceToSegment(point, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    if (!length) return Math.hypot(point.x - a.x, point.y - a.y);
    const t = Math.max(0, Math.min(1,
      ((point.x-a.x)*dx + (point.y-a.y)*dy) / length
    ));
    return Math.hypot(point.x-(a.x+t*dx), point.y-(a.y+t*dy));
  }

  function drawingDistance(drawing, point, map) {
    const a = pointXY(drawing.a, map);
    if (drawing.type === "horizontal") return Math.abs(point.y-a.y);
    const b = pointXY(drawing.b, map);
    if (drawing.type === "trend") return distanceToSegment(point,a,b);
    if (drawing.type === "fib") {
      return Math.min(...[0,.236,.382,.5,.618,.786,1].map(level =>
        Math.abs(point.y-(a.y+(b.y-a.y)*level))
      ));
    }
    if (drawing.type === "rectangle") {
      const left=Math.min(a.x,b.x), right=Math.max(a.x,b.x);
      const top=Math.min(a.y,b.y), bottom=Math.max(a.y,b.y);
      if(point.x>=left&&point.x<=right&&point.y>=top&&point.y<=bottom){
        return Math.min(Math.abs(point.x-left),Math.abs(point.x-right),
          Math.abs(point.y-top),Math.abs(point.y-bottom));
      }
      return Math.hypot(Math.max(left-point.x,0,point.x-right),
        Math.max(top-point.y,0,point.y-bottom));
    }
    return Infinity;
  }

  let cursorDown = null;
  chart.addEventListener("pointerdown", event => {
    if (mode === "cursor") cursorDown = {x:event.clientX,y:event.clientY};
  });
  chart.addEventListener("pointerup", event => {
    if (mode !== "cursor" || !cursorDown) return;
    const moved=Math.hypot(event.clientX-cursorDown.x,event.clientY-cursorDown.y);
    cursorDown=null;
    if(moved>6) return;
    const rect=layer.getBoundingClientRect();
    const point={x:event.clientX-rect.left,y:event.clientY-rect.top};
    const map=coordinates();
    if(!map) return;
    let nearest=-1, nearestDistance=12;
    drawings.forEach((drawing,index)=>{
      const distance=drawingDistance(drawing,point,map);
      if(distance<nearestDistance){nearest=index;nearestDistance=distance;}
    });
    selectedDrawing=nearest;
    drawAll();
    updateToolbar();
  });
  chart.addEventListener("pointercancel",()=>{cursorDown=null;});

  function pointXY(point, map) {
    return {
      x: map.x(point.index),
      y: map.y(point.price)
    };
  }

  function line(a, b, map, color, width, dashed) {
    const p1 = pointXY(a, map);
    const p2 = pointXY(b, map);

    pen.save();
    pen.strokeStyle = color;
    pen.lineWidth = width;
    if (dashed) pen.setLineDash([5, 4]);

    pen.beginPath();
    pen.moveTo(p1.x, p1.y);
    pen.lineTo(p2.x, p2.y);
    pen.stroke();
    pen.restore();
  }

  function drawDrawing(drawing, map, index) {
    const color = drawing.color || "#e8bd62";
    const width = drawing.width || 2;

    if (drawing.type === "horizontal") {
      const y = map.y(drawing.a.price);
      pen.save();
      pen.strokeStyle = color;
      pen.lineWidth = width;
      pen.setLineDash([6, 4]);
      pen.beginPath();
      pen.moveTo(map.left, y);
      pen.lineTo(map.right, y);
      pen.stroke();
      pen.setLineDash([]);
      pen.fillStyle = color;
      pen.font = "12px Arial";
      pen.fillText(drawing.label || "مستوى سعري",
        map.left + 5, y - 6);
      pen.restore();
    }

    if (drawing.type === "trend") {
      line(drawing.a, drawing.b, map, color, width, false);
    }

    if (drawing.type === "rectangle") {
      const a = pointXY(drawing.a, map);
      const b = pointXY(drawing.b, map);

      pen.save();
      pen.strokeStyle = color;
      pen.fillStyle = color + "18";
      pen.lineWidth = width;
      pen.fillRect(
        Math.min(a.x, b.x),
        Math.min(a.y, b.y),
        Math.abs(b.x - a.x),
        Math.abs(b.y - a.y)
      );
      pen.strokeRect(
        Math.min(a.x, b.x),
        Math.min(a.y, b.y),
        Math.abs(b.x - a.x),
        Math.abs(b.y - a.y)
      );
      pen.restore();
    }

    if (drawing.type === "fib") {
      const a = pointXY(drawing.a, map);
      const b = pointXY(drawing.b, map);
      const levels = [0, .236, .382, .5, .618, .786, 1];

      levels.forEach(level => {
        const y = a.y + (b.y - a.y) * level;

        pen.save();
        pen.strokeStyle = color;
        pen.lineWidth = 1;
        pen.setLineDash([4, 3]);
        pen.beginPath();
        pen.moveTo(map.left, y);
        pen.lineTo(map.right, y);
        pen.stroke();
        pen.setLineDash([]);

        pen.fillStyle = color;
        pen.font = "11px Arial";
        pen.fillText(
          (level * 100).toFixed(1) + "%",
          map.right - 45,
          y - 4
        );
        pen.restore();
      });
    }

    if (index === selectedDrawing) {
      const p = pointXY(drawing.a, map);
      pen.save();
      pen.fillStyle = "#ffffff";
      pen.strokeStyle = color;
      pen.lineWidth = 2;
      pen.beginPath();
      pen.arc(p.x, p.y, 5, 0, Math.PI * 2);
      pen.fill();
      pen.stroke();
      pen.restore();
    }
  }

  function drawAll() {
    const { width, height } = dimensions();
    pen.clearRect(0, 0, width, height);

    const map = coordinates();
    if (!map) return;

    drawings.forEach((drawing, i) =>
      drawDrawing(drawing, map, i)
    );

    if (pending) {
      drawDrawing({
        type: mode,
        a: pending.a,
        b: pending.b,
        color: "#ffffff",
        width: 2
      }, map, -1);
    }
  }

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(drawings));
    } catch (error) {
      console.warn("Could not save drawings", error);
    }
  }

  layer.addEventListener("pointerdown", event => {
    if (mode === "cursor") return;

    event.preventDefault();
    layer.setPointerCapture(event.pointerId);

    const map = coordinates();
    if (!map) return;

    const pos = pointerPosition(event);
    const point = makePoint(pos, map);

    if (mode === "horizontal") {
      drawings.push({
        type: mode,
        a: point,
        color: "#e8bd62",
        width: 2,
        label: "دعم / مقاومة"
      });
      save();
      drawAll();
      return;
    }

    if (!pending) {
      pending = { a: point, b: point };
    } else {
      pending.b = point;
      drawings.push({
        type: mode,
        a: pending.a,
        b: pending.b,
        color: "#e8bd62",
        width: 2
      });
      pending = null;
      save();
    }

    drawAll();
  });

  layer.addEventListener("pointermove", event => {
    if (!pending) return;

    const map = coordinates();
    if (!map) return;

    pending.b = makePoint(pointerPosition(event), map);
    drawAll();
  });

  layer.addEventListener("contextmenu", event => {
    event.preventDefault();
    pending = null;
    drawAll();
  });

  function refresh() {
    drawAll();
  }

  const originalRender = window.render;

  if (typeof originalRender === "function") {
    window.render = function () {
      originalRender.apply(this, arguments);
      refresh();
    };
  }

  window.addEventListener("resize", refresh);

  updateToolbar();
  refresh();

  window.NourDrawingTools = {
    clear() {
      drawings = [];
      selectedDrawing = -1;
      save();
      refresh();
    },
    get count() {
      return drawings.length;
    }
  };

})();
