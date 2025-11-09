import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import './LoadingScreen.css';

function LoadingScreen() {
  const navigate = useNavigate();
  const [currentText, setCurrentText] = useState(0);
  
  const loadingMessages = [
    'Generating questions',
    'Scheduling questions',
    'Creating roadmap'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentText((prev) => (prev + 1) % loadingMessages.length);
    }, 2000);

    // Navigate to done screen after 6 seconds (2 seconds per message × 3 messages)
    const timeout = setTimeout(() => {
      navigate('/done');
    }, 6000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="loading-screen">
      <Navbar />
      <div className="loading-container">
        <div className="spinner"></div>
        <div className="loading-text-container">
          <p className="loading-text">{loadingMessages[currentText]}...</p>
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

export default LoadingScreen;

