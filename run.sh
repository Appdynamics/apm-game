#!/bin/bash
WITH_BUILD=1
DEFAULT_FILE_NAME="defaults.yml"
VERBOSITY=1

while getopts ":nqd:" opt; do
	case $opt in
		n)
			echo -e "\033[33mWill skip build.\033[0m"
			WITH_BUILD=0
		;;
		q)
			VERBOSITY=0
		;;
		d)
			DEFAULT_FILE_NAME=${OPTARG}
			if [ ! -f "${DEFAULT_FILE_NAME}" ]
			then
				echo -e "\033[31mDefault configuration '${DEFAULT_FILE_NAME}' not found. Please verify the file path\033[0m"
				exit
			fi
		;;
		\?)
			echo "Unknown option ${OPTARG}" >&2
		;;
  esac
done
shift $((OPTIND-1))

CONFIG=$1
CONTAINER_PREFIX=$2

if [ -z "${CONFIG}" ]
then
	CONTAINER_PREFIX="apm-game"
	CONFIG=config.yml
fi

if [ ! -f "${CONFIG}" ]
then
	echo -e "\033[31mConfiguration '${CONFIG}' not found. Please verify the file path\033[0m"
	exit
fi

if [ -z "${CONTAINER_PREFIX}" ]
then
	CONTAINER_PREFIX=`basename ${CONFIG%.yml}`
fi

CUSTOM_CODE_DIR="$(pwd)/scripts"
IMAGE_PREFIX="apm-game"
DOCKER_NETWORK="${CONTAINER_PREFIX}/network"
DOCKER_LOGS_VOLUME="${CONTAINER_PREFIX}-logs"
DOCKER_PHP_PROXY_VOLUME="${CONTAINER_PREFIX}-php-proxy"

IS_RUNNING=`docker ps -f name=${CONTAINER_PREFIX} -q`

if [ -n "${IS_RUNNING}" ]
then
	echo "${CONTAINER_PREFIX} is already in use. If you want to run the same application twice, provide a container prefix as second parameter:"
	echo -e "\n\t${0} ${1} ${CONTAINER_PREFIX}-2\n"
	exit
fi

if [ "${WITH_BUILD}" -eq "1" ]
then
	chmod +x ./build.sh
	./build.sh "${IMAGE_PREFIX}"
fi

docker network create ${DOCKER_NETWORK}
docker volume create ${DOCKER_LOGS_VOLUME}
docker volume create ${DOCKER_PHP_PROXY_VOLUME}

NETWORK_DETAILS=$(docker network inspect ${DOCKER_NETWORK})

node master/index.js "${CONFIG}" "${IMAGE_PREFIX}" "${DOCKER_NETWORK}" "${DOCKER_LOGS_VOLUME}" "${CONTAINER_PREFIX}" "${CUSTOM_CODE_DIR}" "${NETWORK_DETAILS}" "${DEFAULT_FILE_NAME}" "${VERBOSITY}" "${DOCKER_PHP_PROXY_VOLUME}"

docker network rm ${DOCKER_NETWORK}
docker volume rm ${DOCKER_LOGS_VOLUME}
docker volume rm ${DOCKER_PHP_PROXY_VOLUME}
