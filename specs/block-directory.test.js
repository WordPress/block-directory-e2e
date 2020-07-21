/**
 * External dependencies
 */
const core = require( '@actions/core' );
const github = require( '@actions/github' );

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
} );

core.info( `
--------------------------------------------------------------
Running Tests for "${ searchTerm }/${ pluginSlug }"
--------------------------------------------------------------
` );

describe( `Block Directory Tests`, () => {
	beforeEach( async () => {
		jsError = false;

		await createNewPost();
		await removeAllBlocks();
	} );

	afterAll( async () => {
		await deactivatePlugin( pluginSlug );
		await uninstallPlugin( pluginSlug );
	} );

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

			// Determine the loaded assets.
			const preScripts = await getAllLoadedScripts();
			const preStyles  = await getAllLoadedStyles();

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

				// Wait for the add button to disappear which signals the block was registered
				page.waitForSelector( addBtnSelector, { hidden: true } ),

				// And wait for the Network to go idle (Assets inserted)
				waitUntilNetworkIdle( 'networkidle0' ),

			] );

			const blocks = await getThirdPartyBlocks();

			runTest( () => {
				expect( blocks.length ).toBeGreaterThan( 0 );
			}, `Couldn't install "${ searchTerm }".` );

			await page.reload({ waitUntil: [ "domcontentloaded" ] });

			const postScripts = await getAllLoadedScripts();
			const postStyles  = await getAllLoadedStyles();

			const scriptDiff = postScripts.filter( x => !preScripts.some( y => ( x.id == y.id ) ) );
			const styleDiff  = postStyles.filter(  x => !preStyles.some(  y => ( x.id == y.id ) ) );

			core.setOutput( 'scripts', scriptDiff );
			core.setOutput( 'styles',  styleDiff  );

			core.setOutput( 'error', '' );
			core.setOutput( 'success', true );
			done();
		} catch ( e ) {
			core.setFailed( e.message );
			core.setOutput( 'error', jsError || e.message );
			core.setOutput( 'success', false );
			done();
		}
	} );
} );
