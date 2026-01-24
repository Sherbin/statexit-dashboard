// Synthetic test data for visual verification of the chart
// eslint-disable-next-line @typescript-eslint/naming-convention
const _TEST_DATA = {
	meta: {
		sourceRepo: 'test-repo',
		oldPath: 'src/legacy',
		newPath: 'src/new',
		generatedAt: new Date().toISOString(),
		version: 2,
	},
	data: generateMigrationData(100, 50),
};

function easeInOutQuad(t) {
	return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function generateMigrationData(days, totalFiles) {
	const data = [];
	const startTime = Math.floor(Date.now() / 1000) - days * 86400;
	const totalLines = 10000;

	for (let i = 0; i < days; i++) {
		const progress = i / (days - 1);
		const migrated = Math.floor(totalLines * easeInOutQuad(progress));
		const migratedFiles = Math.floor(totalFiles * easeInOutQuad(progress));

		data.push({
			time: startTime + i * 86400,
			old: totalLines - migrated,
			new: migrated,
			oldFiles: totalFiles - migratedFiles,
			newFiles: migratedFiles,
		});
	}

	return data;
}
