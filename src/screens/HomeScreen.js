import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ChatBubble from '../components/ChatBubble';
import './HomeScreen.css';

function HomeScreen() {
  const navigate = useNavigate();
  const [elephantIndex, setElephantIndex] = useState(0);
  const elephantImages = ['/elephant1.png', '/elephant2.png', '/elephant3.png'];

  useEffect(() => {
    // Check if user has a phone number stored
    const userPhoneNumber = localStorage.getItem('userPhoneNumber');
    if (!userPhoneNumber) {
      // Redirect to phone number screen if not set
      navigate('/phone-number');
    }
  }, [navigate]);

  useEffect(() => {
    // Cycle through elephant images every 2 seconds
    const interval = setInterval(() => {
      setElephantIndex((prevIndex) => (prevIndex + 1) % elephantImages.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [elephantImages.length]);

  return (
    <div className="home-screen">
      <Navbar />
      <div className="home-content">
        <div className="home-main">
          <div className="home-title-section">
            <div className="home-elephant-group">
              <img 
                src={elephantImages[elephantIndex]} 
                alt="Elephant" 
                className="home-elephant"
                key={elephantIndex}
              />
              <ChatBubble 
                message="Select a project or create a new one!" 
                position="left"
              />
            </div>
            <h1 className="home-title">
              Welcome to <img src="/remi.png" alt="Remi" className="remi-logo-inline" />
            </h1>
          </div>
          
          <div className="home-actions">
            <button 
              className="home-button primary"
              onClick={() => navigate('/projects')}
            >
              View My Projects
            </button>
            <button 
              className="home-button secondary"
              onClick={() => navigate('/upload')}
            >
              Create New Project
            </button>
          </div>
        </div>
      </div>
      
      {/* Decorative blue circles */}
      <div className="circle circle-1"></div>
      <div className="circle circle-2"></div>
      <div className="circle circle-3"></div>
      <div className="circle circle-4"></div>
    </div>
  );
}

export default HomeScreen;

