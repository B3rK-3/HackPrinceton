import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ChatBubble from '../components/ChatBubble';
import './PhoneNumberScreen.css';
import { API_ENDPOINTS } from '../config/api';
import { getUserId } from '../utils/auth';

function PhoneNumberScreen() {
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatPhoneNumber = (value) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    
    // Format as +1 (XXX) XXX-XXXX or similar
    if (digits.length <= 1) {
      return digits ? `+${digits}` : '';
    } else if (digits.length <= 4) {
      return `+${digits.substring(0, 1)} (${digits.substring(1)}`;
    } else if (digits.length <= 7) {
      return `+${digits.substring(0, 1)} (${digits.substring(1, 4)}) ${digits.substring(4)}`;
    } else {
      return `+${digits.substring(0, 1)} (${digits.substring(1, 4)}) ${digits.substring(4, 7)}-${digits.substring(7, 11)}`;
    }
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
    setError('');
  };

  const validatePhoneNumber = (phone) => {
    // Remove formatting to get just digits
    const digits = phone.replace(/\D/g, '');
    // US phone numbers should have 11 digits (1 + 10) or 10 digits
    return digits.length === 10 || digits.length === 11;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!phoneNumber.trim()) {
      setError('Please enter your phone number');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setError('Please enter a valid phone number (10 or 11 digits)');
      return;
    }

    setLoading(true);

    try {
      const userId = getUserId();
      if (!userId) {
        setError('Please log in first');
        navigate('/login');
        return;
      }

      // Normalize phone number (remove formatting, ensure +1 prefix)
      const digits = phoneNumber.replace(/\D/g, '');
      const normalizedPhone = digits.length === 10 ? `+1${digits}` : `+${digits}`;

      // Store phone number in localStorage
      localStorage.setItem('userPhoneNumber', normalizedPhone);

      // Optionally, send to server to store in database
      // For now, we'll just store it locally and use it when creating projects

      // Navigate to home
      navigate('/home');
    } catch (err) {
      console.error('Error saving phone number:', err);
      setError('Failed to save phone number. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="phone-number-screen">
      <Navbar />
      <div className="phone-number-container">
        <div className="phone-number-title-section">
          <h1 className="phone-number-title">Enter Your Phone Number</h1>
          <div className="phone-number-elephant-group">
            <img
              src="/elephant1.png"
              alt="Elephant"
              className="phone-number-elephant"
            />
            <ChatBubble
              message="I'll send your study questions to this number via iMessage!"
              position="left"
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="phone-number-form">
          <div className="input-group">
            <label htmlFor="phone-number" className="input-label">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone-number"
              className="text-input phone-input"
              placeholder="+1 (555) 123-4567"
              value={phoneNumber}
              onChange={handlePhoneChange}
              disabled={loading}
              required
            />
            <p className="input-hint">
              Enter your phone number so we can send you study questions via iMessage
            </p>
          </div>

          {error && (
            <div className="error-message" style={{ marginTop: '15px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="phone-number-button"
            disabled={loading || !phoneNumber.trim()}
          >
            {loading ? 'Saving...' : 'Continue'}
          </button>
        </form>
      </div>

      {/* Decorative blue circles */}
      <div className="circle circle-1"></div>
      <div className="circle circle-2"></div>
      <div className="circle circle-3"></div>
      <div className="circle circle-4"></div>
    </div>
  );
}

export default PhoneNumberScreen;

