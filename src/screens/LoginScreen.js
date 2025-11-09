import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_ENDPOINTS } from '../config/api';
import { initializeGoogleAuth } from '../utils/googleAuth';
import './LoginScreen.css';

function LoginScreen() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  useEffect(() => {
    // Initialize Google OAuth after component mounts
    const initGoogle = async () => {
      try {
        await initializeGoogleAuth(
          (data) => {
            if (data.userCreated) {
              setSuccess('Account created with Google! Redirecting...');
            } else {
              setSuccess('Signed in with Google! Redirecting...');
            }
            // Check if user has a phone number stored
            const userPhoneNumber = localStorage.getItem('userPhoneNumber');
            setTimeout(() => {
              if (!userPhoneNumber) {
                navigate('/phone-number');
              } else {
                navigate('/home');
              }
            }, 1000);
          },
          (errorMsg) => {
            setError(errorMsg);
          }
        );
      } catch (error) {
        console.error('Failed to initialize Google Auth:', error);
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      initGoogle();
    }, 100);

    return () => clearTimeout(timer);
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const endpoint = isLogin ? API_ENDPOINTS.SIGNIN : API_ENDPOINTS.REGISTER;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        }),
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // If not JSON, try to get text or use default error
        const text = await response.text();
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        // Handle error responses
        if (response.status === 400) {
          setError('Please provide both email and password.');
        } else if (response.status === 401) {
          setError('Invalid email or password. Please try again.');
        } else {
          setError(data.message || 'An error occurred. Please try again.');
        }
        setLoading(false);
        return;
      }

      // Success - store user ID and navigate
      if (data.id) {
        localStorage.setItem('userId', data.id);
        localStorage.setItem('userEmail', formData.email);
        
        if (!isLogin && data.created) {
          setSuccess('Account created successfully! Redirecting...');
        } else if (!isLogin && !data.created) {
          setSuccess('Account already exists. Logging you in...');
        }
        
        // Check if user has a phone number stored
        const userPhoneNumber = localStorage.getItem('userPhoneNumber');
        if (!userPhoneNumber) {
          // Small delay to show success message, then navigate to phone number screen
          setTimeout(() => {
            navigate('/phone-number');
          }, 1000);
        } else {
          // Small delay to show success message, then navigate to home
          setTimeout(() => {
            navigate('/home');
          }, 1000);
        }
      } else {
        setError('Unexpected response from server. Please try again.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError('Network error. Please check your connection and try again.');
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear error when user starts typing
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handleToggle = () => {
    setIsLogin(!isLogin);
    setError('');
    setSuccess('');
    setFormData({ email: '', password: '' });
  };

  return (
    <div className="login-screen">
      <div className="login-logo-top">
        <img src="/remi.png" alt="Remi Logo" className="top-logo" />
      </div>
      {/* Decorative blue circles */}
      <div className="circle circle-1"></div>
      <div className="circle circle-2"></div>
      <div className="circle circle-3"></div>
      <div className="circle circle-4"></div>
      
      <div className="login-container">
        <h1 className="login-title">{isLogin ? 'Login' : 'Sign Up'}</h1>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            className="login-input"
            required
            disabled={loading}
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            className="login-input"
            required
            disabled={loading}
          />
          
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          
          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Sign Up')}
          </button>
        </form>
        
        <div className="divider">
          <span>or</span>
        </div>
        
        <div id="google-signin-button" className="google-signin-container"></div>
        
        <p className="toggle-text">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span 
            className="toggle-link"
            onClick={handleToggle}
            style={{ pointerEvents: loading ? 'none' : 'auto', opacity: loading ? 0.5 : 1 }}
          >
            {isLogin ? 'Sign Up' : 'Login'}
          </span>
        </p>
      </div>
    </div>
  );
}

export default LoginScreen;

