const fetch = require('node-fetch');

page.setRequestInterception( true );

page.on( 'request', async ( request ) => {
	// Abort favicon requests.
	if ( '/favicon.ico' === request.url() ) {
		request.abort();
	}

	// Ensure that any script/stylesheet requests in wp-content properly 404 and are not handled by WordPress.
	const resourceTypes = [ 'script', 'stylesheet' ];
	if (
		! resourceTypes.includes( request.resourceType() ) ||
		! /wp-content/.test( request.url() )
	) {
		request.continue();
		return;
	}

	// Make the request ourselves, and then return the response.
	fetch( request.url(), { redirect: 'manual' } ).then( ( response ) => {
		const contentType = response.headers.get( 'content-type' );

		if (
			// A JS/CSS file in wp-content should never respond with a text/html response
			( 200 == response.status && /^text\/html/.test( contentType ) )
			||
			// ..or a redirect
			( response.status >= 300 && response.status < 400)
		) {
			request.respond( {
				status: 404,
				contentType: contentType,
				body: '',
			} );
		} else {
			// Pass the server response back.
			request.respond( {
				status: response.status,
				contentType: contentType,
				body: response.body.buffer(),
			} );
		}
	} ).catch( () => {
		request.continue()
	} );

} );