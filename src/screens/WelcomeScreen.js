import React from 'react';
import { useNavigate } from 'react-router-dom';
import ChatBubble from '../components/ChatBubble';
import './WelcomeScreen.css';

function WelcomeScreen() {
  const navigate = useNavigate();

  return (
    <div className="welcome-screen">
      <div className="welcome-logo-top">
        <img src="/remi.png" alt="Remi Logo" className="top-logo" />
      </div>
      <div className="welcome-content">
        <div className="welcome-title-section">
          <h1 className="welcome-title">
            Welcome to <img src="/remi.png" alt="Remi" className="remi-logo-inline" />
          </h1>
          <div className="welcome-elephant-group">
            <img src="/elephant1.png" alt="Elephant" className="welcome-elephant" />
            <ChatBubble 
              message="Hi, I'm Remi! I can't wait to help you learn!" 
              position="left"
            />
          </div>
        </div>
        <button 
          className="get-started-btn"
          onClick={() => navigate('/login')}
        >
          Get Started
        </button>
      </div>
      
      {/* Decorative blue circles */}
      <div className="circle circle-1"></div>
      <div className="circle circle-2"></div>
      <div className="circle circle-3"></div>
      <div className="circle circle-4"></div>
    </div>
  );
}

export default WelcomeScreen;

