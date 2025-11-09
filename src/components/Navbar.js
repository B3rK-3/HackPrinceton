import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Navbar.css';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <img 
          src="/remi.png" 
          alt="Remi Logo" 
          className="navbar-logo"
          onClick={() => navigate('/home')}
        />
      </div>
      <div className="navbar-right">
        <button
          className={`nav-tab ${isActive('/home') ? 'active' : ''}`}
          onClick={() => navigate('/home')}
        >
          Home
        </button>
        <button
          className={`nav-tab ${isActive('/projects') ? 'active' : ''}`}
          onClick={() => navigate('/projects')}
        >
          Projects
        </button>
      </div>
    </nav>
  );
}

export default Navbar;

