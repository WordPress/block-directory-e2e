/**
 * External dependencies
 */
const core = require( '@actions/core' );
const github = require( '@actions/github' );

const promiseAny = require('promise.any');
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

import { getThirdPartyBlocks, runTest, removeAllBlocks, getAllLoadedScripts, getAllLoadedStyles } from '../utils';
import { waitUntilNetworkIdle } from '../networkIdle';

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
page.on( 'pageerror', error => {
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

	let freshScripts = [];
	let freshStyles  = [];

	it( 'Block returns from API and installs', async ( done ) => {
		try {
			await searchForBlock( searchTerm );

			const finalResponse = await page.waitForResponse(
				( response ) =>
					urlMatch( response.url() ) &&
					response.status() === 200 &&
					response.request().method() === 'GET' // We don't want the OPTIONS request
			);

			const resp = await finalResponse.json();

			// Determine the loaded assets, store it for the next test.
			freshScripts = await getAllLoadedScripts();
			freshStyles  = await getAllLoadedStyles();

			runTest( () => {
				expect( Array.isArray( resp ) ).toBeTruthy();
			}, `The search result for "${ searchTerm }" isn't an array.` );

			runTest( () => {
				expect( resp.length ).toBeLessThan( 2 );
			}, `We found multiple blocks for "${ searchTerm }".` );

			runTest( () => {
				expect( resp ).toHaveLength( 1 );
			}, `We found no matching blocks for "${ searchTerm }" in the directory.` );

			const addBtnSelector = '.block-directory-downloadable-blocks-list li:first-child button';
			let addBtn = await page.waitForSelector( addBtnSelector );

			// Wait for the Block install and insert to complete.
			await Promise.all( [

				// Add the block
				addBtn.click(),

				Promise.any( [
					// Wait for the add button to disappear which signals the block was registered
					page.waitForSelector( addBtnSelector, { hidden: true } ),

					// or, for the retry "crashed editor" reload button to appear instead.
					page.waitForSelector( '.block-directory-downloadable-block-notice.is-error button' )
				]).catch( e => console.log( e )),

				// And wait for the Network to go idle (Assets inserted)
				waitUntilNetworkIdle( 'networkidle0' ),

			] );

			const blocks = await getThirdPartyBlocks();

			runTest( () => {
				expect( blocks.length ).toBeGreaterThan( 0 );
			}, `Couldn't install "${ searchTerm }".` );

			// check to see if it errored.
			if ( jsError ) {
				throw new Error( jsError );
			}

			core.setOutput( 'error', '' );
			core.setOutput( 'success', true );
			done();
		} catch ( e ) {
			core.setFailed( e.message );
			core.setOutput( 'error', jsError || e.message );
			core.setOutput( 'success', false );

			throw e;
		}
	} );

	it( 'Block Installed - Extract Scripts & Styles required', async ( done ) => {
		// Page reloaded from previous test.
		runTest( () => {
			expect( freshScripts.length ).toBeGreaterThan( 0 );
			expect( freshStyles.length  ).toBeGreaterThan( 0 );
		}, `The previous test did not load scripts/styles.` );

		const blocks = await getThirdPartyBlocks();
		runTest( () => {
			expect( blocks.length ).toBeGreaterThan( 0 );
		}, `Block not installed.` );

		const loadedScripts = await getAllLoadedScripts();
		const loadedStyles  = await getAllLoadedStyles();

		const scriptDiff = loadedScripts.filter( x => !freshScripts.some( y => ( x.id == y.id ) ) );
		const styleDiff  = loadedStyles.filter(  x => !freshStyles.some(  y => ( x.id == y.id ) ) );

		core.setOutput( 'scripts', scriptDiff );
		core.setOutput( 'styles',  styleDiff  );

		done();
	} );
} );
