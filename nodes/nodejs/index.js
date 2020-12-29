const process = require('process')
const url = require('url')
const path = require('path')
const chance = require('chance').Chance()

const config = JSON.parse(process.env.APP_CONFIG)
const apm = JSON.parse(process.env.APM_CONFIG)

const customCodeDir = process.env.CUSTOM_CODE_DIR

const logDir = process.env.LOG_DIRECTORY ? process.env.LOG_DIRECTORY : '.'

const controller = url.parse(apm.controller)

var appdynamics = {
  parseCorrelationInfo: function () {
    return {
      headers: {}
    }
  },
  getTransaction: function () {
    return {
      startExitCall: function () {},
      endExitCall: function () {},
      addSnapshotData: function () {}
    }
  }
}

var withEum = false

if (config.agent === 'yes') {
  appdynamics = require('appdynamics')

  var appdynamicsProfile = {
    controllerHostName: controller.hostname,
    controllerPort: controller.port,
    controllerSslEnabled: controller.protocol.startsWith('https'),
    accountName: apm.accountName,
    accountAccessKey: apm.accountAccessKey,
    applicationName: apm.applicationName,
    tierName: config.name,
    nodeName: `${config.name}-${config.nodeid}`,
    libagent: true,
    debug: true
  }

  if (apm.eventsService && apm.globalAccountName) {
    appdynamicsProfile.analytics = {
      host: 'machine-agent',
      port: 9090,
      SSL: false
    }
  }

  if (typeof apm.eum === 'object') {
    withEum = true
    var eumConfig = Object.assign({
      xd: {
        enable: false
      }
    }, apm.eum)
  }
  console.log('Appdynamics Profile', appdynamicsProfile)
  appdynamics.profile(appdynamicsProfile)
}

const express = require('express')
const morgan = require('morgan')
const log4js = require('log4js')
const http = require('http')
const cronmatch = require('cronmatch')
var bodyParser = require('body-parser')
const sleep = require('sleep')
const rp = require('request-promise')

log4js.configure({
  appenders: {
    FILE: {
      type: 'file',
      filename: `${logDir}/node.log`,
      layout: {
        type: 'pattern',
        pattern: '%d{yyyy-MM-dd hh:mm:ss,SSS} [%z] [%X{AD.requestGUID}] %p %c - %m'
      }
    },
    CONSOLE: {
      type: 'stdout',
      layout: {
        type: 'pattern',
        pattern: '%d{yyyy-MM-dd hh:mm:ss,SSS} [%z] [%X{AD.requestGUID}] %p %c - %m'
      }
    }
  },
  categories: { default: { appenders: ['CONSOLE', 'FILE'], level: 'info' } }
})

var logger = log4js.getLogger()
logger.level = 'debug'

const app = express()

app.use(bodyParser.json()) // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded
app.use(morgan(':remote-addr - ":method :url HTTP/:http-version" :status :res[content-length]  ":user-agent" - :response-time ms', {
  stream: {
    write: function (str) {
      logger.debug(str.trim('\n'))
    }
  }
}))

var port = parseInt(process.argv[2])

const endpoints = config.endpoints.http

const useRp = config.hasOwnProperty('options') && config.options.hasOwnProperty('httpLibrary') && config.options.httpLibrary == 'request-promise'

Object.keys(endpoints).forEach(function (key) {
  if (!key.startsWith('/')) {
    endpoints['/' + key] = endpoints[key]
    delete endpoints[key]
  }
})

if (isNaN(port)) {
  port = 3000
}


function buildResponse(timeout) {
  const start = process.hrtime()
  var elapsed = process.hrtime(start)
  var response = ''
  while (elapsed[0] * 1000000000 + elapsed[1] < timeout * 1000000) {
    response += ' '
    elapsed = process.hrtime(start)
  }
  return response.length + ' slow response'
}

function loadFromCache(timeout, txn) {
  const start = process.hrtime()
  var elapsed = process.hrtime(start)
  var response = ''
  while(elapsed[0] * 1000000000 + elapsed[1] < timeout * 1000000) {
    var exit = txn.startExitCall({
      exitType: 'EXIT_CACHE',
      label: 'Redis Cache',
      backendName: 'Redis',
      identifyingProperties: {
        'SERVER POOL': 'redis:6380'
      }
    });

    elapsed = process.hrtime(start)
    response += ' '

    txn.endExitCall(exit)
  }
  return response.length + ' send data to cache'
}

function processData (resolve, reject, req, data) {
  if (!data.id) {
    reject('Data not processed: No id provided')
  }

  if (data.chance) {
    var fna = data.chance.split(',')
    var fn = fna.shift()
    var attributes = fna.reduce((c, a) => { var [k, v] = a.split(':'); c[k] = isNaN(parseInt(v)) ? v : parseInt(v); return c }, {})
    data.value = chance[fn](attributes)
  }

  if (!data.value) {
    reject('Data not processed: No value provided')
  }

  var value = data.value
  var id = data.id

  if (Array.isArray(value)) {
    value = value[Math.floor(Math.random() * value.length)]
  }

  var txn = appdynamics.getTransaction(req)
  if (txn) {
    txn.addSnapshotData(id, value)
    txn.addAnalyticsData(id, value)
    resolve(`${id} data added: ${value}`)
  }

  reject('No data added: Transaction not found.')
}

function logMessage(level, message) {
  if (['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
    logger[level](message)
  } else {
    logger.info(message)
  }
  return 'Logged (' + level + '): ' + message
}

function executeCustomScript(script, req, resolve, reject) {
  var txn = appdynamics.getTransaction(req)
  var r = require(path.join(customCodeDir, script))({
    logger: logger,
    req: req,
    cronmatch: cronmatch,
    txn: txn,
    sleep: sleep.msleep,
    add: (id, value) => {
      txn.addAnalyticsData(id, value)
      txn.addSnapshotData(id, value)
    },
    chance: chance
  })
  if (r === false) {
    reject(`Script ${script} was not executed successfully`)
  } else if (typeof r === "object" && r.hasOwnProperty('code') && r.hasOwnProperty('code')) {
    reject({ code: r.code, message: r.message })
  } else if (typeof r === 'string') {
    resolve(r)
  } else {
    resolve(`Script ${script} was executed successfully`)
  }
}

function callRemoteService(call, useRp, catchExceptions, remoteTimeout, req, resolve, reject) {
  if (useRp) {
    rp.get({
      uri: url.parse(call),
      json: true,
      timeout: remoteTimeout
    }).then(function (body) {
      resolve(body)
    }).catch(function (err) {
      if (catchExceptions) {
        resolve(err)
      } else {
        reject(err)
      }
    })
  } else {
    var headers = {
      'Content-Type': 'application/json'
    }
    // Turn the node into a proxy / api gateway if there is no agent installed
    if (config.agent !== 'yes') {
      headers = req.headers
    }
    var opts = Object.assign(url.parse(call), {
      headers: headers
    })
    const r = http.get(opts, function (res, req) {
      const body = []
      res.on('data', (chunk) => body.push(chunk))
      res.on('end', () => resolve(body.join('')))
    }).on('error', function (err) {
      if (catchExceptions) {
        resolve(err)
      } else {
        reject(err)
      }
    })
    r.setTimeout(remoteTimeout, function () {
      reject({ code: 500, message: 'Read timed out' })
    })
  }
}

function processCall(call, req) {
  return new Promise(function (resolve, reject) {
    console.log(call)
    var remoteTimeout = 1073741824

    var catchExceptions = true

    // If call is an array, select one element as call
    if (Array.isArray(call)) {
      call = call[Math.floor(Math.random() * call.length)]
    }
    // If call is an object, check for probability
    if (typeof call === 'object') {
      if (call.hasOwnProperty('probability') && call.probability <= Math.random()) {
        resolve(`${call.call} was not probable`)
        return
      }
      if (call.hasOwnProperty('schedule') && !cronmatch.match(call.schedule, new Date())) {
        resolve(`${call.call} was not scheduled`)
        return
      }
      if (call.hasOwnProperty('remoteTimeout')) {
        remoteTimeout = call.remoteTimeout
      }
      if (call.hasOwnProperty('catchExceptions')) {
        catchExceptions = call.catchExceptions
      }
      if (call.hasOwnProperty('call') && call.call === 'data') {
        return processData(resolve, reject, req, call)
      }
      call = call.call
    }
    if (call.startsWith('error')) {
      const [_, code, message] = call.split(',')
      reject({ code, message })
    } else if (call.startsWith('sleep')) {
      const [_, timeout] = call.split(',')
      setTimeout(function () {
        resolve(`Slept for ${timeout}`)
      }, timeout)
    } else if (call.startsWith('slow')) {
      const [_, timeout] = call.split(',')
      resolve(buildResponse(timeout))
    } else if (call.startsWith('http://')) {
      callRemoteService(call, useRp, catchExceptions, remoteTimeout, req, resolve, reject)
    } else if (call.startsWith('image')) {
      const [_, src] = call.split(',')
      resolve(`<img src='${src}' />`)
    } else if (call.startsWith('script')) {
      const [_, src] = call.split(',')
      resolve(`<script src='${src}?output=javascript'></script>`)
    } else if (call.startsWith('ajax')) {
      const [_, src] = call.split(',')
      resolve(`<script>var o = new XMLHttpRequest();o.open('GET', '${src}');o.send();</script>`)
    } else if (call.startsWith('cache')) {
      const [_, timeout] = call.split(',')
      const txn = appdynamics.getTransaction(req)
      resolve(loadFromCache(timeout, txn))
    } else if (call.startsWith('log')) {
      const logging = call.split(',')
      if (logging.length > 2) {
        resolve(logMessage(logging[1], logging[2]))
      } else {
        resolve(logMessage('info', logging[1]))
      }
    } else if (call.startsWith('code')) {
      const [_, script] = call.split(',')
      executeCustomScript(script, req, resolve, reject)
    } else {
      // No other methods are currently implemented
      resolve(`${call} is not supported`)
    }
  })
}

async function processRequest(req, res, params) {
  const path = url.parse(req.url).pathname

  var txn = appdynamics.getTransaction(req)

  if (txn) {
    var signularityHeader = appdynamics.parseCorrelationInfo(req).headers.singularityheader

    if (typeof signularityHeader !== 'undefined') {
      const sh = new url.URLSearchParams(signularityHeader.replace(/\*/g, '&'))
      logger.addContext('AD.requestGUID', 'AD_REQUEST_GUID[' + sh.get('guid') + ']')
    }

    if (params.unique_session_id) {
      txn.addSnapshotData('uniqueSessionId', req.query.unique_session_id)
      txn.addAnalyticsData('uniqueSessionId', req.query.unique_session_id)
    }

    if (params.hasOwnProperty('analytics') && typeof params.analytics === 'object') {
      Object.keys(params.analytics).forEach(function (key) {
        logger.debug('Adding analytics data: ', key, params.analytics[key])
        txn.addAnalyticsData(key, params.analytics[key])
        txn.addSnapshotData(key, params.analytics[key])
      })
    }
  }

  if (endpoints.hasOwnProperty(path)) {
    try {
      const results = []
      for (let i = 0; i < endpoints[path].length; i++) {
        const call = endpoints[path][i]
        results.push(await processCall(call, req))
      }
      var contype = req.headers['content-type']

      if (req.query.output && req.query.output === 'javascript') {
        res.send(results)
      } else if ((!contype || contype.indexOf('application/json') !== 0) && withEum) {
        res.send(`<!doctype html><html lang="en"><head><title>${config.name}</title><script>window['adrum-start-time'] = new Date().getTime();window['adrum-config'] = ${JSON.stringify(eumConfig)}</script><script src='//cdn.appdynamics.com/adrum/adrum-latest.js'></script><body>${JSON.stringify(results)}`)
      } else {
        res.send(results)
      }
    } catch (reason) {
      logger.error(reason.message)
      res.status(typeof reason.code === 'number' ? reason.code : 500).send(reason.message)
    }
  } else {
    res.status(404).send('404')
  }
}

app.get('/**', function (req, res) {
  processRequest(req, res, req.query)
})

app.post('/**', function (req, res) {
  processRequest(req, res, req.body)
})

var server = app.listen(port, () => console.log(
  `Running ${config.name} (type: ${config.type}) on port ${port} with${config.agent === 'yes'
  ? ` agent, reporting to ${apm.controller}`
  : 'out agent'}`))

if (config.hasOwnProperty('options')) {
  server.on('connection', (socket) => {
    if (config.options.hasOwnProperty('connectionDelay')) {
      sleep.msleep(config.options.connectionDelay)
    }
    if (config.options.hasOwnProperty('lossRate') && parseFloat(config.options.lossRate) >= Math.random()) {
      socket.end()
      throw new Error('An error occurred')
    }
  })
}
