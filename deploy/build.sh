#!/bin/bash

wd=`pwd`

## install dependecies
cd $wd/notestick-ui && npm install
cd $wd/electron && npm install

## build web
cd $wd/notestick-ui && npm run build

## move dist to server static dir
mkdir -p $wd/electron/src/public
mv $wd/notestick-ui/dist $wd/electron/src/public/app