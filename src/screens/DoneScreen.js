import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import './DoneScreen.css';

function DoneScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    // Show done screen briefly (1.5 seconds) then navigate to projects
    const timeout = setTimeout(() => {
      navigate('/projects');
    }, 1500);

    return () => clearTimeout(timeout);
  }, [navigate]);

  return (
    <div className="done-screen">
      <Navbar />
      <div className="done-container">
        <div className="checkmark">✓</div>
        <h1 className="done-title">All Done!</h1>
        <p className="done-message">Your questions are ready!</p>
      </div>
      <div className="elephant-container">
        <img src="/elephant4.png" alt="Elephant" className="elephant-image" />
      </div>
      
      {/* Decorative blue circles */}
      <div className="circle circle-1"></div>
      <div className="circle circle-2"></div>
      <div className="circle circle-3"></div>
      <div className="circle circle-4"></div>
    </div>
  );
}

export default DoneScreen;

