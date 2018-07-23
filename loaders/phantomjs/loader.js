const system = require('system');



if(!system.env.hasOwnProperty('LOADER_CONFIG')) {
	console.log('No loader config for phantom.js provided, exiting ...')
	phantom.exit(1);
}

const config = JSON.parse(system.env.LOADER_CONFIG)
const apm = JSON.parse(system.env.APM_CONFIG)

if(typeof config.wait !== 'number') {
	config.wait = 0
}

if(typeof config.adrumTimeout !== 'number') {
	config.adrumTimeout = 15
}

const withEum = apm.hasOwnProperty('eum')

if (!String.prototype.endsWith) {
  String.prototype.endsWith = function(searchString, position) {
      var subjectString = this.toString();
      if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
        position = subjectString.length;
      }
      position -= searchString.length;
      var lastIndex = subjectString.indexOf(searchString, position);
      return lastIndex !== -1 && lastIndex === position;
  };
}

var byteToHex = [];
for (var i = 0; i < 256; ++i) {
  byteToHex[i] = (i + 0x100).toString(16).substr(1);
}

function bytesToUuid(buf, offset) {
  var i = offset || 0;
  var bth = byteToHex;
  // join used to fix memory issue caused by concatenation: https://bugs.chromium.org/p/v8/issues/detail?id=3175#c4
  return ([bth[buf[i++]], bth[buf[i++]],
	bth[buf[i++]], bth[buf[i++]], '-',
	bth[buf[i++]], bth[buf[i++]], '-',
	bth[buf[i++]], bth[buf[i++]], '-',
	bth[buf[i++]], bth[buf[i++]], '-',
	bth[buf[i++]], bth[buf[i++]],
	bth[buf[i++]], bth[buf[i++]],
	bth[buf[i++]], bth[buf[i++]]]).join('');
}

function rng() {
		var rnds = new Array(16);
    for (var i = 0, r; i < 16; i++) {
      if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
      rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }
		return rnds;
}

function uuidv4(options, buf, offset) {
  var i = buf && offset || 0;

  if (typeof(options) == 'string') {
    buf = options === 'binary' ? new Array(16) : null;
    options = null;
  }
  options = options || {};

  var rnds = options.random || (options.rng || rng)();

  // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;

  // Copy bytes to buffer, if provided
  if (buf) {
    for (var ii = 0; ii < 16; ++ii) {
      buf[i + ii] = rnds[ii];
    }
  }

  return buf || bytesToUuid(rnds);
}

console.log("Running phantom.js load in " + config.wait + " seconds ...")

function process(urls) {
    if (urls.length == 0) {
        loop();
    } else {
        url = urls.shift();

        page = require('webpage').create();

				var timeoutId = -1;

				if(withEum) {
					page.onResourceReceived = function(response) {
						if(response.stage === 'end') {
							if (response.url.endsWith('adrum')) {
								console.log('beacon received!')
								clearTimeout(timeoutId)
								page.release();
						    process(urls);
							}
						}
					}
				}

        page.open(url, function(status) {
				    console.log(url + ": " + status);
						if(!withEum) {
							page.release();
							process(urls);
						} else {
							console.log('Waiting for adrum beacon...')
							timeoutId = setTimeout(function() {
								console.log('adrum timeout')
								page.release();
								process(urls);
							}, config.adrumTimeout * 1000)
						}
				})

    }
}

function loop() {
	console.log("===")
	var urls = config.urls
	if(typeof config.withSession === 'undefined' || config.withSession) {
		const sessionId = uuidv4()
		urls = urls.map(function(url) {
			return url + "?unique_session_id=" + sessionId
		})
	}
	process(urls)
}

setTimeout(loop, config.wait * 1000);
