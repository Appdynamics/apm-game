#!/bin/bash

CONFIG=$1
CONTAINER_PREFIX=$2

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

(
  cd master/ || exit
  npm install
);

for DIR in nodes/*;
do
  if [ -d $DIR ] ; then
    echo "Building ${IMAGE_PREFIX}/`basename $DIR`..."
    docker build -t "${IMAGE_PREFIX}/`basename $DIR`" $DIR;
  fi
done;

for DIR in loaders/*;
do
  if [ -d $DIR ] ; then
    docker build -t "${IMAGE_PREFIX}/`basename $DIR`" $DIR;
  fi
done;

docker build -t "${IMAGE_PREFIX}/machine" infrastructure/machine;
docker build -t "${IMAGE_PREFIX}/netviz" infrastructure/netviz;
docker build -t "${IMAGE_PREFIX}/dbmon" infrastructure/dbmon;

docker network create ${DOCKER_NETWORK}
docker volume create ${DOCKER_LOGS_VOLUME}

NETWORK_DETAILS=$(docker network inspect ${DOCKER_NETWORK})

node master/index.js "${CONFIG}" "${IMAGE_PREFIX}" "${DOCKER_NETWORK}" "${DOCKER_LOGS_VOLUME}" "${CONTAINER_PREFIX}" "${CUSTOM_CODE_DIR}" "${NETWORK_DETAILS}"

docker network rm ${DOCKER_NETWORK}
docker volume rm ${DOCKER_LOGS_VOLUME}
