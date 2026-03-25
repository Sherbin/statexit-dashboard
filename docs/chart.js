/* global LightweightCharts */

// --- Color palettes for groups (warm tones for old, cool tones for new) ---

const OLD_GROUP_PALETTE = [
	{ line: '#FF9800', topFill: 'rgba(255, 152, 0, 0.5)', bottomFill: 'rgba(255, 152, 0, 0.05)' },
	{ line: '#FFB74D', topFill: 'rgba(255, 183, 77, 0.5)', bottomFill: 'rgba(255, 183, 77, 0.05)' },
	{ line: '#FF8F00', topFill: 'rgba(255, 143, 0, 0.5)', bottomFill: 'rgba(255, 143, 0, 0.05)' },
	{ line: '#F57C00', topFill: 'rgba(245, 124, 0, 0.5)', bottomFill: 'rgba(245, 124, 0, 0.05)' },
	{ line: '#FFD54F', topFill: 'rgba(255, 213, 79, 0.5)', bottomFill: 'rgba(255, 213, 79, 0.05)' },
	{ line: '#FFAB40', topFill: 'rgba(255, 171, 64, 0.5)', bottomFill: 'rgba(255, 171, 64, 0.05)' },
	{ line: '#FF6D00', topFill: 'rgba(255, 109, 0, 0.5)', bottomFill: 'rgba(255, 109, 0, 0.05)' },
	{ line: '#E65100', topFill: 'rgba(230, 81, 0, 0.5)', bottomFill: 'rgba(230, 81, 0, 0.05)' },
];

const NEW_GROUP_PALETTE = [
	{ line: '#2962FF', topFill: 'rgba(41, 98, 255, 0.6)', bottomFill: 'rgba(41, 98, 255, 0.05)' },
	{ line: '#448AFF', topFill: 'rgba(68, 138, 255, 0.6)', bottomFill: 'rgba(68, 138, 255, 0.05)' },
	{ line: '#1565C0', topFill: 'rgba(21, 101, 192, 0.6)', bottomFill: 'rgba(21, 101, 192, 0.05)' },
	{ line: '#42A5F5', topFill: 'rgba(66, 165, 245, 0.6)', bottomFill: 'rgba(66, 165, 245, 0.05)' },
	{ line: '#0D47A1', topFill: 'rgba(13, 71, 161, 0.6)', bottomFill: 'rgba(13, 71, 161, 0.05)' },
	{ line: '#64B5F6', topFill: 'rgba(100, 181, 246, 0.6)', bottomFill: 'rgba(100, 181, 246, 0.05)' },
];

function getGroupColor(palette, index) {
	return palette[index % palette.length];
}

// --- Helpers ---

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

// --- Group detection ---

function getMetaGroups(data) {
	return data.meta.groups || { old: [], new: [] };
}

function hasOldGroups(data) {
	const g = getMetaGroups(data);

	return g.old && g.old.length > 0;
}

function hasNewGroups(data) {
	const g = getMetaGroups(data);

	return g.new && g.new.length > 0;
}

// --- Tooltip ---

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
    min-width: 240px;
    color: ${colors.textPrimary};
  `;
	container.style.position = 'relative';
	container.appendChild(tooltip);

	return tooltip;
}

// --- Stacked data calculation ---

/**
 * Builds stacked series data for groups.
 * Groups are stacked from bottom to top. The bottom-most group's value is its own size.
 * Each subsequent group's value = sum of itself and all groups below it.
 * Old groups are stacked on top of new groups total.
 *
 * @param {Array} dataPoints - data points from progress.json
 * @param {string} side - 'old' or 'new'
 * @param {Array} groupLabels - ordered list of group labels
 * @param {Set} visibleGroups - set of visible group labels
 * @param {number} baseOffset - value to add as base (e.g., newSizeKB for old groups)
 * @returns {Map<string, Array>} label -> [{time, value}]
 */
function buildStackedData(dataPoints, side, groupLabels, visibleGroups, baseOffset) {
	const result = new Map();
	const visibleLabels = groupLabels.filter((l) => visibleGroups.has(side + ':' + l));

	for (const label of visibleLabels) {
		result.set(label, []);
	}

	for (const point of dataPoints) {
		const groups = point.groups[side] || [];
		const groupMap = new Map();

		for (const g of groups) {
			groupMap.set(g.label, g.sizeKB);
		}

		let cumulative = typeof baseOffset === 'function' ? baseOffset(point) : baseOffset;

		for (const label of visibleLabels) {
			cumulative += groupMap.get(label) || 0;
			result.get(label).push({ time: point.time, value: cumulative });
		}
	}

	return result;
}

// --- Main chart ---

function createChart(data, changeMap) {
	const container = document.getElementById('chart-container');
	const colors = getComputedColors();
	const meta = data.meta;
	const oldLabel = meta.ui?.oldLabel || meta.oldPath;
	const newLabel = meta.ui?.newLabel || meta.newPath;
	const metaGroups = getMetaGroups(data);
	const oldGroupLabels = (metaGroups.old || []).map((g) => g.label);
	const newGroupLabels = (metaGroups.new || []).map((g) => g.label);

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
			scaleMargins: { top: 0.1, bottom: 0 },
		},
		leftPriceScale: {
			visible: true,
			borderColor: colors.borderColor,
			autoScale: true,
			scaleMargins: { top: 0.1, bottom: 0.1 },
		},
		crosshair: {
			mode: LightweightCharts.CrosshairMode.Normal,
		},
	});

	// Track all group series for visibility toggling
	const allSeries = new Map(); // key -> { series, side, label, colorIndex }
	const visibleGroups = new Set();

	// Initialize all groups as visible
	for (const label of oldGroupLabels) {
		visibleGroups.add('old:' + label);
	}
	for (const label of newGroupLabels) {
		visibleGroups.add('new:' + label);
	}

	// --- Create series ---

	const hasOldGrp = oldGroupLabels.length > 0;
	const hasNewGrp = newGroupLabels.length > 0;

	// Series for old groups (stacked on top of new total)
	// Created in REVERSE order so the topmost group is added first (renders behind)
	if (hasOldGrp) {
		for (let i = oldGroupLabels.length - 1; i >= 0; i--) {
			const label = oldGroupLabels[i];
			const color = getGroupColor(OLD_GROUP_PALETTE, i);
			const series = chart.addAreaSeries({
				topColor: color.topFill,
				bottomColor: color.bottomFill,
				lineColor: color.line,
				lineWidth: 1,
				priceFormat: {
					type: 'custom',
					formatter: (price) => formatSize(Math.round(price)),
				},
			});

			allSeries.set('old:' + label, { series, side: 'old', label, colorIndex: i });
		}
	} else {
		// No old groups: single old area (total)
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

		allSeries.set('old:__total__', { series: totalSeries, side: 'old', label: '__total__' });
	}

	// Series for new groups
	if (hasNewGrp) {
		for (let i = newGroupLabels.length - 1; i >= 0; i--) {
			const label = newGroupLabels[i];
			const color = getGroupColor(NEW_GROUP_PALETTE, i);
			const series = chart.addAreaSeries({
				topColor: color.topFill,
				bottomColor: color.bottomFill,
				lineColor: color.line,
				lineWidth: 1,
				priceFormat: {
					type: 'custom',
					formatter: (price) => formatSize(Math.round(price)),
				},
			});

			allSeries.set('new:' + label, { series, side: 'new', label, colorIndex: i });
		}
	} else {
		// No new groups: single new area
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

		allSeries.set('new:__total__', { series: newSeries, side: 'new', label: '__total__' });
	}

	// Change series (baseline)
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

	// --- Function to update all series data based on visibility ---
	function updateSeriesData() {
		if (hasNewGrp) {
			const newStacked = buildStackedData(data.data, 'new', newGroupLabels, visibleGroups, 0);

			for (const label of newGroupLabels) {
				const entry = allSeries.get('new:' + label);
				const seriesData = newStacked.get(label);

				if (entry && seriesData) {
					entry.series.setData(seriesData);
				} else if (entry) {
					entry.series.setData([]);
				}
			}
		} else {
			const totalEntry = allSeries.get('new:__total__');

			if (totalEntry) {
				totalEntry.series.setData(
					data.data.map((p) => ({ time: p.time, value: p.newSizeKB })),
				);
			}
		}

		// Compute visible new total for each point (base for old stacking)
		function getVisibleNewTotal(point) {
			if (!hasNewGrp) {
				return point.newSizeKB;
			}

			const groups = point.groups.new || [];
			let sum = 0;

			for (const g of groups) {
				if (visibleGroups.has('new:' + g.label)) {
					sum += g.sizeKB;
				}
			}

			return sum;
		}

		if (hasOldGrp) {
			const oldStacked = buildStackedData(
				data.data, 'old', oldGroupLabels, visibleGroups, getVisibleNewTotal,
			);

			for (const label of oldGroupLabels) {
				const entry = allSeries.get('old:' + label);
				const seriesData = oldStacked.get(label);

				if (entry && seriesData) {
					entry.series.setData(seriesData);
				} else if (entry) {
					entry.series.setData([]);
				}
			}
		} else {
			const totalEntry = allSeries.get('old:__total__');

			if (totalEntry) {
				totalEntry.series.setData(
					data.data.map((p) => ({ time: p.time, value: p.oldSizeKB + p.newSizeKB })),
				);
			}
		}

		// Change series
		const changeData = data.data
			.filter((point) => changeMap.has(point.time))
			.map((point) => ({
				time: point.time,
				value: changeMap.get(point.time).totalSize,
			}));

		changeSeries.setData(changeData);
	}

	// Initial data load
	updateSeriesData();

	// --- Tooltip ---
	const tooltip = createTooltip(container);

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
		const changeArrow = change ? (isPositiveChange ? '\u2191' : '\u2193') : '';

		let html = `
      <div style="color: ${colors.textSecondary}; margin-bottom: 10px; font-weight: bold; font-size: 14px;">${formatDate(point.time)}</div>
      <div style="border-top: 1px solid ${colors.borderColor}; padding-top: 8px; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; margin-bottom: 6px;">
          <span style="color: ${colors.colorOld}; margin-right: 8px;">\u25CF</span>
          <span style="color: ${colors.textSecondary}; min-width: 70px;">${oldLabel}:</span>
          <span style="color: ${colors.textPrimary}; margin-right: 12px;">${formatSize(point.oldSizeKB)}</span>
          <span style="color: ${colors.textSecondary}; font-size: 12px;">\u2502 ${formatNumber(point.oldFiles)} files</span>
        </div>`;

		// Old group breakdown
		if (point.groups && point.groups.old && point.groups.old.length > 0) {
			for (let i = 0; i < point.groups.old.length; i++) {
				const g = point.groups.old[i];
				const color = getGroupColor(OLD_GROUP_PALETTE, i);

				html += `
        <div style="display: flex; align-items: center; margin-bottom: 3px; padding-left: 20px; font-size: 12px;">
          <span style="color: ${color.line}; margin-right: 6px;">\u25CF</span>
          <span style="color: ${colors.textSecondary}; min-width: 120px;">${g.label}:</span>
          <span style="color: ${colors.textPrimary}; margin-right: 8px;">${formatSize(g.sizeKB)}</span>
          <span style="color: ${colors.textSecondary};">${formatNumber(g.files)} files</span>
        </div>`;
			}
		}

		html += `
        <div style="display: flex; align-items: center; margin-top: 6px;">
          <span style="color: ${colors.colorNew}; margin-right: 8px;">\u25CF</span>
          <span style="color: ${colors.textSecondary}; min-width: 70px;">${newLabel}:</span>
          <span style="color: ${colors.textPrimary}; margin-right: 12px;">${formatSize(point.newSizeKB)}</span>
          <span style="color: ${colors.textSecondary}; font-size: 12px;">\u2502 ${formatNumber(point.newFiles)} files</span>
        </div>`;

		// New group breakdown
		if (point.groups && point.groups.new && point.groups.new.length > 0) {
			for (let i = 0; i < point.groups.new.length; i++) {
				const g = point.groups.new[i];
				const color = getGroupColor(NEW_GROUP_PALETTE, i);

				html += `
        <div style="display: flex; align-items: center; margin-bottom: 3px; padding-left: 20px; font-size: 12px;">
          <span style="color: ${color.line}; margin-right: 6px;">\u25CF</span>
          <span style="color: ${colors.textSecondary}; min-width: 120px;">${g.label}:</span>
          <span style="color: ${colors.textPrimary}; margin-right: 8px;">${formatSize(g.sizeKB)}</span>
          <span style="color: ${colors.textSecondary};">${formatNumber(g.files)} files</span>
        </div>`;
			}
		}

		html += '</div>';

		if (change) {
			html += `
      <div style="border-top: 1px solid ${colors.borderColor}; padding-top: 8px;">
        <span style="color: ${colors.textSecondary};">Change:</span>
        <span style="color: ${changeColor}; font-weight: bold; margin-left: 8px;">${formatSizeChange(change.totalSize)} ${changeArrow}</span>
      </div>`;
		}

		if (point.comment) {
			html += `
      <div style="border-top: 1px solid ${colors.colorOld}; margin-top: 10px; padding-top: 8px;">
        <div style="color: ${colors.colorOld}; font-weight: bold; margin-bottom: 4px; font-size: 11px;">Note:</div>
        <div style="color: ${colors.textPrimary}; font-size: 11px; line-height: 1.5; max-width: 280px; word-wrap: break-word;">
          ${point.comment}
        </div>
      </div>`;
		}

		tooltip.innerHTML = html;
		tooltip.style.display = 'block';

		const x = param.point.x;
		const tooltipWidth = tooltip.offsetWidth;
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
	chart.timeScale().fitContent();

	// --- Group checkboxes ---
	function createGroupControls() {
		const controlsContainer = document.getElementById('group-controls');

		if (!controlsContainer) {
			return;
		}

		const allGroupEntries = [];

		if (hasOldGrp) {
			for (let i = 0; i < oldGroupLabels.length; i++) {
				allGroupEntries.push({
					side: 'old',
					label: oldGroupLabels[i],
					colorIndex: i,
					palette: OLD_GROUP_PALETTE,
					sideLabel: oldLabel,
				});
			}
		}

		if (hasNewGrp) {
			for (let i = 0; i < newGroupLabels.length; i++) {
				allGroupEntries.push({
					side: 'new',
					label: newGroupLabels[i],
					colorIndex: i,
					palette: NEW_GROUP_PALETTE,
					sideLabel: newLabel,
				});
			}
		}

		if (allGroupEntries.length === 0) {
			return;
		}

		for (const entry of allGroupEntries) {
			const key = entry.side + ':' + entry.label;
			const color = getGroupColor(entry.palette, entry.colorIndex);

			const checkboxLabel = document.createElement('label');
			checkboxLabel.className = 'group-checkbox';

			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.checked = true;

			const dot = document.createElement('span');
			dot.className = 'group-color-dot';
			dot.style.backgroundColor = color.line;

			const text = document.createTextNode(entry.sideLabel + ' / ' + entry.label);

			checkbox.addEventListener('change', () => {
				if (checkbox.checked) {
					visibleGroups.add(key);
				} else {
					visibleGroups.delete(key);
				}

				updateSeriesData();

				// Update series visibility
				const seriesEntry = allSeries.get(key);

				if (seriesEntry) {
					seriesEntry.series.applyOptions({
						visible: checkbox.checked,
					});
				}
			});

			checkboxLabel.appendChild(checkbox);
			checkboxLabel.appendChild(dot);
			checkboxLabel.appendChild(text);
			controlsContainer.appendChild(checkboxLabel);
		}
	}

	createGroupControls();

	return chart;
}

// --- Stats, meta, UI ---

function updateStats(data) {
	const latest = data.data[data.data.length - 1];

	if (!latest) {
		return;
	}

	const meta = data.meta;
	const oldLabel = meta.ui?.oldLabel || meta.oldPath;
	const newLabel = meta.ui?.newLabel || meta.newPath;
	const oldDescription = meta.ui?.oldDescription || '';
	const newDescription = meta.ui?.newDescription || '';

	document.getElementById('stat-old').textContent = formatSize(latest.oldSizeKB);
	document.getElementById('stat-new').textContent = formatSize(latest.newSizeKB);
	document.getElementById('stat-old-label').textContent = oldLabel + (oldDescription ? ' (' + oldDescription + ')' : '');
	document.getElementById('stat-new-label').textContent = newLabel + (newDescription ? ' (' + newDescription + ')' : '');
}

function updateMeta(data) {
	const meta = data.meta;
	const date = new Date(meta.generatedAt).toLocaleString();

	document.getElementById('meta').innerHTML = `Last updated: ${date}<br>` + `${meta.oldPath} \u2192 ${meta.newPath}`;
}

function initUI(data) {
	const meta = data.meta;
	const ui = meta.ui || {};
	const oldLabel = ui.oldLabel || meta.oldPath;
	const newLabel = ui.newLabel || meta.newPath;
	const oldDescription = ui.oldDescription || '';
	const newDescription = ui.newDescription || '';

	const titleEl = document.getElementById('dashboard-title');

	if (titleEl && ui.title) {
		titleEl.textContent = ui.title;
	}

	const subtitleEl = document.getElementById('dashboard-subtitle');

	if (subtitleEl) {
		subtitleEl.textContent = `Code migration from ${oldLabel} (${oldDescription}) \u2192 ${newLabel}`;
	}

	const legendOldEl = document.getElementById('legend-old');

	if (legendOldEl) {
		legendOldEl.textContent = `${oldLabel} (${oldDescription})`;
	}

	const legendNewEl = document.getElementById('legend-new');

	if (legendNewEl) {
		legendNewEl.textContent = `${newLabel} (${newDescription})`;
	}
}

// --- Changes table ---

function calculateDailyChanges(data) {
	const points = data.data;
	const changeMap = new Map();

	for (let i = 1; i < points.length; i++) {
		const current = points[i];
		const prev = points[i - 1];

		changeMap.set(current.time, {
			oldSize: current.oldSizeKB - prev.oldSizeKB,
			oldFiles: current.oldFiles - prev.oldFiles,
			newSize: current.newSizeKB - prev.newSizeKB,
			newFiles: current.newFiles - prev.newFiles,
			totalSize: (current.oldSizeKB + current.newSizeKB) - (prev.oldSizeKB + prev.newSizeKB),
		});
	}

	return changeMap;
}

function calculateAllChanges(data, period, changeMap) {
	const points = data.data;
	const changes = [];

	if (period === 'day') {
		for (let i = points.length - 1; i > 0; i--) {
			const current = points[i];
			const change = changeMap.get(current.time);

			if (change) {
				changes.push({
					date: formatDate(current.time),
					oldSize: change.oldSize,
					oldFiles: change.oldFiles,
					newSize: change.newSize,
					newFiles: change.newFiles,
				});
			}
		}
	} else {
		for (let i = points.length - 1; i > 0; ) {
			const current = points[i];
			const weekAgo = current.time - 7 * 24 * 60 * 60;
			let j = i - 1;

			while (j >= 0 && points[j].time > weekAgo) {
				j--;
			}

			const prev = points[Math.max(0, j)];

			changes.push({
				date: `${formatDate(prev.time)} \u2192 ${formatDate(current.time)}`,
				oldSize: current.oldSizeKB - prev.oldSizeKB,
				oldFiles: current.oldFiles - prev.oldFiles,
				newSize: current.newSizeKB - prev.newSizeKB,
				newFiles: current.newFiles - prev.newFiles,
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
				<span class="${getChangeClass(c.oldSize, true)}">${formatSizeChange(c.oldSize)}</span>
				<span class="${getChangeClass(c.oldFiles, true)}">${formatChange(c.oldFiles)}</span>
			</div>
			<div class="changes-cell new">
				<span class="${getChangeClass(c.newSize)}">${formatSizeChange(c.newSize)}</span>
				<span class="${getChangeClass(c.newFiles)}">${formatChange(c.newFiles)}</span>
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

	renderChangesTable(data, 'day', changeMap);
}

// --- Init ---

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
