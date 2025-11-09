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
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    fetchProjects(true);
  }, []);

  // Auto-refresh projects every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchProjects(false); // Don't show loading state on auto-refresh
    }, 2000); // Refresh every 2 seconds

    return () => clearInterval(interval);
  }, []);

  // Refresh projects when component gains focus
  useEffect(() => {
    const handleFocus = () => {
      fetchProjects(false); // Don't show loading state on focus refresh
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchProjects = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      const userId = getUserId();
      
      if (!userId) {
        setError('User not logged in. Please log in first.');
        setLoading(false);
        setIsInitialLoad(false);
        return;
      }

      const response = await fetch(API_ENDPOINTS.PROJECTS(userId));
      
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.projects && Array.isArray(data.projects)) {
        setProjects(data.projects);
      } else {
        setProjects([]);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      // Only show error on initial load or if we don't have projects yet
      if (isInitialLoad) {
        setError(err.message || 'Failed to load projects. Please try again.');
        setProjects([]);
      }
      // Silently fail on auto-refresh if we already have projects
    } finally {
      if (showLoading) {
        setLoading(false);
        setIsInitialLoad(false);
      }
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
            <p>Loading projects...</p>
          </div>
        ) : error ? (
          <div className="no-projects">
            <p style={{ color: '#d32f2f', marginBottom: '20px' }}>{error}</p>
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
              // Format the creation date
              const createdDate = project.createdAt 
                ? new Date(project.createdAt).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })
                : 'Unknown date';
              
              return (
                <div key={project.id || project.courseId} className="project-card">
                  <div className="project-header">
                    <h2 className="project-name">{project.name || project.projectTitle || 'Untitled Project'}</h2>
                    <span className="project-date">{createdDate}</span>
                  </div>
                  
                  <div className="project-files">
                    <div className="file-item">
                      <span className="file-icon">📄</span>
                      <div className="file-info">
                        <span className="file-label">Course Material:</span>
                        <span className="file-name">{project.courseMaterial || 'Uploaded content'}</span>
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
                    <span className="stat-badge">{project.answeredCount || 0} Answered</span>
                    <span className="stat-badge">{project.accuracyRate !== undefined ? `${project.accuracyRate}%` : '0%'} Accuracy</span>
                  </div>
                  
                  <button 
                    className="view-project-btn"
                    onClick={() => {
                      // Store the selected project's courseId in localStorage for DashboardScreen
                      localStorage.setItem('selectedCourseId', project.courseId || project.id);
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

