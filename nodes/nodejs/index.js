const process = require('process')
const url = require('url')

const config = JSON.parse(process.env.APP_CONFIG)
const apm = JSON.parse(process.env.APM_CONFIG)

const controller = url.parse(apm.controller)

var appdynamics = {
  getTransaction: function() { return {
    startExitCall: function() {},
    endExitCall: function() {}
  }; }
}

var withEum = false

if (config.agent === 'yes') {
  appdynamics = require("appdynamics")

  var appdynamicsProfile = {
    controllerHostName: controller.hostname,
    controllerPort: controller.port,
    controllerSslEnabled: controller.protocol.startsWith('https'),
    accountName: apm.accountName,
    accountAccessKey: apm.accountAccessKey,
    applicationName: apm.applicationName,
    tierName: config.name,
    nodeName: config.name,
    libagent: true,
    debug: true
  }

  if(apm.eventsService && apm.globalAccountName) {
    appdynamicsProfile.analytics = {
      host: 'machine-agent',
      port: 9090,
      SSL: false
    }
  }

  if(typeof apm.eum === 'object') {
    withEum = true
    var eumConfig = Object.assign({
      xd: {enable : false}
    }, apm.eum);
  }

  appdynamics.profile(appdynamicsProfile)
}

const express = require('express')
const morgan = require('morgan')
const http = require('http')
const cronmatch = require('cronmatch')
var bodyParser = require('body-parser');

const app = express()

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(morgan('combined'))

var port = parseInt(process.argv[2])

const endpoints = config.endpoints.http

Object.keys(endpoints).forEach(function(key) {
  if(!key.startsWith('/')) {
    endpoints['/' + key] = endpoints[key]
    delete endpoints[key]
  }
})

if (isNaN(port)) {
  port = 3000
}

function buildResponse(timeout) {
  const start = process.hrtime();
  var elapsed = process.hrtime(start);
  var response = ""
  while(elapsed[0] * 1000000000 + elapsed[1] < timeout * 1000000) {
    response += " ";
    elapsed = process.hrtime(start);
  }
  return response.length+" slow response"
}

function loadFromCache(timeout, txn) {
  const start = process.hrtime();
  var elapsed = process.hrtime(start);
  var response = ""
  while(elapsed[0] * 1000000000 + elapsed[1] < timeout * 1000000) {
    var exit = txn.startExitCall({
      exitType: "EXIT_CACHE",
      label: "Redis Cache",
      backendName: "Redis",
      identifyingProperties: {
        "SERVER POOL": "redis:6380"
      }
    });

    elapsed = process.hrtime(start);
    response += " ";

    txn.endExitCall(exit)
  }
  return response.length+" send data to cache"
}

function processCall(call, req) {
  return new Promise(function(resolve, reject) {
    // If call is an array, select one element as call
    if (Array.isArray(call)) {
      call = call[Math.floor(Math.random() * call.length)]
    }
    // If call is an object, check for probability
    if (typeof call === 'object') {
        if(call.hasOwnProperty('probability') && call.probability <= Math.random()) {
          resolve(`${call.call} was not probable`)
          return
        }
        if(call.hasOwnProperty('schedule') && !cronmatch.match(call.schedule, new Date())) {
          resolve(`${call.call} was not scheduled`)
          return
        }
        call = call.call
    }

    if (call.startsWith('error')) {
      var [_,code,message] = call.split(',')
      reject({ code, message })
    } else if (call.startsWith('sleep')) {
      var [_,timeout] = call.split(',')
      setTimeout(function() {
        resolve(`Slept for ${timeout}`)
      }, timeout)
    } else if (call.startsWith('slow')) {
      var [_,timeout] = call.split(',')
      resolve(buildResponse(timeout))
    } else if (call.startsWith('http://')) {
      http.get(call, function(res, req) {
        const body = [];
        res.on('data', (chunk) => body.push(chunk));
        res.on('end', () => resolve(body.join('')));
      }).on('error', function(err) {
        resolve(err)
      })
    } else if (call.startsWith('image')) {
      var [_,src] = call.split(',')
      resolve(`<img src='${src}' />`)
    } else if (call.startsWith('cache')) {
      var [_,timeout] = call.split(',')
      var txn = appdynamics.getTransaction(req);
      resolve(loadFromCache(timeout, txn))
    } else {
      // No other methods are currently implemented
      resolve(`${call} is not supported`)
    }
  })
}

function processRequest(req, res, params) {

  const path = url.parse(req.url).pathname

  var txn = appdynamics.getTransaction(req);

  if(txn) {

    if(params.unique_session_id) {

      txn.addSnapshotData("uniqueSessionId", req.query.unique_session_id)
      txn.addAnalyticsData("uniqueSessionId", req.query.unique_session_id)
    }

    if(params.hasOwnProperty('analytics') && typeof params.analytics === 'object') {
      Object.keys(params.analytics).forEach(function(key) {
        console.log('Adding analytics data: ', key, params.analytics[key])
        txn.addAnalyticsData(key, params.analytics[key])
        txn.addSnapshotData(key, params.analytics[key])
      })
    }

  }

  if (endpoints.hasOwnProperty(path)) {
    var promises = endpoints[path].map(function(call) {
      return processCall(call, req)
    })
    Promise.all(promises).then(function(results) {

      if(withEum) {
        res.send(`<!doctype html><html lang="en"><head><title>${config.name}</title><script>window['adrum-start-time'] = new Date().getTime();window['adrum-config'] = ${JSON.stringify(eumConfig)}</script><script src='//cdn.appdynamics.com/adrum/adrum-latest.js'></script><body>${JSON.stringify(results)}`)
      } else {
        res.send(results)
      }


    }).catch(function(reason) {
      res.status(typeof reason.code === 'number'?reason.code:500).send(reason.message)
    })
  } else {
    res.status(404).send("404")
  }
}

app.get('/**', function(req, res) {
  processRequest(req, res, req.query)
})

app.post('/**', function(req, res) {
  processRequest(req, res, req.body)
})

app.listen(port, () => console.log(
  `Running ${config.name} (type: ${config.type}) on port ${port} with${config.agent === 'yes'
  ? ` agent, reporting to ${apm.controller}`
  : 'out agent'}`))
