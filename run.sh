#!/bin/bash
WITH_BUILD=1

while getopts ":n" opt; do
	case $opt in
		n)
			echo "Will skip build."
			WITH_BUILD=0
			shift $((OPTIND-1))
		;;
		\?)
			echo "Unknown option ${OPTARG}" >&2
			shift $((OPTIND-1))
		;;
  esac
done

CONFIG=$1
CONTAINER_PREFIX=$2


echo $CONFIG
echo $CONTAINER_PREFIX

if [ ! -f "${CONFIG}" ]
then
	CONTAINER_PREFIX="apm-game"
	CONFIG=config.yml
fi

if [ -z "${CONTAINER_PREFIX}" ]
then
	CONTAINER_PREFIX=`basename ${CONFIG%.yml}`
fi

CUSTOM_CODE_DIR="$(pwd)/scripts"
IMAGE_PREFIX="apm-game"
DOCKER_NETWORK="${CONTAINER_PREFIX}/network"
DOCKER_LOGS_VOLUME="${CONTAINER_PREFIX}-logs"

IS_RUNNING=`docker ps -f name=${CONTAINER_PREFIX} -q`

if [ -n "${IS_RUNNING}" ]
then
	echo "${CONTAINER_PREFIX} is already in use. If you want to run the same application twice, provide a container prefix as second parameter:"
	echo -e "\n\t${0} ${1} ${CONTAINER_PREFIX}-2\n"
	exit
fi

if [ "${WITH_BUILD}" -eq "1" ]
then
	./build.sh "${IMAGE_PREFIX}"
fi

docker network create ${DOCKER_NETWORK}
docker volume create ${DOCKER_LOGS_VOLUME}

NETWORK_DETAILS=$(docker network inspect ${DOCKER_NETWORK})

node master/index.js "${CONFIG}" "${IMAGE_PREFIX}" "${DOCKER_NETWORK}" "${DOCKER_LOGS_VOLUME}" "${CONTAINER_PREFIX}" "${CUSTOM_CODE_DIR}" "${NETWORK_DETAILS}"

docker network rm ${DOCKER_NETWORK}
docker volume rm ${DOCKER_LOGS_VOLUME}
