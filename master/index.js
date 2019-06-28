const yaml = require('js-yaml');
const fs = require('fs');
const process = require('process')
const {spawn} = require('child_process')
const url = require('url');
const shellescape = require('shell-escape')

const imagePrefix = process.argv[3]
const dockerNetwork = process.argv[4]
const dockerLogsVolume = process.argv[5]
const containerPrefix = process.argv[6]

var localCustomCodeDir = process.argv[7]

var gatewayIP = '127.0.0.1'

try {
  var dockerNetworkDetails = JSON.parse(process.argv[8])
  gatewayIP = dockerNetworkDetails[0].IPAM.Config[0].Gateway
} catch(e) {
  console.log('WARNING: No network configuration provided, could not identify default gateway.')
}

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
  const {apm = {}, services = {}, loaders = {}, chaos = {}, liveDebug = {}} = config

  global = Object.assign({machine: true, netviz: true, services: true, loaders: true, dbmon: 'maybe', chaos: true}, config.global)

  const controller = url.parse(apm.controller)

  if (typeof services !== 'object') {
    console.log('Could not read services list!')
    process.exit()
  }

  if(global.services) {
    Object.keys(services).forEach(function(name) {
      const service = {
        ...services[name],
        name: name
      }

      if(!service.disabled) {
        const dockerImage = service.type === 'custom' ? service.image : imagePrefix + '/' + service.type

        global.dbmon = global.dbmon === 'maybe' ? (service.type === 'mysql') : global.dbmon

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
                                    '-v', `${dockerLogsVolume}:/logs`,
                                    '-v', `${localCustomCodeDir}:/scripts`,
                                    '-e', 'CUSTOM_CODE_DIR=/scripts',
                                    '-e', `LOG_DIRECTORY=/logs/${service.type}/${name}/`,
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
            cmd.push('-e', `APPDYNAMICS_NETVIZ_AGENT_HOST=${gatewayIP}`)
            cmd.push('-e', `APPDYNAMICS_NETVIZ_AGENT_PORT=3892`)
            cmd.push('-e', `APPDYNAMICS_AGENT_TIER_NAME=${name}`)
            cmd.push('-e', `APPDYNAMICS_AGENT_NODE_NAME=${name}`)

            if(typeof liveDebug === 'object' && typeof liveDebug.token === 'string' && liveDebug.token.length === 64) {
              cmd.push('-e', `ROOKOUT_TOKEN=${liveDebug.token}`)
              cmd.push('-e', `WITH_LIVEDEBUG=1`)
            } else {
              cmd.push('-e', `WITH_LIVEDEBUG=0`)
            }
        }

        if(service.type === 'mysql') {
          cmd.push('-e', 'MYSQL_ROOT_PASSWORD=root')
        }

        if(apm.eventsService && apm.globalAccountName) {
          cmd.push('-e', `WITH_ANALYTICS=1`)
        } else {
          cmd.push('-e', `WITH_ANALYTICS=0`)
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
  } else {
    console.log('Skipping services.')
    global.dbmon = global.dbmon === 'maybe' ? false : global.dbmon
  }

  if(global.loaders) {
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
                                    '-v', `${dockerLogsVolume}:/logs`,
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
  } else {
    console.log('Skipping loaders.')
  }

  if(global.machine) {
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
                                            '-v', `${dockerLogsVolume}:/logs`,
                                            '--log-opt', 'labels=container-type',
                                            '--label', 'container-type=machine-agent',
                                            '--rm',
                                            '--network', dockerNetwork,
                                            '--name', machineAgentName,
                                            '--network-alias=machine-agent',
                                            '--network-alias=analytics'
                                            ]
    if(apm.eventsService && apm.globalAccountName) {
      machineAgentCmd.push('-e', `WITH_ANALYTICS=1`)
      machineAgentCmd.push('-e', `APPDYNAMICS_ANALYTICS_CONTROLLER=${apm.controller}`)
      machineAgentCmd.push('-e', `APPDYNAMICS_ANALYTICS_EVENTS_SERVICE=${apm.eventsService}`)
      machineAgentCmd.push('-e', `APPDYNAMICS_ANALYTICS_ACCOUNT_NAME=${apm.accountName}`)
      machineAgentCmd.push('-e', `APPDYNAMICS_ANALYTICS_GLOBAL_ACCOUNT_NAME=${apm.globalAccountName}`)
      machineAgentCmd.push('-e', `APPDYNAMICS_ANALYTICS_ACCESS_KEY=${apm.accountAccessKey}`)
    } else {
      machineAgentCmd.push('-e', `WITH_ANALYTICS=0`)
    }
    machineAgentCmd.push(imagePrefix + '/machine')

    spawn(shellescape(machineAgentCmd), {
                  stdio: 'inherit',
                  shell: true
    })
    containers.push(machineAgentName)
  } else {
    console.log('Skipping machine agent.')
  }

  if(global.netviz) {
    var netvizAgentName = `${containerPrefix}-netviz-agent`
    var netvizAgentCmd = ['docker', 'run', '--rm',
                                           '--network=host',
                                           '--cap-add=NET_ADMIN',
                                           '--cap-add=NET_RAW',
                                           '--name', netvizAgentName,
                                           '-v', `${dockerLogsVolume}:/logs`,
                                           imagePrefix + '/netviz']

    spawn(shellescape(netvizAgentCmd), {
                 stdio: 'inherit',
                 shell: true
    })
    containers.push(netvizAgentName)
  } else {
    console.log('Skipping network visibility agent.')
  }

  if(global.dbmon) {
    var databaseAgentName = `${containerPrefix}-database-agent`
    var databaseAgentCmd = ['docker', 'run', '-e', `APPDYNAMICS_CONTROLLER_HOST_NAME=${controller.hostname}`,
                                            '-e', `APPDYNAMICS_CONTROLLER_PORT=${controller.port}`,
                                            '-e', `APPDYNAMICS_CONTROLLER_SSL_ENABLED=${controller.protocol.startsWith('https')}`,
                                            '-e', `APPDYNAMICS_AGENT_ACCOUNT_NAME=${apm.accountName}`,
                                            '-e', `APPDYNAMICS_AGENT_ACCOUNT_ACCESS_KEY=${apm.accountAccessKey}`,
                                            '-e', `APPDYNAMICS_DATABASE_AGENT_NAME=${imagePrefix}-${containerPrefix}-database-agent`,
                                            '--label', 'container-type=database-agent',
                                            '--rm',
                                            '--network', dockerNetwork,
                                            '--name', databaseAgentName,
                                            '--network-alias=databases-agent'
                                            ]

    databaseAgentCmd.push(imagePrefix + '/dbmon')

    spawn(shellescape(databaseAgentCmd), {
                  stdio: 'inherit',
                  shell: true
    })
    containers.push(databaseAgentName)
  } else {
    console.log('Skipping database agent.')
  }

  if(global.chaos) {
    Object.keys(chaos).forEach(function(name) {
      const generator = {
        ...chaos[name],
        name: name
      }

      if(generator.disabled) {
        return
      }

      const generatorName = `${containerPrefix}-chaos-${generator.name}`

      // generator.type currently only provides one type (pumba)
      const chaosImg = 'gaiaadm/pumba'

      const chaosSubCmd = generator.command.split('-')

      let chaosCmd = ['docker', 'run', '-v', '/var/run/docker.sock:/var/run/docker.sock',
                                            '--rm',
                                            '--name', generatorName,
                                            chaosImg,
                                            '-l', 'info',
                                            '-i', generator.interval,
                                            '--random',
                                        ]
      switch(chaosSubCmd[0]) {
        case 'pause':
          chaosCmd.push('pause', '--duration', generator.duration)
          break;
        case 'netem':
          chaosCmd.push('netem', '--interface', 'eth0', '--duration', generator.duration, chaosSubCmd[1])
          switch(chaosSubCmd[1]) {
            case 'loss':
              chaosCmd.push('-p', generator.probability)
            break;
            case 'delay':
              chaosCmd.push('-t', generator.time)
            break;
          }
          break;
      }

      let target = (Array.isArray(generator.target) ? generator.target : [generator.target]).map(t => `${containerPrefix}-${t}`)

      chaosCmd = chaosCmd.concat(target)

      spawn(shellescape(chaosCmd), {
                   stdio: 'inherit',
                   shell: true
      })
      containers.push(generatorName)
    })
  } else {
    console.log('Skipping chaos generators.')
  }

} catch (e) {
  console.log(e);
}
