const yaml = require('js-yaml');
const fs = require('fs');
const process = require('process')

try {
    const config = yaml.safeLoad(fs.readFileSync(process.argv[2], 'utf8'));
    const {global, services, transactions} = config

    if(typeof services !== 'object') {
      console.log('Could not read services list!')
      process.exit()
    }

    Object.keys(services).forEach(function (service) {
      const properties = services[service]
      console.log(`Run agent of type ${properties.type}, agent: ${properties.agent}`)
    })

} catch (e) {
    console.log(e);
}
