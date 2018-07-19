const yaml = require('js-yaml');
const fs = require('fs');
const process = require('process')
const {spawn} = require('child_process')
const url = require('url');
const shellescape = require('shell-escape')

const dockerPrefix = process.argv[3]
const dockerNetwork = process.argv[4]

var containers = []

process.on('SIGINT', function () {
  console.log('Terminating ...')
  containers.forEach(function(container) {
    console.log(`Stopping container ${container} ...`)
    spawn(`docker stop ${container}`, {
      stdio: 'inherit',
      shell: true
    })
  })
});

try {
  const config = yaml.safeLoad(fs.readFileSync(process.argv[2], 'utf8'));
  const {apm, services} = config

  if (typeof services !== 'object') {
    console.log('Could not read services list!')
    process.exit()
  }

  var port = 3000
  Object.keys(services).forEach(function(name) {

    const service = {
      ...services[name],
      name: name
    }

    if(!service.disabled) {

      const dockerImage = dockerPrefix + service.type

      console.log('==== Starting ' + name)

      var cmd = ['docker', 'run', '-e', `APP_CONFIG=${JSON.stringify(service)}`,
                                  '-e', `APM_CONFIG=${JSON.stringify(apm)}`,
                                  '-e', `WITH_AGENT=${service.agent === 'yes'?1:0}`,
                                  '--network', dockerNetwork,
                                  '--name', name,
                                  '--rm'
                ]
      if(Array.isArray(service.aliases)) {
        service.aliases.forEach(function(alias) {
          cmd.push('--network-alias=' + alias)
        })
      }

      if(service.agent === 'yes' && service.type === 'java') {
          const controller = url.parse(apm.controller)
          cmd.push('-e', `APPDYNAMICS_CONTROLLER_HOST_NAME=${controller.hostname}`)
          cmd.push('-e', `APPDYNAMICS_CONTROLLER_HOST_PORT=${controller.port}`)
          cmd.push('-e', `APPDYNAMICS_CONTROLLER_SSL_ENABLED=${controller.protocol.startsWith('https')}`)
          cmd.push('-e', `APPDYNAMICS_AGENT_APPLICATION_NAME=${apm.applicationName}`)
          cmd.push('-e', `APPDYNAMICS_AGENT_ACCOUNT_NAME=${apm.accountName}`)
          cmd.push('-e', `APPDYNAMICS_AGENT_ACCOUNT_ACCESS_KEY=${apm.accountAccessKey}`)
          cmd.push('-e', `APPDYNAMICS_AGENT_TIER_NAME=${name}`)
          cmd.push('-e', `APPDYNAMICS_AGENT_NODE_NAME=${name}`)
      }

      if(typeof service.port === 'number') {
          cmd.push('-p')
          cmd.push(`${service.port}:80`)
      }

      cmd.push(dockerImage)

      const child = spawn(shellescape(cmd), {
        stdio: 'inherit',
        shell: true
      })

      containers.push(name)
    }
  })

} catch (e) {
  console.log(e);
}
