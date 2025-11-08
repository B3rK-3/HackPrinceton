import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ChatBubble from '../components/ChatBubble';
import './HomeScreen.css';

function HomeScreen() {
  const navigate = useNavigate();

  return (
    <div className="home-screen">
      <Navbar />
      <div className="home-content">
        <div className="home-main">
          <div className="home-title-section">
            <h1 className="home-title">
              Welcome to <img src="/remi.png" alt="Remi" className="remi-logo-inline" />
            </h1>
            <p className="home-subtitle">Your learning companion for effective studying</p>
            <div className="home-elephant-group">
              <img src="/elephant1.png" alt="Elephant" className="home-elephant" />
              <ChatBubble 
                message="Select a project or create a new one!" 
                position="left"
              />
            </div>
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

