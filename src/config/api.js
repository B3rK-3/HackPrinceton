// API Configuration
// Set your API base URL in the .env file as REACT_APP_API_URL
// Example: REACT_APP_API_URL=http://localhost:3001

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

export const API_ENDPOINTS = {
  REGISTER: `${API_BASE_URL}/register`,
  SIGNIN: `${API_BASE_URL}/signin`,
  AUTH: `${API_BASE_URL}/auth`,
  SCHEDULE: `${API_BASE_URL}/schedule`,
  PROJECTS: (userId) => `${API_BASE_URL}/projects/${userId}`,
  PROJECT: (courseId) => `${API_BASE_URL}/project/${courseId}`,
  STUDY_PLAN: (courseId) => `${API_BASE_URL}/study-plan/${courseId}`,
  GENERATE_STUDY_PLAN: (courseId) => `${API_BASE_URL}/study-plan/${courseId}`,
};

export { GOOGLE_CLIENT_ID };
export default API_BASE_URL;

