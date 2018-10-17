const puppeteer = require('puppeteer');
const process = require('process');
const url = require('url');
const uuidv4 = require('uuid/v4');

if(!process.env.hasOwnProperty('LOAD_CONFIG')) {
	console.log('No load config for puppeeteer provided, exiting ...')
	process.exit(1)
}

const config = JSON.parse(process.env.LOAD_CONFIG);
const apm = JSON.parse(process.env.APM_CONFIG);

if(typeof config.wait !== 'number') {
	config.wait = 0
}

function run() {

	(async() => {

	    const browser = await puppeteer.launch({
	        args: [
	            '--no-sandbox',
	            '--disable-setuid-sandbox'
	        ]
	    });

	    const page = await browser.newPage();

			page.on('requestfinished', function(request) {
				console.log('  -- ' + request.url())
			})

			while(true) {
				console.log("==========")
				var uniqueId = uuidv4();
				for(var i = 0; i < config.urls.length; i++) {
					const myUrl = new url.URL(config.urls[i]);
					var searchParams = myUrl.searchParams;
					searchParams.append('unique_session_id', uniqueId);
					myUrl.search = searchParams
					console.log("Visiting", myUrl.href);
					try {
					await page.goto(myUrl, {waitUntil: 'networkidle0'});
					} catch (e) {
						console.log(e)
						await new Promise(resolve => setTimeout(resolve, 1500));
					}
				}
			}

			await browser.close();

	})();

}

setTimeout(run, config.wait * 1000);
