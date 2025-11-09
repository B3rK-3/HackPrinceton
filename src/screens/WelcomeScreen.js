import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatBubble from '../components/ChatBubble';
import './WelcomeScreen.css';

function WelcomeScreen() {
  const navigate = useNavigate();
  const [elephantIndex, setElephantIndex] = useState(0);
  const elephantImages = ['/elephant1.png', '/elephant2.png', '/elephant3.png'];

  useEffect(() => {
    // Cycle through elephant images every 2 seconds
    const interval = setInterval(() => {
      setElephantIndex((prevIndex) => (prevIndex + 1) % elephantImages.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [elephantImages.length]);

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-title-section">
          <div className="welcome-elephant-group">
            <img 
              src={elephantImages[elephantIndex]} 
              alt="Elephant" 
              className="welcome-elephant"
              key={elephantIndex}
              style={{ animation: 'fadeIn 0.5s ease-in-out' }}
            />
            <ChatBubble 
              message="ask. recall. repeat." 
              position="left"
            />
          </div>
          <h1 className="welcome-title">
            Welcome to <img src="/remi.png" alt="Remi" className="remi-logo-inline" />
          </h1>
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

