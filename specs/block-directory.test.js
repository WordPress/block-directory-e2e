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

import { getThirdPartyBlocks, runTest, removeAllBlocks } from '../utils';

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

			runTest( () => {
				expect( Array.isArray( resp ) ).toBeTruthy();
			}, `The search result for "${ searchTerm }" isn't an array.` );

			runTest( () => {
				expect( resp.length ).toBeLessThan( 2 );
			}, `We found multiple blocks for "${ searchTerm }".` );

			runTest( () => {
				expect( resp ).toHaveLength( 1 );
			}, `We found no matching blocks for "${ searchTerm }" in the directory.` );

			let addBtn = await page.waitForSelector(
				'.block-directory-downloadable-blocks-list li:first-child button'
			);

			// Add the block
			await addBtn.click();

			// We'll wait for the add button to disappear which signals the block was registered
			await page.waitForSelector(
				'.block-directory-downloadable-blocks-list li:first-child button'
			);

			await new Promise( ( resolve ) => setTimeout( resolve, 10000 ) );

			const blocks = await getThirdPartyBlocks();

			runTest( () => {
				expect( blocks.length ).toBeGreaterThan( 0 );
			}, `Couldn't install "${ searchTerm }".` );

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
