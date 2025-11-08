// Authentication utility functions

/**
 * Get the current user ID from localStorage
 * @returns {string|null} User ID or null if not found
 */
export const getUserId = () => {
  return localStorage.getItem('userId');
};

/**
 * Get the current user email from localStorage
 * @returns {string|null} User email or null if not found
 */
export const getUserEmail = () => {
  return localStorage.getItem('userEmail');
};

/**
 * Check if user is authenticated
 * @returns {boolean} True if user ID exists
 */
export const isAuthenticated = () => {
  return !!getUserId();
};

/**
 * Clear user authentication data
 */
export const logout = () => {
  localStorage.removeItem('userId');
  localStorage.removeItem('userEmail');
};

/**
 * Set user authentication data
 * @param {string} userId - User ID
 * @param {string} email - User email
 */
export const setUserData = (userId, email) => {
  localStorage.setItem('userId', userId);
  localStorage.setItem('userEmail', email);
};

