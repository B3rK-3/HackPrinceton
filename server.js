// server.js
const express = require("express");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { loadEnvFile } = require("node:process");
const sqlite3 = require("sqlite3").verbose();
const {PDFParse}= require("pdf-parse");
const cors = require("cors"); // Import the cors middleware
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { IMessageSDK } = require("@photon-ai/imessage-kit");

loadEnvFile("./.env");

// Initialize Photon SDK for sending iMessages
const DEMO_PHONE_NUMBER = process.env.DEMO_PHONE_NUMBER || '+14047165833';
let iMessageSDK = null;

// Initialize iMessage SDK (only on macOS)
const os = require('os');
try {
    iMessageSDK = new IMessageSDK({
        debug: false,
        databasePath: os.homedir() + '/Library/Messages/chat.db',
    });
    console.log('✅ iMessage SDK initialized for sending messages');
} catch (error) {
    console.warn('⚠️ iMessage SDK not available (may not be on macOS or database not accessible):', error.message);
    console.warn('⚠️ Study plans will be generated but not automatically sent via iMessage');
}

const app = express();
const port = 3001;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cors());

// === Google OAuth setup ===
const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.SECRET;
const REDIRECT_URI = "http://localhost:3000/auth/callback";

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

// Scopes for Google Calendar
const scopes = ["https://www.googleapis.com/auth/calendar.readonly"];

const timesFilePath = "./available_times.json";
const coursesFilePath = "./courses_contents.json";
const questionsFilePath = "./questions.json";

// Initialize Gemini API
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const geminiModel = genAI ? genAI.getGenerativeModel({ model: "gemini-2.0-flash" }) : null;
// === SQLite3 (callback API) setup ===
const db = new sqlite3.Database(path.join(__dirname, "users.db"));

// Ensure schema and WAL mode
db.serialize(() => {
    db.run("PRAGMA journal_mode = WAL");
    db.run(
        `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
    );
});

function writeTokensFile(JSON_PATH, obj) {
    try {
        fs.writeFileSync(JSON_PATH, JSON.stringify(obj, null, 2));
    } catch (e) {
        console.error("Failed to write tokens file:", e);
    }
}

// ======== ROUTES ========

// Landing: generate Google auth URL (manual testing)
app.get("/", (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: scopes,
        prompt: "consent",
    });
    res.send(`<h1>Google Calendar Integration</h1>
    <p>Use POST <code>/auth</code> with <code>{ "userId": "...", "code": "..." }</code> after you obtain the OAuth <code>code</code>.</p>
    <p>For manual test (no userId mapping), you can use this link to get a code then call <code>/auth/callback?code=...</code>:</p>
    <a href="${url}">Connect your Google Calendar (manual test)</a>`);
});

// --- Auth: POST ---
// Body: { userId: "<uuidv4>", code: "<google_oauth_code>" }
app.post("/auth", async (req, res) => {
    const { userId, code } = req.body || {};
    if (!userId || !code) {
        return res
            .status(400)
            .json({ error: "Missing required fields: userId, code" });
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);
        const store = readTokensFile(TOKENS_PATH);
        store[userId] = tokens; // { "<uuid>": { google tokens } }
        writeTokensFile(TOKENS_PATH, store);

        oauth2Client.setCredentials(tokens);
        const [startDate, events, finalDate] = await getWeeklyEvents(
            oauth2Client
        );

        let freeTimes = await getFreeTimeFrames(startDate, events, finalDate);
        const times = readTokensFile(timesFilePath);
        times[userId] = freeTimes;
        writeTokensFile(timesFilePath, times);

        return res.json({
            ok: true,
            userId,
            hasRefreshToken: Boolean(tokens.refresh_token),
        });
    } catch (err) {
        console.error(
            "Error exchanging code for tokens:",
            err?.response?.data || err
        );
        return res
            .status(500)
            .json({ error: "Failed to exchange code for tokens" });
    }
});

// --- Auth: GET callback (manual testing) ---
app.get("/auth/callback", async (req, res) => {
    const userId = 1;
    const code = req.query.code;
    if (!code) return res.status(400).send("Missing ?code=...");

    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        const [startDate, events, finalDate] = await getWeeklyEvents(
            oauth2Client
        );

        let freeTimes = await getFreeTimeFrames(startDate, events, finalDate);
        const times = readTokensFile(timesFilePath);
        times[userId] = freeTimes;
        writeTokensFile(timesFilePath, times);

        const list = events
            .map((e) => `<li>${e.summary || "(no title)"} — ${e.start}</li>`)
            .join("");

        res.send(`
      <h2>Manual test OK (tokens not stored; use POST /auth to bind to a userId)</h2>
      <h3>Next-week events (${events.length})</h3>
      <ul>${list}</ul>
      <h3>Free slots (>=5min): ${freeTimes.length}</h3>
      <pre>${freeTimes
          .map(([s, e]) => `${s.toISOString()}  →  ${e.toISOString()}`)
          .join("\n")}</pre>
    `);
    } catch (err) {
        console.error("Error in /auth/callback:", err?.response?.data || err);
        res.status(500).send("Error during authentication callback");
    }
});

// --- REGISTER ---
// Body: { email, password } -> { id }
app.post("/register", async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        return res
            .status(400)
            .json({ error: "Missing required fields: email, password" });
    }

    try {
        const existing = await dbGet(
            "SELECT id, email, password FROM users WHERE email = ?",
            [email]
        );
        if (existing) {
            return res.json({ id: existing.id, created: false });
        }
        const id = uuidv4();
        await dbRun(
            "INSERT INTO users (id, email, password) VALUES (?, ?, ?)",
            [id, email, password]
        );
        return res.json({ id, created: true });
    } catch (err) {
        console.error("Register error:", err);
        return res.status(500).json({ error: "Failed to register user" });
    }
});

// --- SIGN IN ---
// Body: { email, password } -> { id }
app.post("/signin", async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        return res
            .status(400)
            .json({ error: "Missing required fields: email, password" });
    }

    try {
        const user = await dbGet(
            "SELECT id, email, password FROM users WHERE email = ?",
            [email]
        );
        if (!user || user.password !== password) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        return res.json({ id: user.id });
    } catch (err) {
        console.error("Signin error:", err);
        return res.status(500).json({ error: "Failed to sign in" });
    }
});

// --- TEST: fetch weekly events for a given userId ---
// Body: { userId }
app.post("/test", async (req, res) => {
    const { userId } = req.body || {};
    if (!userId)
        return res
            .status(400)
            .json({ error: "Missing required field: userId" });

    const store = readTokensFile(TOKENS_PATH);
    const tokens = store[userId];
    if (!tokens)
        return res.status(404).json({
            error: "No tokens stored for this userId. POST /auth first.",
        });

    try {
        oauth2Client.setCredentials(tokens);
        const [startDate, events, finalDate] = await getWeeklyEvents(
            oauth2Client
        );
        const freeTimes = await getFreeTimeFrames(startDate, events, finalDate);
        return res.json({ events, freeTimes });
    } catch (err) {
        console.error("Error fetching events:", err?.response?.data || err);
        return res.status(500).json({ error: "Failed to fetch events" });
    }
});

/**
 * Generate study questions from course content using Gemini API
 */
async function generateQuestions(courseContent, numQuestions = 5) {
    if (!geminiModel) {
        console.error("Gemini API not initialized. Check GEMINI_API_KEY in .env");
        return [];
    }

    try {
        const prompt = `You are an educational assistant creating active recall questions for students. 
Based on the following course material, generate exactly ${numQuestions} study questions that test understanding and promote active recall.

Course Material:
${courseContent.substring(0, 8000)} 

Generate ${numQuestions} questions in JSON format. Each question should have:
- "id": unique identifier (q1, q2, etc.)
- "question": the question text
- "topic": the main topic/chapter this question covers
- "expectedAnswer": a brief expected answer/key points

Return ONLY a JSON array, no other text. Format:
[
  {
    "id": "q1",
    "question": "What is...?",
    "topic": "Chapter 1: Introduction",
    "expectedAnswer": "The answer is..."
  },
  ...
]`;

        console.log("🤖 Generating questions using Gemini API...");
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        let responseText = response.text().trim();

        // Clean up response - remove markdown code blocks if present
        responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

        // Parse JSON
        const questions = JSON.parse(responseText);
        console.log(`✅ Generated ${questions.length} questions`);
        return Array.isArray(questions) ? questions : [];
    } catch (error) {
        console.error("❌ Error generating questions:", error.message);
        // Return empty array on error
        return [];
    }
}

/**
 * POST /study-plan/:courseId
 * Generate a study plan for a specific course
 */
app.post("/study-plan/:courseId", async (req, res) => {
    try {
        const { courseId } = req.params;
        console.log(`📚 Generating study plan for courseId: ${courseId}`);

        // Load questions and courses data
        const questionsData = readTokensFile(questionsFilePath);
        const coursesData = readTokensFile(coursesFilePath);

        const course = questionsData[courseId];
        if (!course) {
            return res.status(404).json({ error: "Course not found" });
        }

        // Check if there's performance data
        const performance = course.questionPerformance || {};
        if (Object.keys(performance).length === 0) {
            console.log(`⚠️ No performance data for course ${courseId}`);
            return res.status(400).json({ 
                error: "Not enough performance data",
                message: "Please answer some questions first before generating a study plan. You need to answer at least one question to generate a personalized study plan."
            });
        }
        
        console.log(`✅ Found ${Object.keys(performance).length} performance entries for course ${courseId}`);

        // Generate study plan using Gemini API
        if (!geminiModel) {
            return res.status(500).json({ error: "Gemini API not initialized" });
        }

        const courseContent = coursesData[courseId] || "";
        const questions = course.questions || [];
        
        // Analyze performance data (similar to autoreply-bot.js)
        const topicsPerformance = {};
        for (const question of questions) {
            const perf = performance[question.id];
            const topic = question.topic || 'Unknown';
            
            if (!topicsPerformance[topic]) {
                topicsPerformance[topic] = { correct: 0, incorrect: 0, unanswered: 0 };
            }
            
            if (perf) {
                if (perf.correct) {
                    topicsPerformance[topic].correct++;
                } else {
                    topicsPerformance[topic].incorrect++;
                }
            } else {
                topicsPerformance[topic].unanswered++;
            }
        }

        const totalAnswered = Object.keys(performance).length;
        const totalCorrect = Object.values(performance).filter(p => p.correct).length;
        const totalIncorrect = totalAnswered - totalCorrect;
        const accuracyRate = totalAnswered > 0 
            ? Math.round((totalCorrect / totalAnswered) * 100) 
            : 0;

        const weakTopics = Object.entries(topicsPerformance)
            .filter(([topic, stats]) => stats.incorrect > stats.correct && stats.incorrect > 0)
            .map(([topic]) => topic);

        const uncoveredTopics = Object.entries(topicsPerformance)
            .filter(([topic, stats]) => stats.unanswered > 0)
            .map(([topic]) => topic);

        const prompt = `You are an educational assistant creating a personalized study plan for a student.

Course Content Summary (first 6000 characters):
${courseContent.substring(0, 6000)}

Student Performance Summary:
- Total Questions Answered: ${totalAnswered}
- Correct Answers: ${totalCorrect}
- Incorrect Answers: ${totalIncorrect}
- Accuracy Rate: ${accuracyRate}%

Topics Needing More Practice: ${weakTopics.length > 0 ? weakTopics.join(', ') : 'None identified yet'}
Topics Not Yet Covered: ${uncoveredTopics.length > 0 ? uncoveredTopics.join(', ') : 'None'}

Create a concise, personalized study plan (aim for 500-800 words max) that includes:
1. Brief performance summary (2-3 sentences)
2. Top 3-5 priority areas to focus on
3. **Recommended Study Schedule** - Include a clear schedule section with specific timelines (e.g., "Review X topic in 2 days", "Practice Y concept daily for the next week")
4. Key topics to review (bullet points)
5. 3-4 study strategies/tips

IMPORTANT: Make sure to include a clear "Recommended Study Schedule" or "Study Timeline" section that specifies when to review different topics (e.g., days, weeks). This section should be easy to identify and extract.

Format as a single, well-structured message. Be concise and actionable - focus on the most important recommendations. Use markdown formatting for headings, bullet points, and emphasis.`;

        console.log("🤖 Generating study plan using Gemini API...");
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        let responseText = response.text().trim();

        // Store study plan in course data (optional - for caching)
        if (!course.studyPlan) {
            course.studyPlan = {};
        }
        course.studyPlan.text = responseText;
        course.studyPlan.generatedAt = new Date().toISOString();
        questionsData[courseId] = course;
        writeTokensFile(questionsFilePath, questionsData);

        // Send study plan via iMessage if SDK is available
        let sentViaMessage = false;
        if (iMessageSDK) {
            try {
                // Use phone number from course data, or fall back to DEMO_PHONE_NUMBER
                const phoneNumber = course.phoneNumber || DEMO_PHONE_NUMBER;
                
                // Send study plan as one complete message
                // iMessage will handle long messages automatically, but we'll send it as-is
                await iMessageSDK.send(phoneNumber, responseText);
                console.log(`✅ Sent study plan to ${phoneNumber} via iMessage (${responseText.length} characters)`);
                sentViaMessage = true;
                
                // Mark as sent
                course.studyPlan.sentAt = new Date().toISOString();
                questionsData[courseId] = course;
                writeTokensFile(questionsFilePath, questionsData);
            } catch (error) {
                console.error('❌ Error sending study plan via iMessage:', error.message);
                console.error('Error details:', error);
                
                // Try to send a shorter version if the message is too long
                if (error.message && (error.message.includes('length') || error.message.includes('too long') || error.message.includes('limit'))) {
                    try {
                        const phoneNumber = course.phoneNumber || DEMO_PHONE_NUMBER;
                        const shortenedPlan = responseText.substring(0, 20000) + '\n\n[Study plan truncated due to length limits. Full plan available in dashboard.]';
                        await iMessageSDK.send(phoneNumber, shortenedPlan);
                        console.log(`✅ Sent shortened study plan to ${phoneNumber} via iMessage`);
                        sentViaMessage = true;
                        
                        course.studyPlan.sentAt = new Date().toISOString();
                        course.studyPlan.truncated = true;
                        questionsData[courseId] = course;
                        writeTokensFile(questionsFilePath, questionsData);
                    } catch (retryError) {
                        console.error('❌ Error sending shortened study plan:', retryError.message);
                        // Send a notification that study plan is available
                        try {
                            const phoneNumber = course.phoneNumber || DEMO_PHONE_NUMBER;
                            await iMessageSDK.send(phoneNumber, 
                                "📚 Your personalized study plan has been generated! Check your dashboard to view the complete plan."
                            );
                            console.log(`✅ Sent study plan notification to ${phoneNumber}`);
                            sentViaMessage = true;
                        } catch (notifError) {
                            console.error('❌ Error sending notification:', notifError.message);
                        }
                    }
                }
                // Continue even if sending fails - the study plan is still generated and available in dashboard
            }
        } else {
            console.warn('⚠️ iMessage SDK not available - study plan generated but not sent');
            console.warn('⚠️ Make sure autoreply-bot.js is running or the SDK is properly initialized');
        }

        return res.json({ 
            studyPlan: responseText,
            generatedAt: course.studyPlan.generatedAt,
            sentViaMessage: sentViaMessage
        });
    } catch (error) {
        console.error("❌ Error generating study plan:", error);
        return res.status(500).json({
            error: "Failed to generate study plan",
            details: error.message,
        });
    }
});

/**
 * GET /study-plan/:courseId
 * Get existing study plan for a course (if available)
 */
app.get("/study-plan/:courseId", (req, res) => {
    try {
        const { courseId } = req.params;
        const questionsData = readTokensFile(questionsFilePath);
        const course = questionsData[courseId];

        if (!course) {
            return res.status(404).json({ error: "Course not found" });
        }

        if (course.studyPlan && course.studyPlan.text) {
            return res.json({
                studyPlan: course.studyPlan.text,
                generatedAt: course.studyPlan.generatedAt
            });
        }

        return res.status(404).json({ 
            error: "Study plan not found",
            message: "No study plan has been generated yet. Generate one first."
        });
    } catch (error) {
        console.error("❌ Error fetching study plan:", error);
        return res.status(500).json({
            error: "Failed to fetch study plan",
            details: error.message,
        });
    }
});

/**
 * GET /project/:courseId
 * Get detailed project data for a specific course
 */
app.get("/project/:courseId", (req, res) => {
    try {
        const { courseId } = req.params;
        console.log(`📊 Fetching project details for courseId: ${courseId}`);

        // Load questions and courses data
        const questionsData = readTokensFile(questionsFilePath);
        const coursesData = readTokensFile(coursesFilePath);

        const course = questionsData[courseId];
        if (!course) {
            return res.status(404).json({ error: "Project not found" });
        }

        // Calculate detailed performance metrics
        const performance = course.questionPerformance || {};
        const totalQuestions = course.questions.length || 0;
        const answeredQuestions = course.answeredQuestions.length || 0;
        const correctAnswers = Object.values(performance).filter(p => p.correct).length;
        const incorrectAnswers = Object.values(performance).filter(p => !p.correct).length;
        const accuracyRate = answeredQuestions > 0 
            ? Math.round((correctAnswers / answeredQuestions) * 100) 
            : 0;

        // Calculate topic-wise performance
        const topicPerformance = {};
        course.questions.forEach((question) => {
            const topic = question.topic || 'Unknown';
            if (!topicPerformance[topic]) {
                topicPerformance[topic] = { total: 0, correct: 0, incorrect: 0, unanswered: 0 };
            }
            topicPerformance[topic].total++;
            const perf = performance[question.id];
            if (perf) {
                if (perf.correct) {
                    topicPerformance[topic].correct++;
                } else {
                    topicPerformance[topic].incorrect++;
                }
            } else {
                topicPerformance[topic].unanswered++;
            }
        });

        // Get course content
        const courseContent = coursesData[courseId] || "";

        // Generate project name (use stored title if available, otherwise extract from content)
        let projectName = course.projectTitle || `Course ${courseId.substring(0, 8)}`;
        if (!course.projectTitle && courseContent.length > 0) {
            const firstLines = courseContent.split('\n').slice(0, 5).join(' ');
            const titleMatch = firstLines.match(/(.{20,80})/);
            if (titleMatch) {
                projectName = titleMatch[1].trim().substring(0, 50);
            }
        }

        return res.json({
            id: courseId,
            courseId: courseId,
            name: projectName,
            projectTitle: course.projectTitle || null,
            knowledgeLevel: course.knowledgeLevel || null,
            createdAt: course.createdAt || new Date().toISOString(),
            questionCount: totalQuestions,
            answeredCount: answeredQuestions,
            correctCount: correctAnswers,
            incorrectCount: incorrectAnswers,
            accuracyRate: accuracyRate,
            courseContent: courseContent,
            questions: course.questions || [],
            performance: performance,
            topicPerformance: topicPerformance,
            currentQuestionIndex: course.currentQuestionIndex || 0,
            readyToSend: course.readyToSend || false,
            studyPlan: course.studyPlan || null,
            studyPlanSent: course.studyPlan && course.studyPlan.sentAt ? true : false
        });
    } catch (error) {
        console.error("❌ Error fetching project details:", error);
        return res.status(500).json({
            error: "Failed to fetch project details",
            details: error.message,
        });
    }
});

/**
 * GET /projects/:userId
 * Get all projects for a user with live data
 */
app.get("/projects/:userId", (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`📊 Fetching projects for userId: ${userId}`);

        // Load questions and courses data
        const questionsData = readTokensFile(questionsFilePath);
        const coursesData = readTokensFile(coursesFilePath);

        // Find all courses for this user
        const userProjects = [];
        for (const courseId in questionsData) {
            const course = questionsData[courseId];
            if (course.userId === userId) {
                // Calculate performance metrics
                const performance = course.questionPerformance || {};
                const totalQuestions = course.questions.length || 0;
                const answeredQuestions = course.answeredQuestions.length || 0;
                const correctAnswers = Object.values(performance).filter(p => p.correct).length;
                const incorrectAnswers = Object.values(performance).filter(p => !p.correct).length;
                const accuracyRate = answeredQuestions > 0 
                    ? Math.round((correctAnswers / answeredQuestions) * 100) 
                    : 0;

                // Get course content preview
                const courseContent = coursesData[courseId] || "";
                const contentPreview = courseContent.substring(0, 100) + "...";

                // Generate project name from course content or use courseId
                let projectName = `Course ${courseId.substring(0, 8)}`;
                if (courseContent.length > 0) {
                    // Try to extract a title from the first few lines
                    const firstLines = courseContent.split('\n').slice(0, 5).join(' ');
                    const titleMatch = firstLines.match(/(.{20,80})/);
                    if (titleMatch) {
                        projectName = titleMatch[1].trim().substring(0, 50);
                    }
                }

                userProjects.push({
                id: courseId,
                courseId: courseId,
                name: course.projectTitle || projectName,
                projectTitle: course.projectTitle || null,
                knowledgeLevel: course.knowledgeLevel || null,
                createdAt: course.createdAt || new Date().toISOString(),
                questionCount: totalQuestions,
                answeredCount: answeredQuestions,
                correctCount: correctAnswers,
                incorrectCount: incorrectAnswers,
                accuracyRate: accuracyRate,
                courseMaterial: contentPreview,
                schedule: "Scheduled via iMessage", // This could be enhanced
                currentQuestionIndex: course.currentQuestionIndex || 0,
                readyToSend: course.readyToSend || false
            });
            }
        }

        // Sort by creation date (newest first)
        userProjects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        console.log(`✅ Found ${userProjects.length} projects for userId: ${userId}`);
        return res.json({ projects: userProjects });
    } catch (error) {
        console.error("❌ Error fetching projects:", error);
        return res.status(500).json({
            error: "Failed to fetch projects",
            details: error.message,
        });
    }
});

/**
 * POST /schedule
 * Body: {
 *   "userId": "string",
 *   "pdfs": ["<base64 pdf data>", ...]
 * }
 */
app.post("/schedule", async (req, res) => {
    try {
        const { userId, userInput, pdfs, projectTitle, knowledgeLevel, phoneNumber } = req.body;
        console.log("📄 Received PDF upload request for userId:", userId);

        // For demo purposes, generate a userId if not provided
        let finalUserId = userId;
        if (!finalUserId) {
            finalUserId = `demo-user-${uuidv4()}`;
            console.log(`⚠️ No userId provided, generated demo userId: ${finalUserId}`);
        }

        if (!pdfs || !Array.isArray(pdfs) || pdfs.length === 0) {
            return res
                .status(400)
                .json({ error: "Missing pdfs array" });
        }

        // Generate a new course ID
        const courseId = uuidv4();
        console.log("📚 Generated courseId:", courseId);

        // Extract text from all PDFs using PDFParse
        let allExtractedText = "";
        
        // Process each PDF (using for...of to properly handle async/await)
        for (const pdfBase64 of pdfs) {
            try {
                // Convert Base64 to Buffer (atob is browser-only, Buffer.from works in Node.js)
                const pdfBuffer = Buffer.from(pdfBase64, "base64");
                
                // Extract text from PDF using PDFParse constructor
                const parser = new PDFParse({ data: pdfBuffer });
                const extractedText = await parser.getText();
                
                // getText() may return text directly or an object, handle both cases
                const text = typeof extractedText === 'string' 
                    ? extractedText 
                    : (extractedText?.text || String(extractedText));
                
                allExtractedText += text.trim() + "\n\n";
                console.log(`✅ Extracted ${text.trim().length} characters from PDF`);
            } catch (pdfError) {
                console.error("❌ Error parsing PDF:", pdfError.message);
                // Continue with other PDFs
            }
        }

        // Store course content
        const courses = readTokensFile(coursesFilePath);
        courses[courseId] = allExtractedText;
        writeTokensFile(coursesFilePath, courses);
        console.log("💾 Stored course content in courses_contents.json");

        // Generate questions using Gemini API
        const questions = await generateQuestions(allExtractedText, 5);
        
        if (questions.length === 0) {
            return res.status(500).json({
                error: "Failed to generate questions",
                courseId,
            });
        }

        // Store questions in questions.json
        const questionsData = readTokensFile(questionsFilePath);
        questionsData[courseId] = {
            userId: finalUserId,
            courseId,
            projectTitle: projectTitle || null,
            knowledgeLevel: knowledgeLevel || null,
            phoneNumber: phoneNumber || null,
            questions: questions,
            answeredQuestions: [],
            questionPerformance: {}, // Initialize performance tracking
            currentQuestionIndex: 0,
            createdAt: new Date().toISOString(),
            readyToSend: true, // Flag to indicate questions are ready to send
        };
        writeTokensFile(questionsFilePath, questionsData);
        console.log(`✅ Stored ${questions.length} questions in questions.json`);
        if (projectTitle) {
            console.log(`📝 Project title: ${projectTitle}`);
        }
        if (knowledgeLevel !== undefined) {
            console.log(`📊 Knowledge level: ${knowledgeLevel}%`);
        }
        if (phoneNumber) {
            console.log(`📱 Phone number: ${phoneNumber}`);
        }

        res.json({
            userId: finalUserId,
            courseId,
            questionsGenerated: questions.length,
        });
    } catch (error) {
        console.error("❌ Error in /schedule:", error);
        res.status(500).json({
            error: "Failed to process schedule",
            details: error.message,
        });
    }
});

// ======== ERROR HANDLING MIDDLEWARE ========
// Handle 404 errors
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        path: req.path,
        method: req.method
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// ======== SERVER ========
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

// ======== Calendar helpers =========
async function getWeeklyEvents(oauth2Client) {
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const startOfWeek = new Date();
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const calendarListRes = await calendar.calendarList.list();
    const calendars = calendarListRes.data.items || [];

    let eventTimes = [];
    for (const cal of calendars) {
        let nextPageToken = null;
        do {
            const res = await calendar.events.list({
                calendarId: cal.id,
                timeMin: startOfWeek.toISOString(),
                timeMax: endOfWeek.toISOString(),
                singleEvents: true,
                orderBy: "startTime",
                maxResults: 2500,
                pageToken: nextPageToken || undefined,
            });

            const events = res.data.items || [];
            const timeEntries = events
                .filter((e) => e.start?.dateTime && e.end?.dateTime)
                .map((e) => ({
                    s: e.start.dateTime,
                    e: e.end.dateTime,
                    summary: e.summary,
                    start: e.start.dateTime,
                    end: e.end.dateTime,
                }));

            eventTimes.push(...timeEntries);
            nextPageToken = res.data.nextPageToken;
        } while (nextPageToken);
    }

    return [startOfWeek, eventTimes, endOfWeek];
}

function getFreeTimeFrames(startDate, events, finalDate) {
    if (!events || events.length === 0) return [[startDate, finalDate]];

    const sorted = [...events].sort((a, b) => new Date(a.s) - new Date(b.s));

    const freeTimes = [];
    // before first event
    freeTimes.push([startDate, new Date(sorted[0].s)]);

    let endTime = new Date(sorted[0].e);
    for (let i = 1; i < sorted.length; i++) {
        const s = new Date(sorted[i].s);
        if (s > endTime) freeTimes.push([endTime, s]);
        const e = new Date(sorted[i].e);
        if (e > endTime) endTime = e;
    }
    // after last event
    freeTimes.push([endTime, finalDate]);

    // keep >= 5 minutes
    return freeTimes.filter(([s, e]) => (e - s) / 60000 >= 5);
}

// 1) Evenly place N timestamps across the free time intervals
function scheduleEventsEvenly(freeTimes, numEvents) {
    if (numEvents <= 0 || freeTimes.length === 0) return [];

    const totalFreeMs = freeTimes.reduce((acc, [s, e]) => acc + (e - s), 0);
    const scheduled = [];
    const intervalMs = totalFreeMs / numEvents;

    let timeAccum = 0;
    let idx = 0;

    for (let i = 0; i < numEvents; i++) {
        const target = i * intervalMs;

        while (
            idx < freeTimes.length &&
            timeAccum + (freeTimes[idx][1] - freeTimes[idx][0]) < target
        ) {
            timeAccum += freeTimes[idx][1] - freeTimes[idx][0];
            idx++;
        }
        if (idx >= freeTimes.length) break;

        const [start, end] = freeTimes[idx];
        const offset = target - timeAccum;
        const eventTime = new Date(start.getTime() + offset);
        scheduled.push(eventTime);
    }

    return scheduled;
}

// 2) Remove a 5-minute block starting at each scheduled time from freeTimes
function removeScheduledBlocks(freeTimes, scheduledTimes, minutes = 5) {
    const blockMs = minutes * 60 * 1000;

    // subtract a single [a,b) block from one interval [s,e)
    function subtractOne(interval, block) {
        const [s, e] = interval;
        const [a, b] = block;

        // no overlap
        if (b <= s || a >= e) return [[s, e]];

        // full cover
        if (a <= s && b >= e) return [];

        // overlap at start
        if (a <= s && b < e) return [[b, e]];

        // overlap at end
        if (a > s && b >= e) return [[s, a]];

        // middle cut -> split
        // s < a < b < e
        return [
            [s, a],
            [b, e],
        ];
    }

    // merge touching/overlapping intervals
    function mergeIntervals(intervals) {
        if (intervals.length === 0) return [];
        const sorted = [...intervals].sort((x, y) => x[0] - y[0]);
        const res = [sorted[0]];
        for (let i = 1; i < sorted.length; i++) {
            const [cs, ce] = res[res.length - 1];
            const [ns, ne] = sorted[i];
            if (ns <= ce) {
                res[res.length - 1] = [cs, new Date(Math.max(ce, ne))];
            } else {
                res.push([ns, ne]);
            }
        }
        return res;
    }

    // Sequentially subtract each block
    let current = freeTimes.map(([s, e]) => [new Date(s), new Date(e)]);
    for (const t of scheduledTimes) {
        const a = new Date(t);
        const b = new Date(t.getTime() + blockMs);

        const next = [];
        for (const iv of current) {
            const pieces = subtractOne(iv, [a, b]);
            for (const p of pieces) next.push(p);
        }
        current = mergeIntervals(next);
    }

    // keep intervals >= 5 minutes (to mirror your getFreeTimeFrames filter)
    const minKeepMs = 5 * 60 * 1000;
    return current.filter(([s, e]) => e - s >= minKeepMs);
}

// ---- Convenience wrapper: schedules and prunes free times ----
function scheduleAndReserve(freeTimes, numEvents, minutesPerEvent = 5) {
    const scheduled = scheduleEventsEvenly(freeTimes, numEvents);
    const updatedFreeTimes = removeScheduledBlocks(
        freeTimes,
        scheduled,
        minutesPerEvent
    );
    return [scheduled, updatedFreeTimes];
}

// Promise helpers for sqlite3
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve(this); // has .lastID, .changes
        });
    });
}

// === tiny helpers ===
const TOKENS_PATH = path.join(__dirname, "user_tokens.json");

function readTokensFile(JSON_PATH) {
    try {
        if (!fs.existsSync(JSON_PATH)) return {};
        const raw = fs.readFileSync(JSON_PATH, "utf-8");
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        console.error("Failed to read tokens file:", e);
        return {};
    }
}
