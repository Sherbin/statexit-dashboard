module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: 'module',
	},
	env: {
		browser: true,
		es2020: true,
		node: true,
	},
	plugins: ['@typescript-eslint', 'import'],
	extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
	rules: {
		// Indentation
		indent: 'off',
		'@typescript-eslint/indent': ['error', 'tab', { SwitchCase: 1 }],

		// Quotes
		quotes: 'off',
		'@typescript-eslint/quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],

		// Semicolons
		semi: 'off',
		'@typescript-eslint/semi': ['error', 'always'],

		// Trailing commas
		'comma-dangle': 'off',
		'@typescript-eslint/comma-dangle': ['error', 'always-multiline'],

		// Bracket spacing
		'object-curly-spacing': 'off',
		'@typescript-eslint/object-curly-spacing': ['error', 'always'],

		// Line length
		'max-len': ['warn', { code: 120, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true }],

		// No default export
		'import/no-default-export': 'error',

		// Naming conventions
		'@typescript-eslint/naming-convention': [
			'error',
			// Classes, interfaces, types, enums - PascalCase
			{
				selector: ['class', 'interface', 'typeAlias', 'enum', 'typeParameter'],
				format: ['PascalCase'],
			},
			// Class properties and methods
			{
				selector: ['classProperty', 'classMethod'],
				format: ['camelCase'],
				leadingUnderscore: 'allow',
			},
			// Private members - allow underscore prefix
			{
				selector: ['classProperty', 'classMethod'],
				modifiers: ['private'],
				format: ['camelCase'],
				leadingUnderscore: 'require',
			},
			// Variables - camelCase or UPPER_CASE for constants
			{
				selector: 'variable',
				format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
			},
			// Functions - camelCase or PascalCase
			{
				selector: 'function',
				format: ['camelCase', 'PascalCase'],
			},
			// Parameters - camelCase
			{
				selector: 'parameter',
				format: ['camelCase'],
				leadingUnderscore: 'allow',
			},
		],

		// Member ordering in classes
		'@typescript-eslint/member-ordering': [
			'error',
			{
				default: [
					// Static fields
					'public-static-field',
					'protected-static-field',
					'private-static-field',

					// Instance fields
					'public-instance-field',
					'protected-instance-field',
					'private-instance-field',

					// Constructors
					'constructor',

					// Static methods
					'public-static-method',
					'protected-static-method',
					'private-static-method',

					// Instance methods
					'public-instance-method',
					'protected-instance-method',
					'private-instance-method',
				],
			},
		],

		// Import rules
		'import/order': [
			'error',
			{
				groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
				'newlines-between': 'always',
				alphabetize: { order: 'asc', caseInsensitive: true },
			},
		],

		// General best practices
		'no-console': 'off', // CLI tool needs console
		'no-debugger': 'error',
		'no-unused-vars': 'off',
		'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
		'@typescript-eslint/explicit-function-return-type': 'off',
		'@typescript-eslint/explicit-module-boundary-types': 'off',
		'@typescript-eslint/no-explicit-any': 'warn',
		'@typescript-eslint/no-non-null-assertion': 'warn',

		// Curly braces
		curly: ['error', 'all'],

		// Brace style
		'brace-style': 'off',
		'@typescript-eslint/brace-style': ['error', '1tbs', { allowSingleLine: false }],

		// Padding lines between statements
		'padding-line-between-statements': [
			'error',
			{ blankLine: 'always', prev: '*', next: 'return' },
			{ blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
			{ blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
		],

		// No multiple empty lines
		'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],

		// EOF newline
		'eol-last': ['error', 'always'],
	},
	overrides: [
		// Allow default exports in specific files
		{
			files: ['*.config.js', '*.config.ts', 'jest.config.*'],
			rules: {
				'import/no-default-export': 'off',
			},
		},
		// Relax rules for test files
		{
			files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
			rules: {
				'@typescript-eslint/no-explicit-any': 'off',
			},
		},
	],
};
