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
	insertBlock,
	getAllBlocks,
} from '@wordpress/e2e-test-utils';

/**
 * Internal dependencies
 */

import {
	getInstalledBlocks,
	getThirdPartyBlocks,
	runTest,
	removeAllBlocks,
} from '../utils';

// We don't want to see warnings during these tests
console.warn = () => {};

// Depending on the environment, the url may be encoded or not.
const urlMatch = ( url ) => {
	const urlPart = '/wp/v2/block-directory/search';
	const encoded = encodeURIComponent( urlPart );
	return url.indexOf( urlPart ) >= 0 || url.indexOf( encoded ) >= 0;
};

const { searchTerm } = github.context.payload.client_payload;

core.info( `
--------------------------------------------------------------
Running Tests for "${ searchTerm }"
--------------------------------------------------------------
` );

describe( `Block Directory Tests`, () => {
	beforeEach( async () => {
		await createNewPost();
		await removeAllBlocks();
	} );

	it( 'Block returns from API and installs', async () => {
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

			await new Promise( ( resolve ) => setTimeout( resolve, 5000 ) );

			const blocks = await getThirdPartyBlocks();

			runTest( () => {
				expect( blocks.length ).toBeGreaterThan( 0 );
			}, `Couldn't install "${ searchTerm }".` );

			core.setOutput( 'success', true );
		} catch ( e ) {
			core.setFailed( e );
			core.setOutput( 'error', e );
			core.setOutput( 'success', false );
			throw new Error();
		}
	} );
} );
