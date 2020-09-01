const fs    = require('fs').promises;
const core  = require('@actions/core');
const fetch = require('node-fetch');

export const setOutput = ( field = false, value = false ) => {

	if ( field ) {
		// Pass it through to here as well.
		core.setOutput( field, value );

		setOutput.output = setOutput.output || {};

		if ( typeof value !== 'string' ) {
			value = JSON.stringify( value );
		}

		setOutput.output[ field ] = value;
	}

	return setOutput.output;
}

export const wporgHttpCallback = async ( pluginSlug ) => {
	let payload = setOutput();

	// Output the details for debugging.
	core.info( JSON.stringify( payload, null, 2 ) );

	// Import the images into the payload.
	for ( const field in payload ) {
		const file = payload[ field ].match( /^file:(.+)$/ );

		if ( file ) {
			payload[ field ] = await fs.readFile( file[1], { encoding: 'base64' } );
		}
	}

	const wporgSecret = process.env.WPORG_SECRET || false;
	if ( ! wporgSecret ) {
		return;
	}

	await fetch(
		`https://wordpress.org/plugins/wp-json/plugins/v1/plugin/${ pluginSlug }/e2e`,
		{
			method: 'post',
			body: JSON.stringify( payload ),
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `BEARER ${ wporgSecret }`
			},
		}
	);
}