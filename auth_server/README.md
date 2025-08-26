# Getting Started with [Fastify-CLI](https://www.npmjs.com/package/fastify-cli)
# Auth Server Setup

This auth server provides OAuth authentication with Discord and GitHub, with proper account linking functionality.

## Features

- ✅ Only allow OAuth login for already-linked providers
- ✅ Only allow OAuth linking when user is authenticated  
- ✅ Proper account unlinking functionality
- ✅ Internal backend port (not exposed)
- ✅ Frontend served through nginx proxy

## Architecture

- **Backend API**: Port 3000 (internal only)
- **Frontend**: Port 3001 (internal only)
- **Nginx**: Proxy to frontend on port 3001, API requests to port 3000
- **No external ports exposed** - everything goes through nginx

## OAuth Behavior

### For Unauthenticated Users
- OAuth providers can only be used for login if already linked to an account
- New users must create an account with email/password first
- No automatic account creation via OAuth

### For Authenticated Users  
- OAuth providers can be linked to existing accounts
- One provider per account type (Discord, GitHub)
- Providers can be unlinked from user dashboard

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# JWT Secret (change this!)
JWT_SECRET=your-super-secret-jwt-key-change-me-in-production

# OAuth Provider Settings
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
GITHUB_CLIENT_ID=your_github_client_id  
GITHUB_CLIENT_SECRET=your_github_client_secret

# URLs (configured for docker-compose)
FRONTEND_URL=http://localhost:3001
BACKEND_URL=http://auth_server:3000
AUTH_SERVER_URL=http://auth_server:3000
```

## OAuth Provider Setup

### Discord
1. Go to https://discord.com/developers/applications
2. Create new application
3. OAuth2 → Redirects → Add: `https://localhost:8443/auth/oauth/discord/callback`
4. Copy Client ID and Secret to `.env`

### GitHub  
1. Go to https://github.com/settings/developers
2. Create new OAuth App
3. Authorization callback URL: `https://localhost:8443/auth/oauth/github/callback`
4. Copy Client ID and Secret to `.env`

## Running

```bash
# Build and start with docker-compose
docker-compose up --build

# Access via nginx proxy
https://localhost:8443
```

## API Endpoints

- `POST /auth/register` - Create account with email/password
- `POST /auth/login` - Login with email/password  
- `GET /auth/oauth/{provider}` - Start OAuth flow (linking if authenticated)
- `GET /auth/oauth/{provider}/callback` - OAuth callback
- `POST /auth/unlink-provider` - Unlink OAuth provider
- `GET /auth/me` - Get current user info
- `GET /auth/linked-providers` - Get user's linked providers

## Security Notes

- Backend port 3000 is not exposed externally
- OAuth state parameter validation
- JWT token verification for protected endpoints
- Provider already-linked checks
- No auto-linking based on email matching

## Learn More

To learn Fastify, check out the [Fastify documentation](https://fastify.dev/docs/latest/).
