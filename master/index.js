const yaml = require('js-yaml');
const fs = require('fs');
const process = require('process')
const {spawn} = require('child_process')
const url = require('url');
const shellescape = require('shell-escape')

const imagePrefix = process.argv[3]
const dockerNetwork = process.argv[4]
const containerPrefix = process.argv[5]

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
  const {apm, services, loaders} = config

  const controller = url.parse(apm.controller)

  if (typeof services !== 'object') {
    console.log('Could not read services list!')
    process.exit()
  }

  Object.keys(services).forEach(function(name) {
    const service = {
      ...services[name],
      name: name
    }

    if(!service.disabled) {
      const dockerImage = imagePrefix + '/' + service.type

      console.log('==== Starting ' + name)

      var cmd = ['docker', 'run', '-e', `APP_CONFIG=${JSON.stringify(service)}`,
                                  '-e', `APM_CONFIG=${JSON.stringify(apm)}`,
                                  '-e', `WITH_AGENT=${service.agent === 'yes'?1:0}`,
                                  '--network', dockerNetwork,
                                  '--name', `${containerPrefix}-${name}`,
                                  '--network-alias=' + name,
                                  '--log-opt', 'labels=container-type,service-type,service-name',
                                  '--label', 'container-type=service',
                                  '--label', `service-name=${name}`,
                                  '--label', `service-type=${service.type}`,
                                  '--label', `with-agent=${service.agent === 'yes'?'yes':'no'}`,
                                  '--rm'
                ]
      if(Array.isArray(service.aliases)) {
        service.aliases.forEach(function(alias) {
          cmd.push('--network-alias=' + alias)
        })
      }

      if(service.hasOwnProperty('labels') && typeof service.labels === 'object') {
        Object.keys(service.labels).forEach(function(label) {
          cmd.push('--label', `${label}=${service.labels[label]}`)
        })
      }

      if(service.agent === 'yes' && service.type === 'java') {
          cmd.push('-e', `APPDYNAMICS_CONTROLLER_HOST_NAME=${controller.hostname}`)
          cmd.push('-e', `APPDYNAMICS_CONTROLLER_PORT=${controller.port}`)
          cmd.push('-e', `APPDYNAMICS_CONTROLLER_SSL_ENABLED=${controller.protocol.startsWith('https')}`)
          cmd.push('-e', `APPDYNAMICS_AGENT_APPLICATION_NAME=${apm.applicationName}`)
          cmd.push('-e', `APPDYNAMICS_AGENT_ACCOUNT_NAME=${apm.accountName}`)
          cmd.push('-e', `APPDYNAMICS_AGENT_ACCOUNT_ACCESS_KEY=${apm.accountAccessKey}`)
          cmd.push('-e', `APPDYNAMICS_NETVIZ_AGENT_HOST=192.168.144.6`)
          cmd.push('-e', `APPDYNAMICS_NETVIZ_AGENT_PORT=3892`)
          cmd.push('-e', `APPDYNAMICS_AGENT_TIER_NAME=${name}`)
          cmd.push('-e', `APPDYNAMICS_AGENT_NODE_NAME=${name}`)
      }

      if(service.type === 'mysql') {
        cmd.push('-e', 'MYSQL_ROOT_PASSWORD=root')
      }

      if(apm.eventsService && apm.globalAccountName) {
        cmd.push('-e', `WITH_ANALYTICS=1`)
      }

      if(typeof service.port === 'number') {
          cmd.push('-p', `${service.port}:80`)
          cmd.push('--label', `service-port=${service.port}`)
      }

      cmd.push(dockerImage)

      const child = spawn(shellescape(cmd), {
        stdio: 'inherit',
        shell: true
      })

      containers.push(`${containerPrefix}-${name}`)
    }
  })

  Object.keys(loaders).forEach(function(name) {
    const loader = {
      ...loaders[name],
      name: name
    }

    if(loader.disabled) {
      return
    }

    if(typeof loader.count !== 'number') {
      loader.count = 1
    }

    if(typeof loader.wait !== 'number') {
      loader.wait = 0
    }

    for(var i = 0; i < loader.count; i++) {

      const containerName = `${containerPrefix}-${name}-${i}`

      const dockerImage = imagePrefix + '/' + loader.type

      var cmd = ['docker', 'run', '-e', `LOAD_CONFIG=${JSON.stringify(loader)}`,
                                  '-e', `APM_CONFIG=${JSON.stringify(apm)}`,
                                  '--network', dockerNetwork,
                                  '--name', containerName,
                                  `--network-alias=${name}+${i}`,
                                  '--log-opt', 'labels=apm-game-type,loader-type',
                                  '--label', 'container-type=loader',
                                  '--label', `loader-type=${loader.type}`,
                                  '--rm'
                ]

      if(loader.type === 'curl') {
        cmd.push('-e', `URLS=${loader.urls.join(" ")}`)
        cmd.push('-e', `WAIT=${loader.wait}`)
      }

      cmd.push(dockerImage)

      const child = spawn(shellescape(cmd), {
                  stdio: 'inherit',
                  shell: true
      })

      containers.push(containerName)
    }
  })

  var machineAgentName = `${containerPrefix}-machine-agent`
  var machineAgentCmd = ['docker', 'run', '-e', `APPDYNAMICS_CONTROLLER_HOST_NAME=${controller.hostname}`,
                                          '-e', `APPDYNAMICS_CONTROLLER_PORT=${controller.port}`,
                                          '-e', `APPDYNAMICS_CONTROLLER_SSL_ENABLED=${controller.protocol.startsWith('https')}`,
                                          '-e', `APPDYNAMICS_AGENT_ACCOUNT_NAME=${apm.accountName}`,
                                          '-e', `APPDYNAMICS_AGENT_ACCOUNT_ACCESS_KEY=${apm.accountAccessKey}`,
                                          '-e', `APPDYNAMICS_ANALYTICS_AGENT_NAME=${imagePrefix}-${containerPrefix}-analytics-agent`,
                                          '-e', 'MACHINE_AGENT_PROPERTIES=-Dappdynamics.sim.enabled=true -Dappdynamics.docker.enabled=true',
                                          '-e', `APPDYNAMICS_MACHINE_HIERARCHY_PATH=${imagePrefix}|${containerPrefix}|machine-agent`,
                                          '-v', '/:/hostroot:ro',
                                          '-v', '/var/run/docker.sock:/var/run/docker.sock',
                                          '-v', '/var/lib/docker/containers/:/var/lib/docker/containers/',
                                          '--log-opt', 'labels=container-type',
                                          '--label', 'container-type=machine-agent',
                                          '--rm',
                                          '--network', dockerNetwork,
                                          '--name', machineAgentName,
                                          '--network-alias=machine-agent'
                                          ]
  if(apm.eventsService && apm.globalAccountName) {
    machineAgentCmd.push('-e', `WITH_ANALYTICS=1`)
    machineAgentCmd.push('-e', `APPDYNAMICS_ANALYTICS_CONTROLLER=${apm.controller}`)
    machineAgentCmd.push('-e', `APPDYNAMICS_ANALYTICS_EVENTS_SERVICE=${apm.eventsService}`)
    machineAgentCmd.push('-e', `APPDYNAMICS_ANALYTICS_ACCOUNT_NAME=${apm.accountName}`)
    machineAgentCmd.push('-e', `APPDYNAMICS_ANALYTICS_GLOBAL_ACCOUNT_NAME=${apm.globalAccountName}`)
    machineAgentCmd.push('-e', `APPDYNAMICS_ANALYTICS_ACCESS_KEY=${apm.accountAccessKey}`)
  }
  machineAgentCmd.push(imagePrefix + '/machine')

  spawn(shellescape(machineAgentCmd), {
                stdio: 'inherit',
                shell: true
  })
  containers.push(machineAgentName)

  var netvizAgentName = `${containerPrefix}-netviz-agent`
  // docker run -d --network=host --cap-add=NET_ADMIN --cap-add=NET_RAW
  var netvizAgentCmd = ['docker', 'run', '--rm',
                                         '--network=host',
                                         '--cap-add=NET_ADMIN',
                                         '--cap-add=NET_RAW',
                                         '--name', netvizAgentName,
                                         imagePrefix + '/netviz']

  spawn(shellescape(netvizAgentCmd), {
               stdio: 'inherit',
               shell: true
  })

  containers.push(netvizAgentName)


} catch (e) {
  console.log(e);
}
