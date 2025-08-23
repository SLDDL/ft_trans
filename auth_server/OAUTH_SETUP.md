# OAuth Setup Guide

This guide will help you set up OAuth applications for Discord and GitHub to test the authentication system.

## 1. Discord OAuth Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name (e.g., "Auth Test")
3. Go to "OAuth2" → "General"
4. Add this redirect URI: `http://localhost:3000/oauth/discord/callback`
5. Copy the "Client ID" and "Client Secret"
6. Update your `.env` file:
   ```
   DISCORD_CLIENT_ID=your_client_id_here
   DISCORD_CLIENT_SECRET=your_client_secret_here
   ```

## 2. GitHub OAuth Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the details:
   - Application name: `Auth Test`
   - Homepage URL: `http://localhost:3001`
   - Authorization callback URL: `http://localhost:3000/oauth/github/callback`
4. Copy the "Client ID" and generate a "Client Secret"
5. Update your `.env` file:
   ```
   GITHUB_CLIENT_ID=your_client_id_here
   GITHUB_CLIENT_SECRET=your_client_secret_here
   ```

## 3. Complete .env Configuration

Your `.env` file should look like this:

```env
# OAuth Configuration
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# JWT Secret (generate a random string)
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# Server Configuration
PORT=3000
FRONTEND_URL=http://localhost:3001
BACKEND_URL=http://localhost:3000
```

## 4. Running the Application

1. Start the auth server:
   ```bash
   npm run dev
   ```

2. In a new terminal, start the frontend server:
   ```bash
   node frontend/server.js
   ```

3. Open your browser and go to `http://localhost:3001`

## 5. Testing OAuth Flow

1. Click "Login with Discord" or "Login with GitHub"
2. You'll be redirected to the provider's authorization page
3. After authorization, you'll be redirected back with your user info
4. The JWT token will be stored in localStorage and displayed

## API Endpoints

Your auth server provides these endpoints:

- `GET /healthcheck` - Health check
- `GET /oauth/:provider` - Initiate OAuth flow (discord/github)
- `GET /oauth/:provider/callback` - OAuth callback handler
- `GET /validate` - Validate JWT token
- `GET /me` - Get current user info
- `POST /logout` - Logout (client-side token removal)

## Security Notes

- In production, use HTTPS
- Use secure, random JWT secrets
- Consider implementing token blacklisting for logout
- Add rate limiting to prevent abuse
- Store user data in a proper database
- Implement proper error handling and logging