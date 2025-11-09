import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ChatBubble from '../components/ChatBubble';
import './ProjectsScreen.css';
import { API_ENDPOINTS } from '../config/api';
import { getUserId } from '../utils/auth';

function ProjectsScreen() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetchProjects();
    
    // Refresh projects when component gains focus (e.g., when returning from upload)
    const handleFocus = () => {
      fetchProjects();
    };
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);
  
  const fetchProjects = async () => {
    try {
      setLoading(true);
      const userId = getUserId();
      
      if (!userId) {
        setError('Please sign in to view your projects');
        setLoading(false);
        return;
      }
      
      const response = await fetch(API_ENDPOINTS.PROJECTS(userId));
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      
      const data = await response.json();
      setProjects(data.projects || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to load projects. Please try again later.');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

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

        {loading ? (
          <div className="no-projects">
            <p>Loading your projects...</p>
          </div>
        ) : error ? (
          <div className="no-projects">
            <p>{error}</p>
            <button 
              className="create-first-btn"
              onClick={fetchProjects}
            >
              Retry
            </button>
          </div>
        ) : projects.length === 0 ? (
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
            {projects.map((project) => {
              // Format date for display
              const createdAtDate = new Date(project.createdAt);
              const formattedDate = createdAtDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              });
              
              return (
                <div key={project.id || project.courseId} className="project-card">
                  <div className="project-header">
                    <h2 className="project-name">{project.name}</h2>
                    <span className="project-date">{formattedDate}</span>
                  </div>
                  
                  <div className="project-files">
                    <div className="file-item">
                      <span className="file-icon">📄</span>
                      <div className="file-info">
                        <span className="file-label">Course Material:</span>
                        <span className="file-name">{project.courseMaterial || 'Course content loaded'}</span>
                      </div>
                    </div>
                    
                    <div className="file-item">
                      <span className="file-icon">📅</span>
                      <div className="file-info">
                        <span className="file-label">Schedule:</span>
                        <span className="file-name">{project.schedule || 'Scheduled via iMessage'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="project-stats">
                    <span className="stat-badge">{project.questionCount || 0} Questions</span>
                    {project.answeredCount > 0 && (
                      <>
                        <span className="stat-badge" style={{ marginLeft: '8px', backgroundColor: '#4CAF50' }}>
                          {project.answeredCount} Answered
                        </span>
                        <span className="stat-badge" style={{ marginLeft: '8px', backgroundColor: project.accuracyRate >= 70 ? '#4CAF50' : '#FF9800' }}>
                          {project.accuracyRate}% Accuracy
                        </span>
                      </>
                    )}
                  </div>
                  
                  <button 
                    className="view-project-btn"
                    onClick={() => {
                      // Store selected project in localStorage for dashboard
                      localStorage.setItem('selectedProject', JSON.stringify(project));
                      navigate('/dashboard');
                    }}
                  >
                    View Dashboard
                  </button>
                </div>
              );
            })}
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

