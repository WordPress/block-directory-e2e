export const removeAllBlocks = async () => {
	await page.evaluate( () => {
		const blocks = wp.data.select( 'core/block-editor' ).getBlocks();
		const clientIds = blocks.map( ( block ) => block.clientId );
		wp.data.dispatch( 'core/block-editor' ).removeBlocks( clientIds );
	} );
};

export const getThirdPartyBlocks = async () => {
	return await page.evaluate( () => {
		const blocks = wp.data.select( 'core/blocks' ).getBlockTypes();

		return blocks
			.filter( ( i ) => ! i.name.startsWith( 'core' ) )
			.map( ( i ) => {
				// We return a new object the block can have a react element which not serializable and would result in an undefined list
				return {
					name: i.name,
					title: i.title,
					description: i.description,
					category: i.category,
					keywords: i.keywords,
					supports: i.supports,
				};
			} );
	} );
};

export const getInstalledBlocks = async () => {
	return page.evaluate( () => {
		return wp.data
			.select( 'core/block-directory' )
			.getInstalledBlockTypes();
	} );
};

/**
 * Run a function (usually a call to `expect()…`). If it fails, throw an error.
 * This lets us better describe where a test fails, since we can't nest tests.
 *
 * @param {Function} func
 * @param {string} errorMessage
 */
export const expectWithMessage = async ( func, errorMessage = false, captureErrorScreenshot = true ) => {

	try {
		await func();
	} catch ( e ) {
		if ( captureErrorScreenshot ) {
			// Capture a screenshot of the error and store it on GitHub.
			try {
				await page.screenshot( { path: 'screenshots/error.png', fullPage: true } );
			} catch( f ) {}
		}

		console.log( e );

		// If we have a specific error, throw that instead of the test failure.
		if ( errorMessage ) {
			throw new Error( errorMessage );
		}
		throw e;
	}
};

export const getAllLoadedScripts = async () => {
	return await page.evaluate( () => {
		const assets = [];
		document.querySelectorAll( 'script' ).forEach( ( item ) => {
			if ( item.src ) {
				assets.push( {
					id: item.id.replace( /-js$/, '' ),
					src: item.src
						.replace(
							/^http:\/\/[^/]+\/(wp-content\/plugins\/[^/]+\/)?/,
							''
						)
						.replace( /[?&]ver=[a-z0-9.-]+/, '' ),
				} );
			}
		} );

		return assets;
	} );
};

export const getAllLoadedStyles = async () => {
	return await page.evaluate( () => {
		const assets = [];
		document
			.querySelectorAll( 'link[rel="stylesheet"]' )
			.forEach( ( item ) => {
				if ( item.href ) {
					assets.push( {
						id: item.id.replace( /-css$/, '' ),
						src: item.href
							.replace(
								/^http:\/\/[^/]+\/(wp-content\/plugins\/[^/]+\/)?/,
								''
							)
							.replace( /[?&]ver=[a-z0-9.-]+/, '' ),
					} );
				}
			} );

		return assets;
	} );
};
