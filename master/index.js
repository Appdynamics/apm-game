const yaml = require('js-yaml');
const fs = require('fs');
const process = require('process')
const { spawn } = require('child_process')
const url = require('url');

console.log()

try {
    const config = yaml.safeLoad(fs.readFileSync(process.argv[2], 'utf8'));
    const {global, services, transactions} = config

    if(typeof services !== 'object') {
      console.log('Could not read services list!')
      process.exit()
    }

    var port = 3000
    Object.keys(services).forEach(function (service) {

      services[service].port = port
      services[service].host = 'localhost'

      const properties = services[service]
      const child = spawn(`node ${__dirname}/../nodes/nodejs/index.js ${properties.port}`, { shell: true })

      child.stdout.on('data', (data) => {
        console.log(`${service} stdout:\n${data}`);
      });

      port++
    })

    function buildTransaction(transactionName, transactions) {

      console.log(transactionName)

      const transactionUrl = url.parse(transactionName)

      var body = null

      if(Array.isArray(transactions[transactionName])) {
        body = transactions[transactionName].map(t => buildTransaction(t, transactions[transactionName]))
      }

      const transaction = {
        protocol: transactionUrl.protocol,
        host: transactionUrl.host,
        port: transactionUrl.port,
        path: transactionUrl.path,
        body: body
      }

      return transaction
    }

    console.log(Object.keys(transactions).map(t => buildTransaction(t, transactions)))

} catch (e) {
    console.log(e);
}
