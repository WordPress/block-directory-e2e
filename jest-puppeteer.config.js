module.exports = {
	"exitOnPageError": false,
	launch: {
		headless: process.env.PUPPETEER_HEADLESS !== 'false',
  },
}
