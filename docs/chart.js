/* global LightweightCharts */

async function loadData() {
	try {
		const response = await fetch('progress.json');

		if (!response.ok) {
			throw new Error('Failed to load data');
		}

		return await response.json();
	} catch (err) {
		document.getElementById(
			'chart-container',
		).innerHTML = `<div class="error">Error loading data: ${err.message}</div>`;
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
		day: '2-digit',
	});
}

function formatChange(value) {
	const sign = value > 0 ? '+' : '';

	return sign + value.toLocaleString();
}

function formatSizeChange(sizeKB) {
	const sign = sizeKB > 0 ? '+' : '';

	if (Math.abs(sizeKB) >= 1024) {
		return sign + (sizeKB / 1024).toFixed(1) + ' MB';
	}

	return sign + sizeKB.toLocaleString() + ' KB';
}

function getComputedColors() {
	const styles = getComputedStyle(document.documentElement);

	return {
		bgPrimary: styles.getPropertyValue('--bg-primary').trim(),
		bgSecondary: styles.getPropertyValue('--bg-secondary').trim(),
		textPrimary: styles.getPropertyValue('--text-primary').trim(),
		textSecondary: styles.getPropertyValue('--text-secondary').trim(),
		borderColor: styles.getPropertyValue('--border-color').trim(),
		gridColor: styles.getPropertyValue('--grid-color').trim(),
		colorPositive: styles.getPropertyValue('--color-positive').trim(),
		colorNegative: styles.getPropertyValue('--color-negative').trim(),
		colorOld: styles.getPropertyValue('--color-old').trim(),
		colorNew: styles.getPropertyValue('--color-new').trim(),
	};
}

function createTooltip(container) {
	const tooltip = document.createElement('div');
	const colors = getComputedColors();

	tooltip.id = 'chart-tooltip';
	tooltip.style.cssText = `
    position: absolute;
    display: none;
    padding: 12px;
    background: ${colors.bgSecondary};
    border: 1px solid ${colors.borderColor};
    border-radius: 6px;
    font-size: 13px;
    pointer-events: none;
    z-index: 100;
    min-width: 220px;
    color: ${colors.textPrimary};
  `;
	container.style.position = 'relative';
	container.appendChild(tooltip);

	return tooltip;
}

function createChart(data, changeMap) {
	const container = document.getElementById('chart-container');
	const colors = getComputedColors();

	const chart = LightweightCharts.createChart(container, {
		layout: {
			background: { color: colors.bgSecondary },
			textColor: colors.textPrimary,
		},
		grid: {
			vertLines: { color: colors.gridColor },
			horzLines: { color: colors.gridColor },
		},
		width: container.clientWidth,
		height: container.clientHeight,
		timeScale: {
			timeVisible: false,
			borderColor: colors.borderColor,
		},
		rightPriceScale: {
			borderColor: colors.borderColor,
			autoScale: true,
			scaleMargins: {
				top: 0.1,
				bottom: 0,
			},
		},
		leftPriceScale: {
			visible: true,
			borderColor: colors.borderColor,
			autoScale: true,
			scaleMargins: {
				top: 0.1,
				bottom: 0.1,
			},
		},
		crosshair: {
			mode: LightweightCharts.CrosshairMode.Normal,
		},
	});

	// Get labels from meta
	const meta = data.meta;
	const oldLabel = meta.ui?.oldLabel || meta.oldPath;
	const newLabel = meta.ui?.newLabel || meta.newPath;

	// Stacked Area: нижний слой — new, верхний — old + new (total)

	// Серия total (будет показывать old часть сверху) - Orange
	const totalSeries = chart.addAreaSeries({
		topColor: 'rgba(255, 152, 0, 0.4)',
		bottomColor: 'rgba(255, 152, 0, 0.0)',
		lineColor: colors.colorOld,
		lineWidth: 2,
		priceFormat: {
			type: 'custom',
			formatter: (price) => formatSize(Math.round(price)),
		},
	});

	// Серия new (перекрывает нижнюю часть) - Blue
	const newSeries = chart.addAreaSeries({
		topColor: 'rgba(41, 98, 255, 0.6)',
		bottomColor: 'rgba(41, 98, 255, 0.1)',
		lineColor: colors.colorNew,
		lineWidth: 2,
		priceFormat: {
			type: 'custom',
			formatter: (price) => formatSize(Math.round(price)),
		},
	});

	// Серия change - BaselineSeries с красным/зелёным цветом
	const changeSeries = chart.addBaselineSeries({
		baseValue: { type: 'price', price: 0 },
		topLineColor: colors.colorPositive,
		bottomLineColor: colors.colorNegative,
		topFillColor1: 'rgba(8, 153, 129, 0.2)',
		topFillColor2: 'rgba(8, 153, 129, 0.0)',
		bottomFillColor1: 'rgba(242, 54, 69, 0.0)',
		bottomFillColor2: 'rgba(242, 54, 69, 0.2)',
		lineWidth: 2,
		priceScaleId: 'left',
		priceFormat: {
			type: 'custom',
			formatter: (price) => formatSizeChange(Math.round(price)),
		},
	});

	// Преобразуем данные
	const totalData = data.data.map((point) => ({
		time: point.time,
		value: point.oldSizeKB + point.newSizeKB,
	}));

	const newData = data.data.map((point) => ({
		time: point.time,
		value: point.newSizeKB,
	}));

	// Change data из предварительно рассчитанного changeMap
	const changeData = data.data
		.filter((point) => changeMap.has(point.time))
		.map((point) => ({
			time: point.time,
			value: changeMap.get(point.time).totalSize,
		}));

	totalSeries.setData(totalData);
	newSeries.setData(newData);
	changeSeries.setData(changeData);

	// Create tooltip
	const tooltip = createTooltip(container);

	// Tooltip via subscribeCrosshairMove
	chart.subscribeCrosshairMove((param) => {
		if (!param.time || !param.seriesData.size) {
			tooltip.style.display = 'none';

			return;
		}

		const point = data.data.find((p) => p.time === param.time);

		if (!point) {
			tooltip.style.display = 'none';

			return;
		}

		const change = changeMap.get(point.time);
		const isPositiveChange = change && change.totalSize >= 0;
		const changeColor = change
			? (isPositiveChange ? colors.colorPositive : colors.colorNegative)
			: colors.textSecondary;
		const changeArrow = change ? (isPositiveChange ? '↑' : '↓') : '';

		const html = `
      <div style="color: ${colors.textSecondary}; margin-bottom: 10px; font-weight: bold; font-size: 14px;">${formatDate(point.time)}</div>
      <div style="border-top: 1px solid ${colors.borderColor}; padding-top: 8px; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; margin-bottom: 6px;">
          <span style="color: ${colors.colorOld}; margin-right: 8px;">●</span>
          <span style="color: ${colors.textSecondary}; min-width: 70px;">${oldLabel}:</span>
          <span style="color: ${colors.textPrimary}; margin-right: 12px;">${formatSize(point.oldSizeKB)}</span>
          <span style="color: ${colors.textSecondary}; font-size: 12px;">│ ${formatNumber(point.oldFiles)} files</span>
        </div>
        <div style="display: flex; align-items: center;">
          <span style="color: ${colors.colorNew}; margin-right: 8px;">●</span>
          <span style="color: ${colors.textSecondary}; min-width: 70px;">${newLabel}:</span>
          <span style="color: ${colors.textPrimary}; margin-right: 12px;">${formatSize(point.newSizeKB)}</span>
          <span style="color: ${colors.textSecondary}; font-size: 12px;">│ ${formatNumber(point.newFiles)} files</span>
        </div>
      </div>
      ${change ? `
      <div style="border-top: 1px solid ${colors.borderColor}; padding-top: 8px;">
        <span style="color: ${colors.textSecondary};">Change:</span>
        <span style="color: ${changeColor}; font-weight: bold; margin-left: 8px;">${formatSizeChange(change.totalSize)} ${changeArrow}</span>
      </div>
      ` : ''}
      ${point.comment ? `
      <div style="border-top: 1px solid ${colors.colorOld}; margin-top: 10px; padding-top: 8px;">
        <div style="color: ${colors.colorOld}; font-weight: bold; margin-bottom: 4px; font-size: 11px;">
          ⚠️ Note:
        </div>
        <div style="color: ${colors.textPrimary}; font-size: 11px; line-height: 1.5; max-width: 280px; word-wrap: break-word;">
          ${point.comment}
        </div>
      </div>
      ` : ''}
    `;

		tooltip.innerHTML = html;
		tooltip.style.display = 'block';

		// Position tooltip
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
			height: container.clientHeight,
		});
	});

	resizeObserver.observe(container);

	// Fit content
	chart.timeScale().fitContent();

	return chart;
}

function updateStats(data) {
	const latest = data.data[data.data.length - 1];

	if (!latest) {
		return;
	}

	document.getElementById('stat-old').textContent = formatSize(latest.oldSizeKB);
	document.getElementById('stat-new').textContent = formatSize(latest.newSizeKB);
}

function updateMeta(data) {
	const meta = data.meta;
	const date = new Date(meta.generatedAt).toLocaleString();

	document.getElementById('meta').innerHTML = `Last updated: ${date}<br>` + `${meta.oldPath} → ${meta.newPath}`;
}

function initUI(data) {
	const meta = data.meta;
	const ui = meta.ui || {};
	const oldLabel = ui.oldLabel || meta.oldPath;
	const newLabel = ui.newLabel || meta.newPath;
	const oldDescription = ui.oldDescription || '';
	const newDescription = ui.newDescription || '';

	// Update title
	const titleEl = document.getElementById('dashboard-title');

	if (titleEl && ui.title) {
		titleEl.textContent = `📊 ${ui.title}`;
	}

	// Update subtitle
	const subtitleEl = document.getElementById('dashboard-subtitle');

	if (subtitleEl) {
		subtitleEl.textContent = `Code migration from ${oldLabel} (${oldDescription}) → ${newLabel}`;
	}

	// Update legend labels
	const legendOldEl = document.getElementById('legend-old');

	if (legendOldEl) {
		legendOldEl.textContent = `${oldLabel} (${oldDescription})`;
	}

	const legendNewEl = document.getElementById('legend-new');

	if (legendNewEl) {
		legendNewEl.textContent = `${newLabel} (${newDescription})`;
	}
}

function calculateDailyChanges(data) {
	const points = data.data;
	const changeMap = new Map();

	for (let i = 1; i < points.length; i++) {
		const current = points[i];
		const prev = points[i - 1];

		changeMap.set(current.time, {
			staticSize: current.oldSizeKB - prev.oldSizeKB,
			staticFiles: current.oldFiles - prev.oldFiles,
			frontendsSize: current.newSizeKB - prev.newSizeKB,
			frontendsFiles: current.newFiles - prev.newFiles,
			totalSize: (current.oldSizeKB + current.newSizeKB) - (prev.oldSizeKB + prev.newSizeKB),
		});
	}

	return changeMap;
}

function calculateAllChanges(data, period, changeMap) {
	const points = data.data;
	const changes = [];

	if (period === 'day') {
		// Используем предварительно рассчитанные изменения
		for (let i = points.length - 1; i > 0; i--) {
			const current = points[i];
			const change = changeMap.get(current.time);

			if (change) {
				changes.push({
					date: formatDate(current.time),
					staticSize: change.staticSize,
					staticFiles: change.staticFiles,
					frontendsSize: change.frontendsSize,
					frontendsFiles: change.frontendsFiles,
				});
			}
		}
	} else {
		// Группируем по неделям
		for (let i = points.length - 1; i > 0; ) {
			const current = points[i];
			const weekAgo = current.time - 7 * 24 * 60 * 60;
			let j = i - 1;

			while (j >= 0 && points[j].time > weekAgo) {
				j--;
			}

			const prev = points[Math.max(0, j)];

			changes.push({
				date: `${formatDate(prev.time)} → ${formatDate(current.time)}`,
				staticSize: current.oldSizeKB - prev.oldSizeKB,
				staticFiles: current.oldFiles - prev.oldFiles,
				frontendsSize: current.newSizeKB - prev.newSizeKB,
				frontendsFiles: current.newFiles - prev.newFiles,
			});

			i = j;

			if (i <= 0) {
				break;
			}
		}
	}

	return changes;
}

function getChangeClass(value, invert = false) {
	if (value === 0) {
		return '';
	}

	const isPositive = invert ? value < 0 : value > 0;

	return isPositive ? 'change-positive' : 'change-negative';
}

function renderChangesTable(data, period, changeMap) {
	const changes = calculateAllChanges(data, period, changeMap);
	const container = document.getElementById('changes-table');
	const meta = data.meta;
	const oldLabel = meta.ui?.oldLabel || meta.oldPath;
	const newLabel = meta.ui?.newLabel || meta.newPath;

	const headerRow = `
		<div class="changes-row header">
			<div class="changes-cell date">Date</div>
			<div class="changes-cell old">${oldLabel}</div>
			<div class="changes-cell new">${newLabel}</div>
		</div>
	`;

	const rows = changes
		.map(
			(c) => `
		<div class="changes-row">
			<div class="changes-cell date">${c.date}</div>
			<div class="changes-cell old">
				<span class="${getChangeClass(c.staticSize, true)}">${formatSizeChange(c.staticSize)}</span>
				<span class="${getChangeClass(c.staticFiles, true)}">${formatChange(c.staticFiles)}</span>
			</div>
			<div class="changes-cell new">
				<span class="${getChangeClass(c.frontendsSize)}">${formatSizeChange(c.frontendsSize)}</span>
				<span class="${getChangeClass(c.frontendsFiles)}">${formatChange(c.frontendsFiles)}</span>
			</div>
		</div>
	`,
		)
		.join('');

	container.innerHTML = headerRow + rows;
}

function setupPeriodToggle(data, changeMap) {
	const buttons = document.querySelectorAll('.period-btn');

	buttons.forEach((btn) => {
		btn.addEventListener('click', () => {
			buttons.forEach((b) => b.classList.remove('active'));
			btn.classList.add('active');
			renderChangesTable(data, btn.dataset.period, changeMap);
		});
	});

	// Initial render
	renderChangesTable(data, 'day', changeMap);
}

async function init() {
	const data = await loadData();
	const changeMap = calculateDailyChanges(data);

	initUI(data);
	createChart(data, changeMap);
	updateStats(data);
	updateMeta(data);
	setupPeriodToggle(data, changeMap);
}

init();
