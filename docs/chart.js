async function loadData() {
  try {
    const response = await fetch('progress.json');
    if (!response.ok) throw new Error('Failed to load data');
    return await response.json();
  } catch (err) {
    document.getElementById('chart-container').innerHTML = 
      `<div class="error">Error loading data: ${err.message}</div>`;
    throw err;
  }
}

function formatNumber(num) {
  return num.toLocaleString();
}

function createChart(data) {
  const container = document.getElementById('chart-container');
  
  const chart = LightweightCharts.createChart(container, {
    layout: {
      background: { color: '#16213e' },
      textColor: '#d1d4dc',
    },
    grid: {
      vertLines: { color: '#2B2B43' },
      horzLines: { color: '#2B2B43' },
    },
    width: container.clientWidth,
    height: container.clientHeight,
    timeScale: {
      timeVisible: false,
      borderColor: '#2B2B43',
    },
    rightPriceScale: {
      borderColor: '#2B2B43',
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
    },
  });

  // Stacked Area: нижний слой — new, верхний — old + new (total)
  
  // Серия для total (old + new) — рисуется первой, будет снизу визуально
  // Но в stacked area нужно рисовать так: сначала верхний слой
  
  // Для правильного stacked area:
  // 1. Рисуем total (old + new) как верхний слой
  // 2. Рисуем new как нижний слой (перекрывает часть total)
  
  // Серия total (будет показывать old часть сверху)
  const totalSeries = chart.addAreaSeries({
    topColor: 'rgba(233, 69, 96, 0.4)',      // old color
    bottomColor: 'rgba(233, 69, 96, 0.0)',
    lineColor: '#e94560',
    lineWidth: 2,
    priceFormat: {
      type: 'custom',
      formatter: (price) => formatNumber(Math.round(price)) + ' lines',
    },
  });

  // Серия new (перекрывает нижнюю часть)
  const newSeries = chart.addAreaSeries({
    topColor: 'rgba(78, 204, 163, 0.6)',     // new color
    bottomColor: 'rgba(78, 204, 163, 0.1)',
    lineColor: '#4ecca3',
    lineWidth: 2,
    priceFormat: {
      type: 'custom',
      formatter: (price) => formatNumber(Math.round(price)) + ' lines',
    },
  });

  // Преобразуем данные
  const totalData = data.data.map(point => ({
    time: point.time,
    value: point.old + point.new,
  }));

  const newData = data.data.map(point => ({
    time: point.time,
    value: point.new,
  }));

  totalSeries.setData(totalData);
  newSeries.setData(newData);

  // Tooltip через subscribeCrosshairMove
  chart.subscribeCrosshairMove((param) => {
    if (!param.time || !param.seriesData.size) return;
    
    const point = data.data.find(p => p.time === param.time);
    if (point) {
      // Можно добавить кастомный tooltip div если нужно
    }
  });

  // Resize handler
  const resizeObserver = new ResizeObserver(() => {
    chart.applyOptions({ 
      width: container.clientWidth,
      height: container.clientHeight 
    });
  });
  resizeObserver.observe(container);

  // Fit content
  chart.timeScale().fitContent();

  return chart;
}

function updateStats(data) {
  const latest = data.data[data.data.length - 1];
  if (!latest) return;

  const total = latest.old + latest.new;
  const progress = total > 0 ? (latest.new / total * 100).toFixed(1) : 0;

  document.getElementById('stat-old').textContent = formatNumber(latest.old);
  document.getElementById('stat-new').textContent = formatNumber(latest.new);
  document.getElementById('stat-progress').textContent = progress + '%';
}

function updateMeta(data) {
  const meta = data.meta;
  const date = new Date(meta.generatedAt).toLocaleString();
  document.getElementById('meta').innerHTML = 
    `Last updated: ${date}<br>` +
    `${meta.oldPath} → ${meta.newPath}`;
}

async function init() {
  const data = await loadData();
  createChart(data);
  updateStats(data);
  updateMeta(data);
}

init();
