#!/bin/sh
set -e

# Function to wait for a service
wait_for() {
    echo "Waiting for $1..."
    while ! nc -z $1 $2; do
        sleep 1
    done
    echo "$1 is ready!"
}

# Wait for SQLite service if needed
if [ ! -z "$SQLITE_HOST" ]; then
    wait_for ${SQLITE_HOST:-sqlite} ${SQLITE_PORT:-7000}
fi

# Start the application
exec "$@"