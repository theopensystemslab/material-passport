#!/usr/bin/env sh
# this script should be sourced from shell to preserve environment variables (`. scripts/load-env.sh`)

set -a
source .env
source .env.local
source .env.test
source .env.development
source .env.production
set +a
