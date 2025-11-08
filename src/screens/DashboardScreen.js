import React, { useState, useEffect } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import Navbar from '../components/Navbar';
import ChatBubble from '../components/ChatBubble';
import './DashboardScreen.css';

function DashboardScreen() {
  const [currentElephant, setCurrentElephant] = useState(2);

  // Sample data for analytics
  const correctAnswersData = [
    { name: 'Correct', value: 75, color: '#1a1a4a' },
    { name: 'Incorrect', value: 25, color: '#888' }
  ];

  const consistencyData = [
    { name: 'Week 1', consistency: 85 },
    { name: 'Week 2', consistency: 90 },
    { name: 'Week 3', consistency: 78 },
    { name: 'Week 4', consistency: 92 },
    { name: 'Week 5', consistency: 88 },
    { name: 'Week 6', consistency: 95 }
  ];

  // Animate elephant switching between elephant2 and elephant3
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentElephant((prev) => (prev === 2 ? 3 : 2));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard-screen">
      <Navbar />
      <div className="dashboard-header">
        <div className="dashboard-title-section">
          <h1 className="dashboard-title">Dashboard</h1>
          <div className="dashboard-elephant-group">
            <img 
              src={`/elephant${currentElephant}.png`} 
              alt="Elephant" 
              className="dashboard-elephant"
              key={currentElephant}
            />
            <ChatBubble 
              message="Check out your progress! You're doing great!" 
              position="left"
            />
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="stats-grid">
          <div className="stat-card">
            <h3 className="stat-title">Questions Correct</h3>
            <div className="stat-value">75%</div>
            <div className="chart-container-small">
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie
                    data={correctAnswersData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {correctAnswersData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="stat-card">
            <h3 className="stat-title">Consistency</h3>
            <div className="stat-value">88%</div>
            <p className="stat-description">Average weekly consistency</p>
          </div>

          <div className="stat-card">
            <h3 className="stat-title">Content Remaining</h3>
            <div className="stat-value">35%</div>
            <p className="stat-description">Content left to be tested</p>
          </div>

          <div className="stat-card">
            <h3 className="stat-title">Total Questions</h3>
            <div className="stat-value">1,247</div>
            <p className="stat-description">Questions completed</p>
          </div>
        </div>

        <div className="chart-section">
          <div className="chart-card">
            <h3 className="chart-title">Consistency Trends</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={consistencyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="name" stroke="#1a1a4a" />
                  <YAxis stroke="#1a1a4a" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#F5F5DC', 
                      border: '1px solid #1a1a4a',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="consistency" 
                    stroke="#1a1a4a" 
                    strokeWidth={3}
                    dot={{ fill: '#1a1a4a', r: 5 }}
                    name="Consistency %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
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

export default DashboardScreen;

