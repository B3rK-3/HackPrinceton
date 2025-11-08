import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ChatBubble from '../components/ChatBubble';
import './ProjectsScreen.css';

function ProjectsScreen() {
  const navigate = useNavigate();
  
  // Sample projects data - in a real app, this would come from an API or state management
  const [projects] = useState([
    {
      id: 1,
      name: 'Mathematics 101',
      courseMaterial: 'math101_materials.pdf',
      schedule: 'math101_schedule.pdf',
      createdAt: '2024-01-15',
      questionCount: 247
    },
    {
      id: 2,
      name: 'Computer Science Fundamentals',
      courseMaterial: 'cs_fundamentals.pdf',
      schedule: 'cs_schedule.pdf',
      createdAt: '2024-01-20',
      questionCount: 189
    },
    {
      id: 3,
      name: 'History of Art',
      courseMaterial: 'art_history.pdf',
      schedule: 'art_schedule.pdf',
      createdAt: '2024-01-25',
      questionCount: 156
    }
  ]);

  return (
    <div className="projects-screen">
      <Navbar />
      <div className="projects-content">
        <div className="projects-header">
          <div className="projects-title-section">
            <h1 className="projects-title">My Projects</h1>
            <div className="projects-elephant-group">
              <img src="/elephant1.png" alt="Elephant" className="projects-elephant" />
              <ChatBubble 
                message="Here are all your projects! Click to view details." 
                position="left"
              />
            </div>
          </div>
          <button 
            className="create-project-btn"
            onClick={() => navigate('/upload')}
          >
            + Create New Project
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="no-projects">
            <p>No projects yet. Create your first project to get started!</p>
            <button 
              className="create-first-btn"
              onClick={() => navigate('/upload')}
            >
              Create Project
            </button>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map((project) => (
              <div key={project.id} className="project-card">
                <div className="project-header">
                  <h2 className="project-name">{project.name}</h2>
                  <span className="project-date">{project.createdAt}</span>
                </div>
                
                <div className="project-files">
                  <div className="file-item">
                    <span className="file-icon">📄</span>
                    <div className="file-info">
                      <span className="file-label">Course Material:</span>
                      <span className="file-name">{project.courseMaterial}</span>
                    </div>
                  </div>
                  
                  <div className="file-item">
                    <span className="file-icon">📅</span>
                    <div className="file-info">
                      <span className="file-label">Schedule:</span>
                      <span className="file-name">{project.schedule}</span>
                    </div>
                  </div>
                </div>
                
                <div className="project-stats">
                  <span className="stat-badge">{project.questionCount} Questions</span>
                </div>
                
                <button 
                  className="view-project-btn"
                  onClick={() => navigate('/dashboard')}
                >
                  View Dashboard
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Decorative blue circles */}
      <div className="circle circle-1"></div>
      <div className="circle circle-2"></div>
      <div className="circle circle-3"></div>
      <div className="circle circle-4"></div>
    </div>
  );
}

export default ProjectsScreen;

