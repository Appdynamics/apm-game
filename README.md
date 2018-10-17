# APM Game

Let the APM games begin! Have you ever had the evenings, where you wanted to play with your friends and families some rounds of identifying performance issues with [AppDynamics](https://www.appdynamics.com/), but missed the game to do that? -- Probably not, but here is **APM Games** anyhow, with some further use cases:

- Build *interactive demos* where your audiance can interact with AppDynamics themselves following your guidance.
- Heavily inspired by demosim, you can build custom demos, if [DemoMonkey](https://github.com/Appdynamics/demomonkey/) does not fit all your needs.
- Create custom screenshots for your presentations, articels, mails, ...
- Show customers after a TDD, how their future implementation of AppDynamics might look like.


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

**Note:** The agent for nodejs is installed automatically.

The docker images for the machine and network visibility agent are downloaded from docker store. You need to login to download these:

```shell
docker login
```

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

- **type** (required): Define the type of this service. You can currently use the following: `java`, `nodejs`, `php` and `mysql`. **Hint**: Prefer nodejs for agentless services and also if you want to build a big environment, since it comes with the lowest overhead.
- **agent**: Set to `no` or `yes` to disable or enable the appdynamics agent.
- **port**: Set a port which will be exposed to your docker host. So if you run locally, you can access this service via `http://localhost:<port>
- **endpoints** (java, nodejs, php only): Define multiple endpoints for this service. Read below to learn how to define endpoints.
- **aliases**: Provide a list of network name aliases. This is useful for agentless services, that serve as multiple remote services, e.g. multiple payment providers. **Hint**: You can use any name for an alias, even some existing domain names (e.g. www.appdynamics.com)!
- **labels**: You can provide a list of docker labels, that will be visible in the "container" view.
- **options** (nodejs only): For nodejs you can set an option called `connectionDelay`, that will force the webserver to wait the given number of milliseconds before it accepts a connection.
- **disabled**: Set this to `yes` to temporarily disable the service without removing it from the configuration file.
- **databases** (mysql only): Define multiple databases, that are created on startup on this database service. Read below to learn how to define databases and tables.

Without endpoints and databases a configuration might look like the following:

```YAML
services:
  frontend:
    type: nodejs
    labels:
      version: v1.0
      dc: FRA
    agent: yes
    port: 3000
    options:
      connectionDelay: 500
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

The *call sequences* below each endpoint are the simulated logic of your business application. Since the order of elements matters, you provide them in YAML list notation:

```YAML
...
        /checkout:
          - http://backend/cart/checkout
          - sleep,200
          - call: error,500,Aborted
            probability: 0.1
            schedule: "* */2 * * * * *"
            - call: data
              id: price
              type: int
              value: [32,16,8]
          - ...
...
```

The example above first executes a call to another service, called backend, then sleeps for 200 milliseconds and afterwards an error is thrown with a probability of 10%. Here is a list of supported commands and modifiers:

- **Commands** are like lines of code, that are executed by a service. You can call as many of them as you like to define an endpoint.
  - `http://<service>/<endpoint>`: Call another service via http.
  - `sql://<service>/<database>?query=<query>` (only php): Call a database service via SQL.
  - `sleep,<timeout>`: Stop processing for `<timeout>` milliseconds. Note, that the call graph will contain a language-specific `sleep` method, so use it especially with agent-less services and prefer `slow` for those having an agent.
  - `slow,<timeout>`: Slow down processing by around `<timeout>` milliseconds. The timeout is not accurate, so it will most of the time longer than the value given in `<timeout>`.
  - `cache,<timeout>`: Call a remote service of type cache. For Java this is ehcache2, for PHP and nodejs there is no real cache implementation, but they will tell you that a redis service was called.
  - `error,<code>,<message>`: Throw an error with HTTP code `<code>` and message `<message>`.  
  - `image,<URL>`: Put an `<img src=<URL>>` on the result page. This can be used to slow down end user responses.
  - `script,<URL>`: Put an `<script src=<<URL>>` on the result page. This can be used to delay the document building time.
  - `ajax,<URL>`: Put an ajax call to <URL> in the result page.
  - `data` (only java): This is a special command to add data to a snapshot/transaction analytics. It is only available in object notation and has the following attributes:
    - `call`: Always set to `data`
    - `id`: A unique identifier for this data point. This will be used by AppDynamics in the snapshot/analytics view.
    - `type`: The type of this data point. Possible values are `string`, `int` and `double`
    - `value`: The value of the data point. Use a single value or an array to add some randomness.

- **Modifiers** change the behaviour of a call. To use them provide an object notation for your call. As you can see in the example above, you can combine modifiers as you like:
  - `probability: <value>`: Execute this line of code with the probability of `<value>`. Provide a float for `<value>` between 0 and 1, where 0 means 0% and 1 means 100%.  
  - `schedule: <cron>` (only nodejs): Execute this line of code, only if the given `<cron>` expression is matched. If you provide an expression with five fields, it is assumed that you start with minutes. If you provide seven fields, the first is assumed to be seconds and the last is assumed to be years.
  - `catchExceptions: <true|false>`: Use this for http requests to throw an exception if the downstream call failed, instead of ignoring them (default: true)
  - `remoteTimeout: <value>`: Use this for http requests to define a timeout in milliseconds. After this time the connection will be terminated and an exception will be thrown.


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

For the example above two databases are generated, shop and fulfilment, and within the shop database there are two tables, carts and customers with the given columns. All columns are generated as `VARCHAR(255)`, except id which is used as primary key.

## Loaders

In this section you can provide multiple load giving services. The name you provide is currently only used to name the docker container:

```YAML
loaders:
  browser:
    type: puppeteer
    wait: 15
    count: 5
    urls:
      - http://frontend/addtocart
      - http://frontend/addtocart
      - http://frontend/checkout
```

Currently *APM Game* comes with three loaders: [curl](https://curl.haxx.se/), [puppeteer](https://pptr.dev/) and [phantomjs](http://phantomjs.org/). Both, puppeteer and phantomjs are headless browser, where puppeteer should be preferred. phantomjs might be deprecated in a later release.

All loaders take a list of `urls` and call them in the sequence given endlessly. By providing a `count` you can increase the number of docker instances that send load against your services. The `wait` parameter is used to delay the start of the load, so all your other services can be setup properly. For loaders of type `phantomjs` you can additionally provide a parameter `adrumTimeout`, that terminates a request waiting for the adrum beacon after the given time.

Note, that for each sequence of requests a `unique_session_id` is generated and send to the services as `GET`/`POST` parameter. A node.js frontend is picking up this value automatically for snapshots and analytics data. For PHP and Java you need to configure the data collectors in the UI.


# Develop

If you'd like to contribute to this project, feel free to provide issues or pull requests.

If you'd like to advance a node type, use the `run.sh` provided for each, to have a local version running. By default it will use the file `frontend.json` and `appdynamics.json` as configuration.

The easiest way to add functionality, is adding a new "command". For example, if you want to add a `noop` command for nodejs add the following code in the if-elseif-else-block:

```javascript
...
} else if (call.startsWith('noop')) {  
  resolve('')
}
...
```

If you want to add a new node type, create a new folder with a Dockerfile and all the other things that you might require. Check the `nodejs`, `php`, `java` or `mysql` implementation to get some insights.
