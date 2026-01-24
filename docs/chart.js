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

function formatSize(sizeKB) {
  if (sizeKB >= 1024) {
    return (sizeKB / 1024).toFixed(1) + ' MB';
  }
  return sizeKB.toLocaleString() + ' KB';
}

function formatDate(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

function createTooltip(container) {
  const tooltip = document.createElement('div');
  tooltip.id = 'chart-tooltip';
  tooltip.style.cssText = `
    position: absolute;
    display: none;
    padding: 12px;
    background: rgba(30, 34, 45, 0.98);  /* TradingView panel with opacity */
    border: 1px solid #2B2B43;            /* TradingView grid color */
    border-radius: 6px;
    font-size: 13px;
    pointer-events: none;
    z-index: 100;
    min-width: 180px;
    color: #D1D4DC;                       /* TradingView text */
  `;
  container.style.position = 'relative';
  container.appendChild(tooltip);
  return tooltip;
}

function createChart(data) {
  const container = document.getElementById('chart-container');
  
  const chart = LightweightCharts.createChart(container, {
    layout: {
      background: { color: '#1E222D' },  /* TradingView panel */
      textColor: '#D1D4DC',               /* TradingView text */
    },
    grid: {
      vertLines: { color: '#2B2B43' },   /* TradingView grid */
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
      autoScale: true,
      scaleMargins: {
        top: 0.1,
        bottom: 0,  // График начинается с 0
      },
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
    },
  });

  // Stacked Area: нижний слой — new, верхний — old + new (total)
  
  // Серия total (будет показывать old часть сверху) - используем Ripe Red
  const totalSeries = chart.addAreaSeries({
    topColor: 'rgba(242, 54, 69, 0.4)',      // color-ripe-red-500 #F23645
    bottomColor: 'rgba(242, 54, 69, 0.0)',
    lineColor: '#F23645',
    lineWidth: 2,
    priceFormat: {
      type: 'custom',
      formatter: (price) => formatSize(Math.round(price)),
    },
  });

  // Серия new (перекрывает нижнюю часть) - используем Minty Green
  const newSeries = chart.addAreaSeries({
    topColor: 'rgba(8, 153, 129, 0.6)',      // color-minty-green-500 #089981
    bottomColor: 'rgba(8, 153, 129, 0.1)',
    lineColor: '#089981',
    lineWidth: 2,
    priceFormat: {
      type: 'custom',
      formatter: (price) => formatSize(Math.round(price)),
    },
  });

  // Преобразуем данные
  const totalData = data.data.map(point => ({
    time: point.time,
    value: point.oldSizeKB + point.newSizeKB,
  }));

  const newData = data.data.map(point => ({
    time: point.time,
    value: point.newSizeKB,
  }));

  totalSeries.setData(totalData);
  newSeries.setData(newData);

  // Create tooltip
  const tooltip = createTooltip(container);
  const oldPath = data.meta.oldPath || 'Old';
  const newPath = data.meta.newPath || 'New';

  // Tooltip via subscribeCrosshairMove
  chart.subscribeCrosshairMove((param) => {
    if (!param.time || !param.seriesData.size) {
      tooltip.style.display = 'none';
      return;
    }
    
    const point = data.data.find(p => p.time === param.time);
    if (!point) {
      tooltip.style.display = 'none';
      return;
    }

    const total = point.oldSizeKB + point.newSizeKB;
    const totalFiles = point.oldFiles + point.newFiles;
    
    let html = `
      <div style="color: #787B86; margin-bottom: 8px; font-weight: bold;">${formatDate(point.time)}</div>
      <div style="margin-bottom: 4px;">
        <span style="color: #F23645;">● ${oldPath}:</span> 
        <span style="float: right; color: #D1D4DC;">${formatSize(point.oldSizeKB)}</span>
      </div>
      <div style="margin-bottom: 4px;">
        <span style="color: #089981;">● ${newPath}:</span> 
        <span style="float: right; color: #D1D4DC;">${formatSize(point.newSizeKB)}</span>
      </div>
      <div style="border-top: 1px solid #2B2B43; padding-top: 4px; margin-top: 4px;">
        <span style="color: #787B86;">Total:</span> 
        <span style="float: right; color: #D1D4DC; font-weight: bold;">${formatSize(total)}</span>
      </div>
      <div style="border-top: 1px solid #2B2B43; padding-top: 8px; margin-top: 8px; font-size: 12px;">
        <div style="margin-bottom: 2px;">
          <span style="color: #F23645;">Files (${oldPath}):</span> 
          <span style="float: right; color: #D1D4DC;">${formatNumber(point.oldFiles)}</span>
        </div>
        <div style="margin-bottom: 2px;">
          <span style="color: #089981;">Files (${newPath}):</span> 
          <span style="float: right; color: #D1D4DC;">${formatNumber(point.newFiles)}</span>
        </div>
        <div>
          <span style="color: #787B86;">Total files:</span> 
          <span style="float: right; color: #D1D4DC; font-weight: bold;">${formatNumber(totalFiles)}</span>
        </div>
      </div>
    `;

    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    
    // Position tooltip
    const rect = container.getBoundingClientRect();
    const x = param.point.x;
    const tooltipWidth = tooltip.offsetWidth;
    
    // Keep tooltip within container
    let left = x + 20;
    if (left + tooltipWidth > container.clientWidth) {
      left = x - tooltipWidth - 20;
    }
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = '40px';
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

  const total = latest.oldSizeKB + latest.newSizeKB;
  const progress = total > 0 ? (latest.newSizeKB / total * 100).toFixed(1) : 0;

  document.getElementById('stat-old').textContent = formatSize(latest.oldSizeKB);
  document.getElementById('stat-new').textContent = formatSize(latest.newSizeKB);
  document.getElementById('stat-progress').textContent = progress + '%';
}

function updateMeta(data) {
  const meta = data.meta;
  const date = new Date(meta.generatedAt).toLocaleString();
  document.getElementById('meta').innerHTML = 
    `Last updated: ${date}<br>` +
    `${meta.oldPath} → ${meta.newPath}`;
}

function updateLegend(data) {
  const meta = data.meta;
  const oldLabel = document.querySelector('.legend-item .old + span, .legend-item:has(.old) span:last-child');
  const newLabel = document.querySelector('.legend-item .new + span, .legend-item:has(.new) span:last-child');
  
  // Update legend labels with actual path names
  document.querySelectorAll('.legend-item').forEach(item => {
    const colorDiv = item.querySelector('.legend-color');
    const span = item.querySelector('span:not(.legend-color)');
    if (colorDiv && span) {
      if (colorDiv.classList.contains('old')) {
        span.textContent = `Old (${meta.oldPath})`;
      } else if (colorDiv.classList.contains('new')) {
        span.textContent = `New (${meta.newPath})`;
      }
    }
  });
}

async function init() {
  const data = await loadData();
  createChart(data);
  updateStats(data);
  updateMeta(data);
  updateLegend(data);
}

init();
