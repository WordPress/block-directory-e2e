/**
 * External dependencies
 */
const core = require( '@actions/core' );
const github = require( '@actions/github' );

const promiseAny = require( 'promise.any' );
promiseAny.shim();

/**
 * WordPress dependencies
 */
import {
	createNewPost,
	searchForBlock,
	deactivatePlugin,
	uninstallPlugin,
} from '@wordpress/e2e-test-utils';

/**
 * Internal dependencies
 */

import {
	getThirdPartyBlocks,
	expectWithMessage,
	removeAllBlocks,
	getAllLoadedScripts,
	getAllLoadedStyles,
} from './utils';
import { waitUntilNetworkIdle } from './utils/network-idle';

// We don't want to see warnings during these tests
console.warn = () => {};

// Depending on the environment, the url may be encoded or not.
const urlMatch = ( url ) => {
	const urlPart = '/wp/v2/block-directory/search';
	const encoded = encodeURIComponent( urlPart );
	return url.indexOf( urlPart ) >= 0 || url.indexOf( encoded ) >= 0;
};

const payload = github.context.payload.client_payload;
const searchTerm = process.env.SEARCH_TERM || payload.searchTerm;
const pluginSlug = process.env.PLUGIN_SLUG || payload.slug;

// Variable to hold any encounted JS errors.
let jsError = false;
page.on( 'pageerror', ( error ) => {
	jsError = error.toString();

	console.log( error );
} );

core.info( `
--------------------------------------------------------------
Running Tests for "${ searchTerm }/${ pluginSlug }"
--------------------------------------------------------------
` );

describe( `Block Directory Tests`, () => {
	beforeEach( async () => {
		await createNewPost();
		await removeAllBlocks();

		jsError = false;
	} );

	afterAll( async () => {
		await deactivatePlugin( pluginSlug );
		await uninstallPlugin( pluginSlug );
	} );

	// Be patient.
	page.setDefaultTimeout( 60000 );

	let freshScripts = [];
	let freshStyles = [];

	it( 'Block returns from API and installs', async () => {
		try {
			// Determine the loaded assets, store it for the next test.
			freshScripts = await getAllLoadedScripts();
			freshStyles = await getAllLoadedStyles();

			await searchForBlock( searchTerm );

			const finalResponse = await page.waitForResponse(
				( response ) =>
					urlMatch( response.url() ) &&
					response.status() === 200 &&
					response.request().method() === 'GET' // We don't want the OPTIONS request
			);

			const resp = await finalResponse.json();

			expectWithMessage( () => {
				expect( Array.isArray( resp ) ).toBeTruthy();
			}, `The search result for "${ searchTerm }" isn't an array.` );

			expectWithMessage( () => {
				expect( resp.length ).toBeGreaterThan( 0 );
			}, `We found no matching blocks for "${ searchTerm }" in the directory.` );

			const addBtnSelector =
				'.block-directory-downloadable-blocks-list li:first-child button';
			await page.waitForSelector( addBtnSelector );

			// Output a screenshot of the Search Results for debugging.
			core.setOutput(
				'screenshotSearchResults',
				await (
					await page.$( '.block-directory-downloadable-blocks-list' )
				 ).screenshot( { encoding: 'base64' } )
			);

			// Add the block
			await page.click( addBtnSelector );

			// Watch the button go busy…
			await page.waitForSelector( addBtnSelector + '.is-busy' );

			// Then either non-busy or removed.
			await Promise.any( [
				// This is the expected case, the button is removed from the screen
				// because the block is installed.
				page.waitFor(
					() => ! document.querySelector( addBtnSelector )
				),
				// But in some cases the inserted block has a restricted set of "children",
				// which interacts with the filter & Block Directory, so the add button
				// doesn't go away, it just becomes "un-busy".
				// See https://github.com/WordPress/gutenberg/pull/24148
				page.waitForSelector( addBtnSelector + ':not(.is-busy)' ),
			] );

			// And wait for the Network to go idle (Assets inserted)
			await waitUntilNetworkIdle( 'networkidle0' );

			// Check to see if there was a specific reason for a failure.
			expectWithMessage( async () => {
				const error = await page.evaluate( () => {
					const el = document.querySelector(
						'.block-directory-downloadable-block-notice.is-error .block-directory-downloadable-block-notice__content'
					);
					return el ? el.innerText : false;
				} );

				expect( error ).toBeFalsy();
			}, `Couldn't install "${ searchTerm }".` );

			const blocks = await getThirdPartyBlocks();

			expectWithMessage( () => {
				expect( blocks.length ).toBeGreaterThan( 0 );
			}, `Couldn't install "${ searchTerm }".` );

			// check to see if it errored.
			if ( jsError ) {
				throw new Error( jsError );
			}

			// Get a screenshot of the block.
			try {
				core.setOutput(
					'screenshotBlock',
					await (
						await page.waitForSelector(
							'.is-root-container .wp-block:not([data-type^="core/"])'
						)
					 ).screenshot( { encoding: 'base64' } )
				);
			} catch ( e ) {
				// Ignore any error here, the test should still succeed.
			}

			core.setOutput( 'error', '' );
			core.setOutput( 'success', true );
		} catch ( e ) {
			core.setFailed( e.message );
			core.setOutput( 'error', jsError || e.message );
			core.setOutput( 'success', false );

			throw e;
		}
	} );

	it( 'Block Installed - Extract Scripts & Styles required', async () => {
		// Page reloaded from previous test.
		expectWithMessage( () => {
			expect( freshScripts.length ).toBeGreaterThan( 0 );
			expect( freshStyles.length ).toBeGreaterThan( 0 );
		}, `The previous test did not load scripts/styles.` );

		const blocks = await getThirdPartyBlocks();
		expectWithMessage( () => {
			expect( blocks.length ).toBeGreaterThan( 0 );
		}, `Block not installed.` );

		const loadedScripts = await getAllLoadedScripts();
		const loadedStyles = await getAllLoadedStyles();

		const scriptDiff = loadedScripts.filter(
			( x ) => ! freshScripts.some( ( y ) => x.id === y.id )
		);
		const styleDiff = loadedStyles.filter(
			( x ) => ! freshStyles.some( ( y ) => x.id === y.id )
		);

		core.setOutput( 'scripts', scriptDiff );
		core.setOutput( 'styles', styleDiff );
		core.setOutput( 'blocks', blocks );
	} );
} );
