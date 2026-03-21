// Тест анализа первых 10 дней для отладки
import('./dist/cli.js')
	.then((_module) => {
		console.log('Модуль загружен, но нужно запускать через node dist/cli.js');
	})
	.catch((err) => {
		console.error('Ошибка:', err);
	});
