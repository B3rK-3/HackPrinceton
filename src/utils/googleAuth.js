// Google OAuth utility functions
import { GOOGLE_CLIENT_ID } from '../config/api';
import { API_ENDPOINTS } from '../config/api';
import { getUserId } from './auth';

/**
 * Load Google Identity Services script
 */
export const loadGoogleScript = () => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.accounts) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
};

/**
 * Initialize Google OAuth and handle sign-in
 */
export const initializeGoogleAuth = async (onSuccess, onError) => {
  try {
    await loadGoogleScript();

    if (!GOOGLE_CLIENT_ID) {
      throw new Error('Google Client ID is not configured');
    }

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        try {
          await handleGoogleCallback(response.credential, onSuccess, onError);
        } catch (error) {
          console.error('Google OAuth callback error:', error);
          if (onError) onError(error.message || 'Failed to sign in with Google');
        }
      },
    });

    // Render the Google sign-in button
    window.google.accounts.id.renderButton(
      document.getElementById('google-signin-button'),
      {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        width: '100%',
      }
    );
  } catch (error) {
    console.error('Failed to initialize Google Auth:', error);
    if (onError) onError(error.message || 'Failed to initialize Google sign-in');
  }
};

/**
 * Handle Google OAuth callback
 * Note: Google Identity Services returns a JWT credential
 * The backend should validate this JWT and extract user information
 */
const handleGoogleCallback = async (credential, onSuccess, onError) => {
  try {
    // Decode JWT to get user info (client-side decode, not verification)
    let userInfo = null;
    try {
      const payload = JSON.parse(atob(credential.split('.')[1]));
      userInfo = {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      };
    } catch (e) {
      console.warn('Could not decode JWT:', e);
    }

    if (!userInfo || !userInfo.email) {
      throw new Error('Failed to get user information from Google');
    }

    // First, try to register/login with Google email
    // If user exists, login; if not, register
    let userId = null;
    let userCreated = false;

    // Try to sign in first
    try {
      const signInResponse = await fetch(API_ENDPOINTS.SIGNIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userInfo.email,
          password: 'google_oauth', // Placeholder - backend should handle OAuth users
        }),
      });

      if (signInResponse.ok) {
        const signInData = await signInResponse.json();
        userId = signInData.id;
      }
    } catch (error) {
      console.log('Sign in failed, trying registration...');
    }

    // If sign in failed, try to register
    if (!userId) {
      try {
        const registerResponse = await fetch(API_ENDPOINTS.REGISTER, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userInfo.email,
            password: 'google_oauth', // Placeholder - backend should handle OAuth users
          }),
        });

        if (registerResponse.ok) {
          const registerData = await registerResponse.json();
          userId = registerData.id;
          userCreated = registerData.created || false;
        }
      } catch (error) {
        console.error('Registration error:', error);
      }
    }

    // If we have a userId, link the Google account and store user data
    if (userId) {
      // Store user data
      localStorage.setItem('userId', userId);
      localStorage.setItem('userEmail', userInfo.email);

      // Link Google account (send credential as 'code' parameter)
      // Note: Backend should handle JWT validation and token exchange
      try {
        const response = await fetch(API_ENDPOINTS.AUTH, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: userId,
            code: credential, // Send JWT credential as 'code'
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          // Even if linking fails, user is logged in
          console.warn('Failed to link Google account, but user is logged in');
        }

        if (onSuccess) {
          onSuccess({ userId, userCreated, ...data });
        }
      } catch (error) {
        // User is still logged in even if linking fails
        console.warn('Failed to link Google account:', error);
        if (onSuccess) {
          onSuccess({ userId, userCreated });
        }
      }
    } else {
      throw new Error('Failed to authenticate with Google. Please try again.');
    }
  } catch (error) {
    console.error('Google callback error:', error);
    if (onError) onError(error.message || 'Failed to sign in with Google');
    throw error;
  }
};

/**
 * Trigger Google sign-in
 */
export const triggerGoogleSignIn = () => {
  if (window.google && window.google.accounts) {
    window.google.accounts.id.prompt();
  }
};

