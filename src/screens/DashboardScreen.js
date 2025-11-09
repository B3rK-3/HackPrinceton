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
import { API_ENDPOINTS } from '../config/api';
import { useNavigate } from 'react-router-dom';

// Component to extract and display study plan timeline
function StudyPlanTimeline({ studyPlan, projectData }) {
  // Extract timeline information from study plan
  const extractTimeline = (text) => {
    if (!text) return null;
    
    // Try to find the schedule/timeline section more intelligently
    // Look for headings like "Schedule", "Timeline", "Study Schedule", "Recommended Schedule"
    const scheduleHeadings = [
      /(?:^|\n)##?\s*(?:Recommended\s+)?(?:Study\s+)?(?:Schedule|Timeline|Plan)[\s\S]{1,400}/i,
      /(?:Schedule|Timeline|Study Schedule):[\s\S]{1,300}/i,
      /(?:Recommended|Suggested).*?(?:schedule|timeline)[\s\S]{1,300}/i,
    ];
    
    let scheduleText = null;
    for (const pattern of scheduleHeadings) {
      const match = text.match(pattern);
      if (match) {
        scheduleText = match[0]
          .replace(/^#+\s*/gm, '') // Remove markdown headers
          .replace(/\*\*/g, '') // Remove bold markers
          .trim()
          .substring(0, 250);
        break;
      }
    }
    
    // If no specific schedule section found, try to extract timeline info from the text
    if (!scheduleText) {
      // Look for sentences containing schedule-related keywords
      const sentences = text.split(/[.!?]\s+/);
      const scheduleSentences = sentences.filter(s => 
        /(?:schedule|timeline|day|week|daily|weekly|review|study)/i.test(s)
      ).slice(0, 2);
      
      if (scheduleSentences.length > 0) {
        scheduleText = scheduleSentences.join('. ') + '.';
      }
    }
    
    return {
      scheduleText: scheduleText || null
    };
  };
  
  // Calculate next text date based on unanswered questions and study progress
  const calculateNextTextDate = () => {
    if (!projectData) return null;
    
    const totalQuestions = projectData.questionCount || 0;
    const answeredCount = projectData.answeredCount || 0;
    const unansweredCount = totalQuestions - answeredCount;
    
    // If no questions answered yet, they'll get a text when they start
    if (answeredCount === 0) {
      return null;
    }
    
    // Get the last answered question date
    const performance = projectData.performance || {};
    const performanceEntries = Object.values(performance);
    
    // Get the most recent answer date
    const lastAnswerDate = performanceEntries
      .map(p => p.answeredAt ? new Date(p.answeredAt) : null)
      .filter(d => d !== null)
      .sort((a, b) => b - a)[0];
    
    if (!lastAnswerDate) return null;
    
    const today = new Date();
    const daysSinceLastAnswer = Math.floor((today - lastAnswerDate) / (1000 * 60 * 60 * 24));
    
    // Determine days until next text based on:
    // - If they have unanswered questions: text every 1-2 days
    // - If they've answered all questions: text in 3-5 days for review
    let daysBetweenTexts = 2; // Default: 2 days
    
    if (unansweredCount > 0) {
      // Active study: text more frequently
      daysBetweenTexts = 1 + Math.min(Math.floor(unansweredCount / 5), 1); // 1-2 days
    } else {
      // All answered: space out for review
      daysBetweenTexts = 3;
    }
    
    const nextTextDate = new Date(lastAnswerDate);
    nextTextDate.setDate(nextTextDate.getDate() + daysBetweenTexts);
    
    // If next text date is today or in the past, set it to tomorrow
    if (nextTextDate <= today) {
      nextTextDate.setDate(today.getDate() + 1);
    }
    
    return nextTextDate;
  };
  
  const timelineInfo = extractTimeline(studyPlan);
  const nextTextDate = calculateNextTextDate();
  
  // Calculate days until next text
  const getDaysUntilNextText = () => {
    if (!nextTextDate) return null;
    const today = new Date();
    const diffTime = nextTextDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };
  
  const daysUntilNextText = getDaysUntilNextText();
  
  return (
    <div className="study-plan-timeline">
      {timelineInfo && timelineInfo.scheduleText && (
        <div className="timeline-section">
          <h4 className="timeline-title">📅 Study Timeline</h4>
          <div className="timeline-content">
            <p>{timelineInfo.scheduleText}</p>
          </div>
        </div>
      )}
      
      {!timelineInfo?.scheduleText && studyPlan && (
        <div className="timeline-section">
          <h4 className="timeline-title">📅 Study Timeline</h4>
          <div className="timeline-content">
            <p>Your personalized study plan has been generated. Check your phone messages for the complete schedule and recommendations.</p>
          </div>
        </div>
      )}
      
      {daysUntilNextText !== null && (
        <div className="next-text-section">
          <div className="next-text-message">
            {daysUntilNextText === 0 ? (
              <p>📱 <strong>I'll text you today!</strong></p>
            ) : daysUntilNextText === 1 ? (
              <p>📱 <strong>I'll text you tomorrow</strong></p>
            ) : (
              <p>📱 <strong>I'll text you in {daysUntilNextText} days</strong></p>
            )}
            {nextTextDate && (
              <p className="next-text-date">
                ({nextTextDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'short', 
                  day: 'numeric' 
                })})
              </p>
            )}
          </div>
        </div>
      )}
      
      {!timelineInfo && !nextTextDate && (
        <div className="timeline-empty">
          <p>Study plan timeline will appear here once you start answering questions.</p>
        </div>
      )}
    </div>
  );
}

// Component to render study plan text with markdown formatting (kept for reference but not used in main display)
function StudyPlanText({ text }) {
  // Convert markdown to HTML
  const formatStudyPlan = (text) => {
    let formatted = text;
    
    // Convert headers (must be done first, before other formatting)
    formatted = formatted.replace(/^### (.*)$/gim, '<h3>$1</h3>');
    formatted = formatted.replace(/^## (.*)$/gim, '<h2>$1</h2>');
    formatted = formatted.replace(/^# (.*)$/gim, '<h1>$1</h1>');
    
    // Convert bold text first (before italic) - use a placeholder to avoid conflicts
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '__BOLD__$1__/BOLD__');
    
    // Convert italic text (single asterisks)
    formatted = formatted.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
    
    // Convert bold placeholders back to HTML
    formatted = formatted.replace(/__BOLD__(.*?)__\/BOLD__/g, '<strong>$1</strong>');
    
    // Process lines for lists and paragraphs
    const lines = formatted.split('\n');
    const formattedLines = [];
    let inList = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines (but close lists if needed)
      if (!line) {
        if (inList) {
          formattedLines.push('</ul>');
          inList = false;
        }
        continue;
      }
      
      // Check if line is already a header
      if (line.startsWith('<h1>') || line.startsWith('<h2>') || line.startsWith('<h3>')) {
        if (inList) {
          formattedLines.push('</ul>');
          inList = false;
        }
        formattedLines.push(line);
        continue;
      }
      
      // Check for bullet points or numbered lists
      const bulletMatch = line.match(/^[-•*] (.*)$/);
      const numberMatch = line.match(/^\d+\. (.*)$/);
      
      if (bulletMatch || numberMatch) {
        if (!inList) {
          formattedLines.push('<ul>');
          inList = true;
        }
        const content = bulletMatch ? bulletMatch[1] : numberMatch[1];
        formattedLines.push(`<li>${content}</li>`);
      } else {
        if (inList) {
          formattedLines.push('</ul>');
          inList = false;
        }
        // Wrap in paragraph if not already HTML
        if (!line.startsWith('<')) {
          formattedLines.push(`<p>${line}</p>`);
        } else {
          formattedLines.push(line);
        }
      }
    }
    
    if (inList) {
      formattedLines.push('</ul>');
    }
    
    return formattedLines.join('\n');
  };

  return (
    <div 
      className="study-plan-text"
      dangerouslySetInnerHTML={{ __html: formatStudyPlan(text) }}
    />
  );
}

function DashboardScreen() {
  const navigate = useNavigate();
  const [currentElephant, setCurrentElephant] = useState(2);
  const [projectData, setProjectData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [studyPlan, setStudyPlan] = useState(null);
  const [studyPlanLoading, setStudyPlanLoading] = useState(false);
  const [studyPlanError, setStudyPlanError] = useState(null);

  useEffect(() => {
    fetchProjectData();
  }, []);

  const fetchProjectData = async () => {
    try {
      setLoading(true);
      // Get selected project from localStorage (set when clicking View Dashboard)
      const selectedProject = localStorage.getItem('selectedProject');
      
      if (!selectedProject) {
        // If no project selected, try to get the first project for the user
        setError('Please select a project from the Projects page');
        setLoading(false);
        return;
      }

      const project = JSON.parse(selectedProject);
      const courseId = project.courseId || project.id;

      const response = await fetch(API_ENDPOINTS.PROJECT(courseId));
      if (!response.ok) {
        throw new Error('Failed to fetch project data');
      }

      const data = await response.json();
      setProjectData(data);
      setError(null);
      
      // Check if study plan is included in project data, otherwise fetch it
      if (data.studyPlan && data.studyPlan.text) {
        setStudyPlan(data.studyPlan.text);
      } else if (data.courseId) {
        fetchStudyPlan(data.courseId);
      }
      
      // Update study plan sent status
      if (data.studyPlanSent !== undefined) {
        // This will be available in projectData
      }
    } catch (err) {
      console.error('Error fetching project data:', err);
      setError('Failed to load project data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudyPlan = async (courseId) => {
    try {
      setStudyPlanError(null);
      const response = await fetch(API_ENDPOINTS.STUDY_PLAN(courseId));
      
      if (response.ok) {
        const data = await response.json();
        setStudyPlan(data.studyPlan);
      } else if (response.status === 404) {
        // Study plan doesn't exist yet, that's okay
        setStudyPlan(null);
      } else {
        throw new Error('Failed to fetch study plan');
      }
    } catch (err) {
      console.error('Error fetching study plan:', err);
      // Don't set error for study plan - it's optional
      setStudyPlan(null);
    }
  };

  const generateStudyPlan = async () => {
    if (!projectData) return;
    
    try {
      setStudyPlanLoading(true);
      setStudyPlanError(null);
      
      const courseId = projectData.courseId || projectData.id;
      if (!courseId) {
        throw new Error('Course ID not found. Please select a project from the Projects page.');
      }
      
      const url = API_ENDPOINTS.GENERATE_STUDY_PLAN(courseId);
      console.log('Generating study plan for courseId:', courseId);
      console.log('API URL:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Check if response is actually JSON before trying to parse
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response received:');
        console.error('Status:', response.status, response.statusText);
        console.error('Content-Type:', contentType);
        console.error('Response preview:', text.substring(0, 500));
        
        if (response.status === 404) {
          throw new Error('Study plan endpoint not found. Please ensure the server is running on port 3001.');
        } else if (response.status >= 500) {
          throw new Error('Server error. Please check if the backend server is running and try again.');
        } else {
          throw new Error(`Server returned an unexpected response (${response.status}). Please check the server logs.`);
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => {
          // If JSON parsing fails, return a generic error
          return { message: `Server error: ${response.status} ${response.statusText}` };
        });
        throw new Error(errorData.message || errorData.error || 'Failed to generate study plan');
      }

      const data = await response.json();
      if (data.studyPlan) {
        setStudyPlan(data.studyPlan);
        // Refresh project data to get updated sent status
        if (data.sentViaMessage) {
          // Study plan was sent, refresh project data to show updated status
          setTimeout(() => {
            fetchProjectData();
          }, 1000);
        }
      } else {
        throw new Error('Study plan not found in response');
      }
    } catch (err) {
      console.error('Error generating study plan:', err);
      setStudyPlanError(err.message || 'Failed to generate study plan. Please try again.');
    } finally {
      setStudyPlanLoading(false);
    }
  };

  // Animate elephant switching between elephant2 and elephant3
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentElephant((prev) => (prev === 2 ? 3 : 2));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Prepare data for charts
  const correctAnswersData = projectData ? [
    { name: 'Correct', value: projectData.correctCount || 0, color: '#1a1a4a' },
    { name: 'Incorrect', value: projectData.incorrectCount || 0, color: '#888' }
  ] : [
    { name: 'Correct', value: 0, color: '#1a1a4a' },
    { name: 'Incorrect', value: 0, color: '#888' }
  ];

  // Generate consistency data from performance timeline (if available)
  const consistencyData = projectData && projectData.performance && Object.keys(projectData.performance).length > 0 ? (() => {
    // Group performance by date and calculate daily accuracy
    const performanceEntries = Object.values(projectData.performance);
    const dateGroups = {};
    
    performanceEntries.forEach((perf) => {
      if (perf && perf.answeredAt) {
        try {
          const date = new Date(perf.answeredAt).toLocaleDateString();
          if (!dateGroups[date]) {
            dateGroups[date] = { correct: 0, total: 0 };
          }
          dateGroups[date].total++;
          if (perf.correct) {
            dateGroups[date].correct++;
          }
        } catch (e) {
          console.error('Error processing performance entry:', e);
        }
      }
    });

    // Convert to chart data format
    const dates = Object.keys(dateGroups).sort();
    if (dates.length === 0) {
      // No date data available, return empty data
      return [
        { name: 'Day 1', consistency: 0 },
        { name: 'Day 2', consistency: 0 },
        { name: 'Day 3', consistency: 0 },
        { name: 'Day 4', consistency: 0 },
        { name: 'Day 5', consistency: 0 },
        { name: 'Day 6', consistency: 0 }
      ];
    }
    
    // Take the last 6 days or pad with zeros if less than 6
    const chartData = dates.slice(-6).map((date, index) => {
      const group = dateGroups[date];
      const accuracy = group.total > 0 ? Math.round((group.correct / group.total) * 100) : 0;
      return {
        name: `Day ${index + 1}`,
        consistency: accuracy
      };
    });
    
    // Pad with zeros if we have less than 6 data points
    while (chartData.length < 6) {
      chartData.unshift({ name: `Day ${chartData.length + 1}`, consistency: 0 });
    }
    
    return chartData;
  })() : [
    { name: 'Day 1', consistency: 0 },
    { name: 'Day 2', consistency: 0 },
    { name: 'Day 3', consistency: 0 },
    { name: 'Day 4', consistency: 0 },
    { name: 'Day 5', consistency: 0 },
    { name: 'Day 6', consistency: 0 }
  ];

  if (loading) {
    return (
      <div className="dashboard-screen">
        <Navbar />
        <div className="dashboard-content">
          <p>Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error || !projectData) {
    return (
      <div className="dashboard-screen">
        <Navbar />
        <div className="dashboard-content">
          <p>{error || 'No project data available'}</p>
          <button onClick={() => navigate('/projects')}>Go to Projects</button>
        </div>
      </div>
    );
  }

  const accuracyRate = projectData.accuracyRate || 0;
  const contentRemaining = projectData.questionCount > 0 
    ? Math.round(((projectData.questionCount - projectData.answeredCount) / projectData.questionCount) * 100)
    : 0;
  const averageConsistency = consistencyData.length > 0
    ? Math.round(consistencyData.reduce((sum, day) => sum + day.consistency, 0) / consistencyData.length)
    : 0;

  return (
    <div className="dashboard-screen">
      <Navbar />
      <div className="dashboard-header">
        <div className="dashboard-title-section">
          <h1 className="dashboard-title">Dashboard - {projectData.name}</h1>
          <div className="dashboard-elephant-group">
            <img 
              src={`/elephant${currentElephant}.png`} 
              alt="Elephant" 
              className="dashboard-elephant"
              key={currentElephant}
            />
            <ChatBubble 
              message={`You're doing great! Your accuracy is ${accuracyRate}%`} 
              position="left"
            />
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="stats-grid">
          <div className="stat-card">
            <h3 className="stat-title">Questions Correct</h3>
            <div className="stat-value">{accuracyRate}%</div>
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
            <div className="stat-value">{averageConsistency}%</div>
            <p className="stat-description">Average daily consistency</p>
          </div>

          <div className="stat-card">
            <h3 className="stat-title">Content Remaining</h3>
            <div className="stat-value">{contentRemaining}%</div>
            <p className="stat-description">Content left to be tested</p>
          </div>

          <div className="stat-card">
            <h3 className="stat-title">Total Questions</h3>
            <div className="stat-value">{projectData.questionCount || 0}</div>
            <p className="stat-description">{projectData.answeredCount || 0} questions completed</p>
          </div>
        </div>

        <div className="chart-section">
          <div className="chart-card">
            <h3 className="chart-title">Performance Trends</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={consistencyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="name" stroke="#1a1a4a" />
                  <YAxis stroke="#1a1a4a" domain={[0, 100]} />
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
                    name="Accuracy %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Study Plan Section */}
        <div className="study-plan-section">
          <div className="study-plan-card">
            <div className="study-plan-header">
              <h3 className="study-plan-title">📚 Personalized Study Plan</h3>
              {!studyPlan && projectData.answeredCount > 0 && (
                <button 
                  className="generate-study-plan-btn"
                  onClick={generateStudyPlan}
                  disabled={studyPlanLoading}
                >
                  {studyPlanLoading ? 'Generating...' : 'Generate Study Plan'}
                </button>
              )}
              {studyPlan && (
                <button 
                  className="generate-study-plan-btn"
                  onClick={generateStudyPlan}
                  disabled={studyPlanLoading}
                >
                  {studyPlanLoading ? 'Regenerating...' : 'Refresh Plan'}
                </button>
              )}
            </div>
            
            {studyPlanError && (
              <div className="study-plan-error">
                <p><strong>Error:</strong> {studyPlanError}</p>
                {studyPlanError.includes('server') || studyPlanError.includes('endpoint') ? (
                  <p style={{ marginTop: '10px', fontSize: '14px' }}>
                    Make sure the backend server is running on port 3001. You can start it with: <code>node server.js</code>
                  </p>
                ) : studyPlanError.includes('performance data') || studyPlanError.includes('answer') ? (
                  <p style={{ marginTop: '10px', fontSize: '14px' }}>
                    Answer some questions via iMessage first, then try generating the study plan again.
                  </p>
                ) : null}
              </div>
            )}
            
            {studyPlanLoading && !studyPlan && (
              <div className="study-plan-loading">
                <p>Generating your personalized study plan... This may take a moment.</p>
              </div>
            )}
            
            {studyPlan ? (
              <div className="study-plan-content">
                <StudyPlanTimeline studyPlan={studyPlan} projectData={projectData} />
                <div className="study-plan-note">
                  <p>💡 <em>
                    {projectData.studyPlanSent || projectData.studyPlan?.sentAt ? (
                      <>Your full personalized study plan has been sent to your phone. Check your messages for detailed study strategies and recommendations.</>
                    ) : (
                      <>Your full personalized study plan has been generated. {studyPlanLoading ? 'Sending to your phone...' : 'If it hasn\'t arrived, make sure the backend server has iMessage access enabled.'}</>
                    )}
                  </em></p>
                </div>
              </div>
            ) : !studyPlanLoading && projectData.answeredCount === 0 ? (
              <div className="study-plan-empty">
                <p>Answer some questions first to generate a personalized study plan based on your performance.</p>
              </div>
            ) : !studyPlanLoading && projectData.answeredCount > 0 ? (
              <div className="study-plan-empty">
                <p>Click "Generate Study Plan" to create a personalized study plan based on your performance.</p>
              </div>
            ) : null}
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

