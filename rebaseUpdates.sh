#!/usr/bin/env bash

git remote add upstream https://github.com/smartcraftio/smartcraft-starter.git || true
git fetch upstream
git rebase upstream/master