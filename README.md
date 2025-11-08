# Remi - Learning Companion App

A fun and interactive learning platform with an elephant mascot that helps you study effectively.

## Features

- **Welcome Screen**: Beautiful landing page with Remi logo
- **Login/Signup**: Secure authentication with Google OAuth integration
- **Home Screen**: Main hub with project navigation
- **Projects Screen**: View all your projects with schedule and course materials
- **Document Upload**: Upload PDF course materials and schedule files
- **Loading Screen**: Animated loading with progress messages
- **Dashboard**: Analytics and insights with interactive charts

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure Environment Variables:
   
   Create a `.env` file in the root directory:
   ```env
   REACT_APP_API_URL=http://localhost:3001
   REACT_APP_GOOGLE_CLIENT_ID=982461567045-hevqk983sihfm8s266vuaojvvql83m51.apps.googleusercontent.com
   ```
   
   Replace `http://localhost:3001` with your actual API server URL.
   
   **Note:** The Google OAuth Client ID is already configured. The CLIENT_SECRET should only be used on your backend server, never in the frontend.

3. Add your images to the `public` folder (if not already present):
   - `remi.png` - Remi logo
   - `elephant1.png` - Elephant mascot for welcome screen
   - `elephant2.png` - Elephant mascot for upload screen
   - `elephant3.png` - Elephant mascot for dashboard (alternating)
   - `elephant4.png` - Elephant mascot for done screen

4. Start the development server:
```bash
npm start
```

## Authentication API

The app integrates with a user authentication API. Make sure your backend API is running and accessible at the URL specified in your `.env` file.

### API Endpoints Used:
- `POST /register` - Register a new user
- `POST /signin` - Sign in an existing user
- `POST /auth` - Link Google OAuth account

### Features:
- Email/password authentication
- Google OAuth sign-in
- Error handling for invalid credentials
- User ID storage in localStorage
- Automatic redirection after successful login/signup

## Brand Colors

- **Beige**: #F5F5DC (background)
- **Navy Blue**: #1a1a4a (accents, buttons)

## Screens

1. Welcome Screen - Landing page with logo and get started button
2. Login/Signup - Working authentication with API integration and Google OAuth
3. Home Screen - Main hub with logo and navigation options
4. Projects Screen - View all your projects with schedule and course materials
5. Upload Screen - Document upload interface
6. Loading Screen - Progress indicator
7. Done Screen - Completion confirmation
8. Dashboard - Analytics and metrics

## Technologies

- React 18
- React Router DOM
- Recharts (for analytics)
- Google Identity Services (OAuth)
- CSS3 (with animations and glass morphism effects)

## Google OAuth

The app includes Google OAuth integration for easy sign-in. See `README_GOOGLE_OAUTH.md` for detailed setup instructions.
