#!/bin/sh
set -e

echo "Container user: $(id)"
echo "Data directory: $(ls -la /data/ 2>/dev/null || echo '/data does not exist')"

# Ensure the /data directory exists and is accessible
if [ ! -d "/data" ]; then
    echo "Creating /data directory..."
    mkdir -p /data
fi

# Check if we can write to the data directory
if [ -w "/data" ]; then
    echo "✓ /data directory is writable"
else
    echo "✗ /data directory is not writable"
    echo "Directory info: $(ls -ld /data 2>/dev/null || echo 'Cannot access /data')"
fi

# Start the application
echo "Starting application..."
exec "$@"