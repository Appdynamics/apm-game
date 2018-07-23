# APM Game

Build applications with errors and let other people find them with [AppDynamics](https://www.appdynamics.com/)!

# Installation

1. Clone this project

```shell
git clone git@github.com:svrnm/apm-game.git
```

2. Install all prerequisites:
- [Docker](https://www.docker.com/)
- [Node.JS](https://nodejs.org/en/)

3. Copy agent files into the directories for the java and PHP node.

4. Setup an [AppDynamics Platform](https://docs.appdynamics.com/display/latest/AppDynamics+Platform) or use your AppDynamics SaaS controller.

# Usage

1. Configure your game using YAML. You can look into the file `config.yml` to get started.

2. Execute the `run.sh`

3. Wait for data in AppDynamics

# Develop

If you'd like to contribute to this project, feel free to provide issues or pull requests.

If you'd like to add a node type for a specific language, look into the existing one, to see how they are structured.
