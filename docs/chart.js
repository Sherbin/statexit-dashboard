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
    background: rgba(22, 33, 62, 0.95);
    border: 1px solid #4ecca3;
    border-radius: 6px;
    font-size: 13px;
    pointer-events: none;
    z-index: 100;
    min-width: 180px;
  `;
  container.style.position = 'relative';
  container.appendChild(tooltip);
  return tooltip;
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

    const total = point.old + point.new;
    const hasFiles = point.oldFiles !== undefined && point.newFiles !== undefined;
    const totalFiles = hasFiles ? point.oldFiles + point.newFiles : null;
    
    let html = `
      <div style="color: #888; margin-bottom: 8px; font-weight: bold;">${formatDate(point.time)}</div>
      <div style="margin-bottom: 4px;">
        <span style="color: #e94560;">● ${oldPath}:</span> 
        <span style="float: right; color: #fff;">${formatNumber(point.old)} lines</span>
      </div>
      <div style="margin-bottom: 4px;">
        <span style="color: #4ecca3;">● ${newPath}:</span> 
        <span style="float: right; color: #fff;">${formatNumber(point.new)} lines</span>
      </div>
      <div style="border-top: 1px solid #444; padding-top: 4px; margin-top: 4px;">
        <span>Total:</span> 
        <span style="float: right; color: #ffd93d; font-weight: bold;">${formatNumber(total)} lines</span>
      </div>
    `;
    
    if (hasFiles) {
      html += `
        <div style="border-top: 1px solid #444; padding-top: 8px; margin-top: 8px; font-size: 12px;">
          <div style="margin-bottom: 2px;">
            <span style="color: #e94560;">Files (${oldPath}):</span> 
            <span style="float: right;">${formatNumber(point.oldFiles)}</span>
          </div>
          <div style="margin-bottom: 2px;">
            <span style="color: #4ecca3;">Files (${newPath}):</span> 
            <span style="float: right;">${formatNumber(point.newFiles)}</span>
          </div>
          <div>
            <span>Total files:</span> 
            <span style="float: right; font-weight: bold;">${formatNumber(totalFiles)}</span>
          </div>
        </div>
      `;
    }

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
