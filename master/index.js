const yaml = require('js-yaml')
const fs = require('fs')
const process = require('process')
const { spawn } = require('child_process')
const url = require('url')
const shellescape = require('shell-escape')
const chalk = require('chalk')
const merge = require('lodash.merge')

const imagePrefix = process.argv[3]
const dockerNetwork = process.argv[4]
const dockerLogsVolume = process.argv[5]
const dockerPhpProxyVolume = process.argv[11]
const containerPrefix = process.argv[6]

var localCustomCodeDir = process.argv[7]

const verbosity = parseInt(process.argv[10])

var gatewayIP = '127.0.0.1'

try {
  var dockerNetworkDetails = JSON.parse(process.argv[8])
  gatewayIP = dockerNetworkDetails[0].IPAM.Config[0].Gateway
} catch (e) {
  console.log('WARNING: No network configuration provided, could not identify default gateway.')
}

var containers = []

function runCmd(cmd, msg = false) {
  console.log(msg || `Running: ${cmd}`)
  return spawn(cmd, {
    stdio: verbosity > 0 ? 'inherit' : 'ignore',
    shell: true
  })
}

function terminate() {
  console.log(chalk.blue('Terminating ...'))
  containers.forEach(function (container) {
    runCmd(`docker stop ${container}`, chalk.blue(`Stopping container ${container} ...`))
  })
}

process.on('SIGINT', function () {
  terminate()
})

var defaultConfig = {}

try {
  defaultConfig = yaml.safeLoad(fs.readFileSync(process.argv[9], 'utf8'))
} catch (err) {
  if (err.code !== 'ENOENT') {
    console.error(chalk.red(`Could not read defaults.yml, starting without it. Error was ${err.message}`))
  }
}

try {
  console.log(chalk.green(`Loading config from ${process.argv[2]}`))
  const config = merge(defaultConfig, yaml.safeLoad(fs.readFileSync(process.argv[2], 'utf8')))

  const { apm = {}, services = {}, loaders = {}, chaos = {}, liveDebug = {} } = config

  const global = Object.assign({ machine: true, netviz: true, services: true, loaders: true, dbmon: 'maybe', chaos: true, phpproxy: 0 }, config.global)

  if (typeof apm.controller !== 'string') {
    console.error(chalk.red('Could not read controller properties!'))
    process.exit()
  }

  if (typeof services !== 'object') {
    console.error(chalk.red('Could not read services list!'))
    process.exit()
  }

  if (!(apm.controller.startsWith('https://') || apm.controller.startsWith('http://'))) {
    console.error(chalk.red(`Please provide a full URL, starting with a protocol (http:// or https://) for the controller: ${apm.controller}`))
    process.exit()
  }
  const controller = url.parse(apm.controller)

  if (global.services) {
    Object.keys(services).forEach(function (name) {
      const service = services[name]

      if (!service.disabled) {
        const serviceCount = typeof service.count === 'number' ? service.count : 1
        for (let nodeid = 0; nodeid < serviceCount; nodeid++) {
          if (service.type === 'dotnet') {
            service.type = 'dotnetcore'
          }

          const dockerImage = service.type === 'custom' ? service.image : imagePrefix + '/' + service.type

          global.dbmon = global.dbmon === 'maybe' ? (service.type === 'mysql') : global.dbmon

          var cmd = ['docker', 'run',
            // Node.JS and PHP agent use the service.name for tier/node naming
            '-e', `APP_CONFIG=${JSON.stringify(Object.assign(service, { name, nodeid }))}`,
            '-e', `APM_CONFIG=${JSON.stringify(apm)}`,
            '-e', `WITH_AGENT=${service.agent === 'yes' ? 1 : 0}`,
            '--network', dockerNetwork,
            '--name', `${containerPrefix}-${name}-${nodeid}`,
            '--network-alias=' + name,
            `--network-alias=${name}-${nodeid}`,
            '--log-opt', 'labels=container-type,service-type,service-name',
            '--label', 'container-type=service',
            '--label', `service-name=${name}`,
            '--label', `service-id=${name}-${nodeid}`,
            '--label', `service-type=${service.type}`,
            '-v', `${dockerLogsVolume}:/logs`,
            '-v', `${localCustomCodeDir}:/scripts`,
            '-e', 'CUSTOM_CODE_DIR=/scripts',
            '-e', `LOG_DIRECTORY=/logs/${service.type}/${name}-${nodeid}/`,
            '--label', `with-agent=${service.agent === 'yes' ? 'yes' : 'no'}`,
            '--rm'
          ]
          if (Array.isArray(service.aliases)) {
            service.aliases.forEach(function (alias) {
              cmd.push('--network-alias=' + alias)
            })
          }

          if (service.labels && typeof service.labels === 'object') {
            Object.keys(service.labels).forEach(function (label) {
              cmd.push('--label', `${label}=${service.labels[label]}`)
            })
          }

          if (service.agent === 'yes' && service.type === 'php') {
            cmd.push('-v', `${dockerPhpProxyVolume}:/phpproxy`)
            global.phpproxy += 1
          }

          if (service.agent === 'yes' && service.type === 'java') {
            cmd.push('-e', `APPDYNAMICS_CONTROLLER_HOST_NAME=${controller.hostname}`)
            cmd.push('-e', `APPDYNAMICS_CONTROLLER_PORT=${controller.port}`)
            cmd.push('-e', `APPDYNAMICS_CONTROLLER_SSL_ENABLED=${controller.protocol.startsWith('https')}`)
            cmd.push('-e', `APPDYNAMICS_AGENT_APPLICATION_NAME=${apm.applicationName}`)
            cmd.push('-e', `APPDYNAMICS_AGENT_ACCOUNT_NAME=${apm.accountName}`)
            cmd.push('-e', `APPDYNAMICS_AGENT_ACCOUNT_ACCESS_KEY=${apm.accountAccessKey}`)
            cmd.push('-e', `APPDYNAMICS_NETVIZ_AGENT_HOST=${gatewayIP}`)
            cmd.push('-e', 'APPDYNAMICS_NETVIZ_AGENT_PORT=3892')
            cmd.push('-e', `APPDYNAMICS_AGENT_TIER_NAME=${name}`)
            cmd.push('-e', `APPDYNAMICS_AGENT_NODE_NAME=${name}-${nodeid}`)

            if (typeof liveDebug === 'object' && typeof liveDebug.token === 'string' && liveDebug.token.length === 64) {
              cmd.push('-e', `ROOKOUT_TOKEN=${liveDebug.token}`)
              cmd.push('-e', 'WITH_LIVEDEBUG=1')
            } else {
              cmd.push('-e', 'WITH_LIVEDEBUG=0')
            }
          }

          if (service.agent === 'yes' && service.type === 'dotnetcore') {
            cmd.push('-e', `APPDYNAMICS_CONTROLLER_HOST_NAME=${controller.hostname}`)
            cmd.push('-e', `APPDYNAMICS_CONTROLLER_PORT=${controller.port}`)
            cmd.push('-e', `APPDYNAMICS_CONTROLLER_SSL_ENABLED=${controller.protocol.startsWith('https')}`)
            cmd.push('-e', `APPDYNAMICS_AGENT_APPLICATION_NAME=${apm.applicationName}`)
            cmd.push('-e', `APPDYNAMICS_AGENT_ACCOUNT_NAME=${apm.accountName}`)
            cmd.push('-e', `APPDYNAMICS_AGENT_ACCOUNT_ACCESS_KEY=${apm.accountAccessKey}`)
            cmd.push('-e', `APPDYNAMICS_NETVIZ_AGENT_HOST=${gatewayIP}`)
            cmd.push('-e', 'APPDYNAMICS_NETVIZ_AGENT_PORT=3892')
            cmd.push('-e', `APPDYNAMICS_AGENT_TIER_NAME=${name}`)
            cmd.push('-e', 'APPDYNAMICS_AGENT_REUSE_NODE_NAME=true')
            cmd.push('-e', `APPDYNAMICS_AGENT_REUSE_NODE_NAME_PREFIX=${name}`)
            cmd.push('-e', 'CORECLR_PROFILER={57e1aa68-2229-41aa-9931-a6e93bbc64d8}')
            cmd.push('-e', 'CORECLR_ENABLE_PROFILING=1')
            cmd.push('-e', 'CORECLR_PROFILER_PATH=/opt/appdynamics/libappdprofiler.so')
          }

          if (service.type === 'mysql') {
            cmd.push('-e', 'MYSQL_ROOT_PASSWORD=root')
          }

          if (apm.eventsService && apm.globalAccountName) {
            cmd.push('-e', 'WITH_ANALYTICS=1')
          } else {
            cmd.push('-e', 'WITH_ANALYTICS=0')
          }

          // Port is only bound to the first instance, TODO: Find a solution to bind further ports.
          if (typeof service.port === 'number' && nodeid === 0) {
            cmd.push('-p', `${service.port}:80`)
            cmd.push('--label', `service-port=${service.port}`)
          }

          cmd.push(dockerImage)

          runCmd(shellescape(cmd), chalk.green(`[service] starting ${name}-${nodeid}`))

          containers.push(`${containerPrefix}-${name}-${nodeid}`)
        }
      }
    })
  } else {
    console.log(chalk.yellow('Skipping services.'))
    global.dbmon = global.dbmon === 'maybe' ? false : global.dbmon
  }

  if (global.loaders) {
    Object.keys(loaders).forEach(function (name) {
      const loader = Object.assign(loaders[name], { name })

      if (loader.disabled) {
        return
      }

      if (typeof loader.count !== 'number') {
        loader.count = 1
      }

      if (typeof loader.wait !== 'number') {
        loader.wait = 0
      }

      for (var i = 0; i < loader.count; i++) {
        const containerName = `${containerPrefix}-${name}-${i}`

        const dockerImage = imagePrefix + '/' + loader.type

        var cmd = ['docker', 'run',
          '-e', `LOAD_CONFIG=${JSON.stringify(loader)}`,
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

        if (loader.type === 'curl') {
          cmd.push('-e', `URLS=${loader.urls.join(' ')}`)
          cmd.push('-e', `WAIT=${loader.wait}`)
        }

        cmd.push(dockerImage)

        runCmd(shellescape(cmd), chalk.green(`[loader] starting ${name}-${loader.count}`))

        containers.push(containerName)
      }
    })
  } else {
    console.log(chalk.yellow('Skipping loaders.'))
  }

  if (global.machine) {
    var machineAgentName = `${containerPrefix}-machine-agent`
    var machineAgentCmd = ['docker', 'run',
      '-e', `APPDYNAMICS_CONTROLLER_HOST_NAME=${controller.hostname}`,
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
    if (apm.eventsService && apm.globalAccountName) {
      machineAgentCmd.push('-e', 'WITH_ANALYTICS=1')
      machineAgentCmd.push('-e', `APPDYNAMICS_ANALYTICS_CONTROLLER=${apm.controller}`)
      machineAgentCmd.push('-e', `APPDYNAMICS_ANALYTICS_EVENTS_SERVICE=${apm.eventsService}`)
      machineAgentCmd.push('-e', `APPDYNAMICS_ANALYTICS_ACCOUNT_NAME=${apm.accountName}`)
      machineAgentCmd.push('-e', `APPDYNAMICS_ANALYTICS_GLOBAL_ACCOUNT_NAME=${apm.globalAccountName}`)
      machineAgentCmd.push('-e', `APPDYNAMICS_ANALYTICS_ACCESS_KEY=${apm.accountAccessKey}`)
    } else {
      machineAgentCmd.push('-e', 'WITH_ANALYTICS=0')
    }
    machineAgentCmd.push(imagePrefix + '/machine')

    runCmd(shellescape(machineAgentCmd), chalk.green('[infrastructure] starting machine agent'))
    containers.push(machineAgentName)
  } else {
    console.log(chalk.yellow('[infrastructure] skipping machine agent.'))
  }

  if (global.netviz) {
    var netvizAgentName = `${containerPrefix}-netviz-agent`
    var netvizAgentCmd = ['docker', 'run',
      '--rm',
      '--network=host',
      '--cap-add=NET_ADMIN',
      '--cap-add=NET_RAW',
      '--name', netvizAgentName,
      '-v', `${dockerLogsVolume}:/logs`,
      imagePrefix + '/netviz'
    ]

    runCmd(shellescape(netvizAgentCmd), chalk.green('[infrastructure] starting network visibility agent'))
    containers.push(netvizAgentName)
  } else {
    console.log(chalk.yellow('[infrastructure] skipping network visibility agent.'))
  }

  if (global.dbmon) {
    var databaseAgentName = `${containerPrefix}-database-agent`
    var databaseAgentCmd = ['docker', 'run',
      '-e', `APPDYNAMICS_CONTROLLER_HOST_NAME=${controller.hostname}`,
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

    runCmd(shellescape(databaseAgentCmd), chalk.green('[infrastructure] starting database agent'))
    containers.push(databaseAgentName)
  } else {
    console.log(chalk.yellow('[infrastructure] skipping database agent.'))
  }

  if (global.phpproxy > 0) {
    const phpProxyMaxHeapSize = 300 * Math.ceil(global.phpproxy / 10)
    const phpProxyMinHeapSize = 50 * Math.ceil(global.phpproxy / 10)
    const phpProxyMaxPermSize = 120 * Math.ceil(global.phpproxy / 10)

    var phpProxyName = `${containerPrefix}-php-proxy`
    var phpProxyCmd = ['docker', 'run',
      '-e', 'APPDYNAMICS_PROXY_CONTROL_DIR=/phpproxy',
      '-e', 'APPDYNAMICS_PROXY_COMMUNICATION_DIR=/phpproxy',
      '-e', 'APPDYNAMICS_PROXY_LOG_DIR=/phpproxy',
      '-e', `APPDYNAMICS_PROXY_MAX_HEAP_SIZE=${phpProxyMaxHeapSize}m`,
      '-e', `APPDYNAMICS_PROXY_MIN_HEAP_SIZE=${phpProxyMinHeapSize}m`,
      '-e', `APPDYNAMICS_PROXY_MAX_PERM_SIZE=${phpProxyMaxPermSize}m`,
      '--label', 'container-type=php-proxy',
      '--rm',
      '--network', dockerNetwork,
      '--name', phpProxyName,
      '-v', `${dockerPhpProxyVolume}:/phpproxy`,
      '--network-alias=php-proxy'
    ]

    phpProxyCmd.push(imagePrefix + '/phpproxy')

    runCmd(shellescape(phpProxyCmd), chalk.green('[infrastructure] starting php proxy'))
    containers.push(phpProxyName)
  } else {
    console.log(chalk.yellow('[infrastructure] skipping php proxy.'))
  }

  if (global.chaos) {
    Object.keys(chaos).forEach(function (name) {
      const generator = Object.assign(chaos[name], { name })

      if (generator.disabled) {
        return
      }

      const generatorName = `${containerPrefix}-chaos-${generator.name}`

      // generator.type currently only provides one type (pumba)
      const chaosImg = 'gaiaadm/pumba'

      const chaosSubCmd = generator.command.split('-')

      let chaosCmd = ['docker', 'run',
        '-v', '/var/run/docker.sock:/var/run/docker.sock',
        '--rm',
        '--name', generatorName,
        chaosImg,
        '-l', 'info',
        '-i', generator.interval,
        '--random'
      ]
      switch (chaosSubCmd[0]) {
        case 'pause':
          chaosCmd.push('pause', '--duration', generator.duration)
          break
        case 'netem':
          chaosCmd.push('netem', '--interface', 'eth0', '--duration', generator.duration, chaosSubCmd[1])
          switch (chaosSubCmd[1]) {
            case 'loss':
              chaosCmd.push('-p', generator.probability)
              break
            case 'delay':
              chaosCmd.push('-t', generator.time)
              break
          }
          break
      }

      const target = (Array.isArray(generator.target) ? generator.target : [generator.target]).reduce((r, t) => {
        const count = (global.services[t] && global.services[t].count) ? global.services[t].count : 1
        for (let i = 0; i <= count; i++) {
          r.push(`${containerPrefix}-${t}-${i}`)
        }
        return r
      }, [])

      chaosCmd = chaosCmd.concat(target)

      runCmd(shellescape(chaosCmd), chalk.green(`[chaos] starting ${name}`))
      containers.push(generatorName)
    })
  } else {
    console.log(chalk.yellow('Skipping chaos generators.'))
  }

  if (verbosity < 1) {
    console.log(chalk.blue('Running in quiet mode, use docker attach to read container output'))
  }
} catch (e) {
  console.error(chalk.red(e.stack))
  terminate()
}
