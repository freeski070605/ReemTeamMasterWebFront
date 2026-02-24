import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the JWT token
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle auth errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const backendMessage = error?.response?.data?.message;
    const isJwtAuthFailure = backendMessage === 'No token, authorization denied'
      || backendMessage === 'Token is not valid';

    if (error.response && error.response.status === 401 && isJwtAuthFailure) {
      // Only clear session for backend JWT auth failures.
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Optional: Redirect to login or update state
      // window.location.href = '/login'; 
    }
    return Promise.reject(error);
  }
);

export default client;
