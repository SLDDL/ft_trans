#!/bin/sh

echo "🚀 Starting development container..."

# Create a writable CSS output directory in /tmp
echo "📁 Creating CSS output directory in /tmp..."
mkdir -p /tmp/css

# Build initial CSS if it doesn't exist
if [ ! -f /tmp/css/output.css ]; then
    echo "🎨 Building initial Tailwind CSS..."
    npm run build-css-prod
fi

# Start the development server with CSS watching
echo "🔥 Starting development server with Tailwind CSS watch mode..."
exec "$@"
