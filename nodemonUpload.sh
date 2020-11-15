#!/usr/bin/env bash
nodemon --delay 1ms --watch ./tools/upload.ts --watch ./contracts/ -e ts --exec 'deno run --allow-read --allow-write --allow-net ./tools/upload.ts'
