# APM Game

Build applications with errors and let other people find them with [AppDynamics](https://www.appdynamics.com/)!

# Installation

Clone this project:

```shell
git clone git@github.com:svrnm/apm-game.git
```

Install all prerequisites:
  - [Docker](https://www.docker.com/)
  - [Node.JS](https://nodejs.org/en/)

Copy agent files into the directories for the java and PHP node:

```shell
mv <PATH>/appdynamics-php-agent-x64-linux-<VERSION>.tar.bz2 nodes/php
mv <PATH>/AppServerAgent-<VERSION>.zip nodes/java
```

**Note:** The agent for nodejs and the machine agent are installed automatically.

Setup an [AppDynamics Platform](https://docs.appdynamics.com/display/latest/AppDynamics+Platform) or use your AppDynamics SaaS controller.

# Usage

1. Configure your game using YAML. You can look into the file `config.yml` to get started. Read the **Configuration** section below to learn how you can describe your application environment.

2. Execute the `run.sh`

3. Wait for data in AppDynamics

# Configuration

Configurations for **APM Game** are given in YAML files. By default the `run.sh` looks for a file called config.yml, but you can provide another file as parameter:

```shell
./run.sh configs/myconfig.yml
```

The configuration has 3 top-level sections: **apm**, **services** and **loaders**:

```YAML
apm:
  ...
services:
  ...
loaders:
  ...
```

## APM

In the **apm** section you can provide all properties required to configure the AppDynamics agents. For the APM agents you need to configure the following:

- **controller**: The URL of your controller, e.g. `https://controller.example.com:8090`
- **accountName**: Your short account name, e.g. `customer1`
- **accountAccessKey**: The access key of your account, eg. `ffffffff-ffff-ffff-ffff-fffffffffff`
- **applicationName**: The name of the business application used by all of your agents, e.g. `apm_game`

If you want to use analytics capabilities, set the following:

- eventsService: The URL of your analytics endpoints, e.g. `http://analytics.example.com:9080
- globalAccountName: Your global/long account name, e.g. `customer1_ffffffff-ffff-ffff-ffff-ffffffffffff`

Finally, you also can setup End User Monitoring in an `eum` sub-section:

- **appKey**: The  key of your EUM app, e.g. `AD-FFF-FFF-FFF`
- **adrumExtUrlHttp**: URL to load the adrum-ext.js  from via http, e.g. `http://cdn.appdynamics.com`
- **adrumExtUrlHttps**: URL to load the adrum-ext.js  from via https, e.g. `https://cdn.appdynamics.com`
- **beaconUrlHttp**: URL for the beacons via http, e.g. `http://col.eum-appdynamics.com`
- **beaconUrlHttps**: URL for the beacons via https, e.g.`https://col.eum-appdynamics.com`

A final **apm** configuration looks like following:

```YAML
apm:
  controller: https://controller.example.com:8090
  accountName: customer1
  accountAccessKey: ffffffff-ffff-ffff-ffff-fffffffffff
  applicationName: apm_game
  eventsService: http://analytics.example.com:9080
  globalAccountName: customer1_ffffffff-ffff-ffff-ffff-ffffffffffff
  eum:
    appKey: 'AD-FFF-FFF-FFF'
    adrumExtUrlHttp: 'http://cdn.appdynamics.com'
    adrumExtUrlHttps: 'https://cdn.appdynamics.com'
    beaconUrlHttp: 'http://col.eum-appdynamics.com'
    beaconUrlHttps: 'https://col.eum-appdynamics.com'
```

## services

In this section you provide all the tiers/nodes and remote services that are contained in your business application. Each sub-section is the name of a service. This name will be used to name the docker image as well as the tier within AppDynamics. Since the services use these names also to communicate with each other the name should be a valid hostname, e.g. `frontend`, `backend-v2` or `payment-provider-1`, ...

A service can have the following properties:

- **type** (required): Define the type of this service. You can currently use the following: `java`, `nodejs`, `php` and `mysql`.
- **agent**: Set to `no` or `yes` to disable or enable the appdynamics agent.
- **port**: Set a port which will be exposed to your docker host. So if you run locally, you can access this service via `http://localhost:<port>
- **endpoints** (java, nodejs, php only): Define multiple endpoints for this service. Read below to learn how to define endpoints.
- **aliases**: Provide a list of network name aliases. This is useful for agentless services, that serve as multiple remote services, e.g. multiple payment providers.
- **disabled**: Set this to `yes` to temporarily disable the service without removing it from the configuration file.
- **databases** (mysql only): Define multiple databases, that are created on startup on this database service. Read below to learn how to define databases and tables.

Without endpoints and databases a configuration might look like the following:

```YAML
services:
  frontend:
    type: nodejs
    agent: yes
    port: 3000
    endpoints:
      ...
  backend:
    type: java
    agent: yes
    endpoints:      
      ...
  ext-payment:
    type: nodejs
    agent: no
    aliases: [ext-payment-1, ext-payment-2]
    endpoints:
      ...
  backend-db:
    type: mysql
    databases:
      ...
```

### Endpoints

Services with type nodejs, php or java can serve multiple endpoints via different protocol (right now only http... ). Below each protocol you can list the names of the endpoints with a sequence of calls:

```
...
  frontend:
    ...
    endpoints:
      http:
        /login:
          ...
        /addtocart:
          ...
        /checkout:
          ...        
```

### Databases

Services with type mysql can be setup with multiple databases and tables. Provide a list of databases with a sub-list of tables and columns to have them generated at start:

```YAML
...
  backend-db:
    type: mysql
      databases:
        shop:
          carts: [id, name, value]
          customers: [id, name, email]
        fulfilment:
          ...
```

## Loaders

In this section you can provide multiple load giving services. The name you provide is currently only used to name the docker container.


# Develop

If you'd like to contribute to this project, feel free to provide issues or pull requests.

If you'd like to add a node type for a specific language, look into the existing one, to see how they are structured.
