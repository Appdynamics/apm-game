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

      var cmd = ['echo', 'docker', 'run', '-e', `APP_CONFIG=${JSON.stringify(service)}`,
                                                        '-e', `APM_CONFIG=${JSON.stringify(apm)}`,
                                                        '--network', dockerNetwork,
                                                        '--name', name,
                                                        '--rm'
                                                        ]
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
