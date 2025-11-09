# Google OAuth Setup

## Environment Variables

The `.env` file has been created with your Google OAuth Client ID.

**IMPORTANT SECURITY NOTES:**
- The `CLIENT_SECRET` should **NEVER** be stored in the frontend `.env` file
- The `CLIENT_SECRET` should only be used on your backend server
- Only the `CLIENT_ID` is safe to use in the frontend

## Current Configuration

```
REACT_APP_GOOGLE_CLIENT_ID=982461567045-hevqk983sihfm8s266vuaojvvql83m51.apps.googleusercontent.com
```

## Backend Requirements

Your backend `/auth` endpoint should:
1. Accept the JWT credential (sent as `code` parameter)
2. Validate the JWT token from Google
3. Exchange it for access/refresh tokens if needed
4. Store tokens in `user_tokens.json` under the user's ID

## Flow

1. User clicks "Sign in with Google" button
2. Google Identity Services handles OAuth flow
3. JWT credential is returned
4. Frontend attempts to register/login user with Google email
5. Frontend sends JWT credential to `/auth` endpoint to link Google account
6. Backend validates JWT and stores Google tokens

## Testing

1. Make sure your `.env` file is in the root directory
2. Restart your React development server after adding `.env` file
3. The Google Sign-In button should appear on the login page
4. Click the button to test the OAuth flow

## Troubleshooting

- If the Google button doesn't appear, check the browser console for errors
- Make sure `REACT_APP_GOOGLE_CLIENT_ID` is set in your `.env` file
- Verify that your Google OAuth client is configured correctly in Google Cloud Console
- Ensure your authorized JavaScript origins include your development URL (e.g., `http://localhost:3000`)

