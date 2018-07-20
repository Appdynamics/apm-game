const process = require('process')
const url = require('url')

const config = JSON.parse(process.env.APP_CONFIG)
const apm = JSON.parse(process.env.APM_CONFIG)

const controller = url.parse(apm.controller)

var appdynamics = {}

if (config.agent === 'yes') {
  appdynamics = require("appdynamics")
  appdynamics.profile({
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
  })
}

const express = require('express')
const morgan = require('morgan')
const http = require('http')

const app = express()
app.use(morgan('combined'))

var port = parseInt(process.argv[2])

const endpoints = config.endpoints.http

Object.keys(endpoints).forEach(function(key) {
  if(!key.startsWith('/')) {
    endpoints['/' + key] = endpoints[key]
    delete endpoints[key]
  }
})

console.log(endpoints)

if (isNaN(port)) {
  port = 3000
}

function processCall(call) {
  return new Promise(function(resolve, reject) {
    // If call is an array, select one element as call
    if (Array.isArray(call)) {
      call = call[Math.floor(Math.random() * call.length)]
    }
    // If call is an object, check for probability
    if (typeof call === 'object') {
        if(call.probability <= Math.random()) {
          resolve(`${call.call} was not probable`)
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
    } else if (call.startsWith('http://')) {
      http.get(call, function(res, req) {
        const body = [];
        res.on('data', (chunk) => body.push(chunk));
        res.on('end', () => resolve(body.join('')));
      }).on('error', function(err) {
        resolve(err)
      })
    } else {
      // No other methods are currently implemented
      resolve(`${call} is not supported`)
    }
  })
}

function processRequest(req, res) {
  const path = url.parse(req.url).pathname
  if(req.query.unique_session_id) {
    var txn = appdynamics.getTransaction(req);
    txn.addSnapshotData("unique_session_id", req.query.unique_session_id)
  }
  if (endpoints.hasOwnProperty(path)) {
    var promises = endpoints[path].map(processCall)
    Promise.all(promises).then(function(results) {
      res.send(results)
    }).catch(function(reason) {
      res.status(reason.code).send(reason.message)
    })
  } else {
    res.status(404).send("404")
  }
}

app.get('/**', function(req, res) {
  processRequest(req, res)
})

app.post('/**', function(req, res) {
  processRequest(req, res)
})

app.listen(port, () => console.log(
  `Running ${config.name} (type: ${config.type}) on port ${port} with${config.agent === 'yes'
  ? ` agent, reporting to ${apm.controller}`
  : 'out agent'}`))
