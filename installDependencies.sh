#!/usr/bin/env bash

curl -fsSL https://deno.land/x/install/install.sh | sh || true
deno upgrade --version 1.5.2
npm install -g nodemon
