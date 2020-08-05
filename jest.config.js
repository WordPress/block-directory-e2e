module.exports = {
	...require( '@wordpress/scripts/config/jest-e2e.config' ),
	setupFiles: [ ],
	setupFilesAfterEnv: [
		'<rootDir>/config/setup-test-framework.js',
	],
	testPathIgnorePatterns: [
		'/node_modules/', '/specs/utils/'
	],
};
