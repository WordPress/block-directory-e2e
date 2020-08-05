let inflight = 0;

page.setRequestInterception( true );

page.on( 'request', ( request ) => {
	inflight++;
	request.continue();
} );

page.on( 'requestfinished', ( request ) => {
	inflight--;
} );

page.on( 'requestfailed', ( request ) => {
	inflight--;
} );

const sleep = ( timeout ) =>
	new Promise( ( resolve ) => setTimeout( resolve, timeout ) );

export const waitUntilNetworkIdle = async ( { waitUntil } ) => {
	const maxIdle = waitUntil === 'networkidle0' ? 0 : 2;

	while ( inflight > maxIdle ) {
		await sleep( 100 );
	}

	await sleep( 500 );

	if ( inflight > maxIdle ) {
		await waitUntilNetworkIdle( { waitUntil } );
	}
};
