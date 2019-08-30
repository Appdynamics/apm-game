#!/bin/bash
IMAGE_PREFIX="${1:-apm-game}"
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
