import { IMessageSDK } from '@photon-ai/imessage-kit'
import { GoogleGenerativeAI } from '@google/generative-ai'
import dotenv from 'dotenv'
import os from 'os'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

// Load environment variables from .env file
dotenv.config()

// --- Constants ---
const DEMO_PHONE_NUMBER = '+14047165833'
const QUESTIONS_FILE_PATH = path.join(process.cwd(), 'questions.json')
const COURSES_FILE_PATH = path.join(process.cwd(), 'courses_contents.json')

// --- 1️⃣  Initialize Google Gemini API ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

if (!GEMINI_API_KEY) {
  console.error('❌ Error: GEMINI_API_KEY is not set in .env file')
  console.error('Please create a .env file with your Gemini API key')
  process.exit(1)
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
// Using gemini-2.0-flash for faster responses with latest model
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

// --- 2️⃣  Open local macOS iMessage database ---
const db = new Database(`${os.homedir()}/Library/Messages/chat.db`, { readonly: true })

// --- 3️⃣  Initialize Photon SDK ---
const sdk = new IMessageSDK({
  debug: true,
  databasePath: `${os.homedir()}/Library/Messages/chat.db`,
  watcher: {
    pollInterval: 2000,
    excludeOwnMessages: true,
  },
})

// --- 4️⃣  Decode message text from Apple's NSAttributedString blobs ---
function fetchMessageBodyFromDb(messageGuid) {
  try {
    const row = db
      .prepare('SELECT text, attributedBody FROM message WHERE guid = ? LIMIT 1')
      .get(messageGuid)

    if (!row) {
      console.log(`⚠️ No database row found for GUID: ${messageGuid}`)
      return null
    }

    // ✅ Case 1: Plain text stored directly
    if (row.text && row.text.trim() !== '') {
      return row.text
    }

    // ✅ Case 2: Decode from attributedBody (binary blob)
    if (row.attributedBody) {
      const buf = Buffer.from(row.attributedBody)
      const decoded = buf.toString('utf8')

      // 🧠 Try multiple patterns to catch text from all macOS versions
      let match =
        decoded.match(/NSString[^A-Za-z0-9]*([A-Za-z0-9+ _!?'",.:-]+)/) ||
        decoded.match(/\+([A-Za-z0-9 _!?'",.:-]+)/) ||
        decoded.match(/([A-Za-z]{2,}\s?[A-Za-z0-9!?'",.:-]*)/)

      if (match && match[1]) {
        const clean = match[1]
          .replace(/\+/g, '')
          .replace(/\u0000/g, '')
          .trim()
        if (clean.length > 0) return clean
      }

      console.log('🧪 Raw decoded preview (first 200 chars):', decoded.slice(0, 200))
    }
  } catch (err) {
    console.error('⚠️ DB fallback failed:', err.message)
  }
  return null
}

// --- 5️⃣  Read questions from JSON file ---
function loadQuestions() {
  try {
    if (!fs.existsSync(QUESTIONS_FILE_PATH)) {
      return {}
    }
    const data = fs.readFileSync(QUESTIONS_FILE_PATH, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('⚠️ Error loading questions:', error.message)
    return {}
  }
}

function saveQuestions(questionsData) {
  try {
    fs.writeFileSync(QUESTIONS_FILE_PATH, JSON.stringify(questionsData, null, 2))
  } catch (error) {
    console.error('⚠️ Error saving questions:', error.message)
  }
}

// --- Load courses content from JSON file ---
function loadCourses() {
  try {
    if (!fs.existsSync(COURSES_FILE_PATH)) {
      return {}
    }
    const data = fs.readFileSync(COURSES_FILE_PATH, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('⚠️ Error loading courses:', error.message)
    return {}
  }
}

// --- 6️⃣  Check for questions ready to send ---
async function checkAndSendQuestions() {
  const questionsData = loadQuestions()
  
  for (const courseId in questionsData) {
    const course = questionsData[courseId]
    
    // Check if questions are ready to send and first question hasn't been sent
    if (course.readyToSend && course.currentQuestionIndex === 0 && course.questions.length > 0) {
      const question = course.questions[0]
      
      // Use phone number from course data, or fall back to DEMO_PHONE_NUMBER
      const phoneNumber = course.phoneNumber || DEMO_PHONE_NUMBER
      
      // Send introduction message with first question
      const message = `Hello! Here are your questions:\n\n${question.question}`
      
      try {
        await sdk.send(phoneNumber, message)
        console.log(`✅ Sent first question to ${phoneNumber}`)
        console.log(`   Question: ${question.question.substring(0, 50)}...`)
        
        // Mark that first question was sent (by incrementing index)
        course.currentQuestionIndex = 1
        course.readyToSend = false // Don't send again automatically
        saveQuestions(questionsData)
      } catch (error) {
        console.error('❌ Error sending question:', error.message)
      }
    }
  }
}

// --- 7️⃣  Evaluate user's answer using Gemini ---
async function evaluateAnswer(userAnswer, question, expectedAnswer) {
  try {
    const prompt = `You are evaluating a student's answer to a study question.

Question: "${question}"

Expected Answer/Key Points: "${expectedAnswer}"

Student's Answer: "${userAnswer}"

Evaluate the answer and provide:
1. Is it correct? (yes/no)
2. A brief 1-2 sentence feedback explaining why it's correct or what they missed.

Format your response as JSON:
{
  "correct": true/false,
  "feedback": "Your feedback here"
}`

    console.log('🤖 Evaluating answer using Gemini API...')
    const result = await model.generateContent(prompt)
    const response = await result.response
    let responseText = response.text().trim()

    // Clean up response - remove markdown code blocks if present
    responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()

    // Parse JSON
    const evaluation = JSON.parse(responseText)
    return evaluation
  } catch (error) {
    console.error('❌ Error evaluating answer:', error.message)
    return {
      correct: false,
      feedback: "I couldn't evaluate your answer, but keep studying!"
    }
  }
}

// --- 8️⃣  Check if message is an answer to a question ---
function findPendingQuestion(questionsData, senderPhone) {
  // For demo, we'll check all courses for the demo phone number
  // In production, this would match by userId
  
  for (const courseId in questionsData) {
    const course = questionsData[courseId]
    
    // Check if there's a question waiting for an answer
    // If currentQuestionIndex > 0, it means a question was sent and we're waiting for answer
    if (course.currentQuestionIndex > 0 && course.currentQuestionIndex <= course.questions.length) {
      const currentQuestion = course.questions[course.currentQuestionIndex - 1]
      
      // Check if this question hasn't been answered yet
      if (!course.answeredQuestions.includes(currentQuestion.id)) {
        return {
          courseId,
          question: currentQuestion,
          course
        }
      }
    }
  }
  
  return null
}

// --- 9️⃣  Handle user's answer to a question ---
async function handleQuestionAnswer(message, pendingQuestion) {
  const { courseId, question, course } = pendingQuestion
  
  console.log(`📝 User answered question: ${question.id}`)
  console.log(`   Answer: ${message.text.substring(0, 100)}...`)
  
  // Use phone number from course data, or fall back to sender
  const phoneNumber = course.phoneNumber || message.sender
  
  // Evaluate the answer
  const evaluation = await evaluateAnswer(
    message.text,
    question.question,
    question.expectedAnswer
  )
  
  // Send feedback
  const feedbackMessage = evaluation.correct
    ? `✅ Correct! ${evaluation.feedback}`
    : `❌ Not quite. ${evaluation.feedback}`
  
  try {
    await sdk.send(phoneNumber, feedbackMessage)
    console.log(`✅ Sent feedback to ${phoneNumber}`)
    
    // Mark question as answered and track performance
    const questionsData = loadQuestions()
    if (questionsData[courseId]) {
      questionsData[courseId].answeredQuestions.push(question.id)
      
      // Initialize questionPerformance if it doesn't exist
      if (!questionsData[courseId].questionPerformance) {
        questionsData[courseId].questionPerformance = {}
      }
      
      // Store performance data for this question
      questionsData[courseId].questionPerformance[question.id] = {
        correct: evaluation.correct,
        answeredAt: new Date().toISOString(),
        topic: question.topic || 'Unknown'
      }
      
      saveQuestions(questionsData)
      console.log(`📊 Marked question ${question.id} as answered (${evaluation.correct ? 'correct' : 'incorrect'})`)
    }
  } catch (error) {
    console.error('❌ Error sending feedback:', error.message)
  }
}

// --- 🔟  Check if user wants another question ---
function wantsAnotherQuestion(messageText) {
  const text = messageText.toLowerCase()
  return /(another|more|next|another question|more questions|send.*question)/i.test(text)
}

// --- Check if user wants a study plan ---
function wantsStudyPlan(messageText) {
  const text = messageText.toLowerCase()
  return /(study plan|create.*study plan|generate.*study plan|help me study|what should i study|i need.*study plan)/i.test(text)
}

// --- Generate study plan using Gemini API ---
async function generateStudyPlan(courseId, questionsData, coursesData) {
  try {
    const course = questionsData[courseId]
    if (!course) {
      return "I couldn't find your course data. Please make sure you have answered some questions first."
    }
    
    const courseContent = coursesData[courseId] || ""
    const performance = course.questionPerformance || {}
    const questions = course.questions || []
    
    // Analyze performance data
    const correctQuestions = []
    const incorrectQuestions = []
    const topicsPerformance = {}
    
    for (const question of questions) {
      const perf = performance[question.id]
      if (perf) {
        if (perf.correct) {
          correctQuestions.push(question.topic || question.question.substring(0, 50))
        } else {
          incorrectQuestions.push(question.topic || question.question.substring(0, 50))
          // Track topics that need work
          const topic = perf.topic || question.topic || 'Unknown'
          if (!topicsPerformance[topic]) {
            topicsPerformance[topic] = { correct: 0, incorrect: 0 }
          }
          topicsPerformance[topic].incorrect++
        }
      } else {
        // Track topics that haven't been answered yet
        const topic = question.topic || 'Unknown'
        if (!topicsPerformance[topic]) {
          topicsPerformance[topic] = { correct: 0, incorrect: 0, unanswered: 0 }
        }
        topicsPerformance[topic].unanswered = (topicsPerformance[topic].unanswered || 0) + 1
      }
      
      // Also track correct answers by topic
      if (perf && perf.correct) {
        const topic = perf.topic || question.topic || 'Unknown'
        if (!topicsPerformance[topic]) {
          topicsPerformance[topic] = { correct: 0, incorrect: 0 }
        }
        topicsPerformance[topic].correct++
      }
    }
    
    // Build performance summary
    const totalAnswered = Object.keys(performance).length
    const totalCorrect = Object.values(performance).filter(p => p.correct).length
    const totalIncorrect = totalAnswered - totalCorrect
    const accuracyRate = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0
    
    // Identify weak areas (topics with more incorrect than correct)
    const weakTopics = Object.entries(topicsPerformance)
      .filter(([topic, stats]) => stats.incorrect > stats.correct && stats.incorrect > 0)
      .map(([topic]) => topic)
    
    // Identify topics not yet covered
    const uncoveredTopics = Object.entries(topicsPerformance)
      .filter(([topic, stats]) => stats.unanswered > 0)
      .map(([topic]) => topic)
    
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
3. Recommended study schedule (brief, actionable)
4. Key topics to review (bullet points)
5. 3-4 study strategies/tips

Format as a single, well-structured message. Be concise and actionable - focus on the most important recommendations.`

    console.log('🤖 Generating study plan using Gemini API...')
    const result = await model.generateContent(prompt)
    const response = await result.response
    let responseText = response.text().trim()
    
    return responseText
  } catch (error) {
    console.error('❌ Error generating study plan:', error.message)
    return "I encountered an error while generating your study plan. Please try again later."
  }
}

// --- 1️⃣1️⃣  Send next question if available ---
async function sendNextQuestion(courseId) {
  const questionsData = loadQuestions()
  const course = questionsData[courseId]
  
  if (!course) {
    console.error(`❌ Course ${courseId} not found`)
    return
  }
  
  // Use phone number from course data, or fall back to DEMO_PHONE_NUMBER
  const phoneNumber = course.phoneNumber || DEMO_PHONE_NUMBER
  
  if (course.currentQuestionIndex < course.questions.length) {
    const nextQuestion = course.questions[course.currentQuestionIndex]
    
    // Check if this question was already answered
    if (course.answeredQuestions.includes(nextQuestion.id)) {
      // Move to next unanswered question
      course.currentQuestionIndex++
      questionsData[courseId] = course
      saveQuestions(questionsData)
      
      if (course.currentQuestionIndex >= course.questions.length) {
        // All questions answered
        await sdk.send(phoneNumber, "🎉 Great job! You've answered all the questions. Keep up the studying!")
        return
      }
      return sendNextQuestion(courseId) // Recursively find next unanswered question
    }
    
    try {
      await sdk.send(phoneNumber, nextQuestion.question)
      console.log(`✅ Sent next question (${course.currentQuestionIndex + 1}/${course.questions.length})`)
      console.log(`   Question: ${nextQuestion.question.substring(0, 50)}...`)
      
      course.currentQuestionIndex++
      questionsData[courseId] = course
      saveQuestions(questionsData)
    } catch (error) {
      console.error('❌ Error sending next question:', error.message)
    }
  } else {
    // All questions sent
    await sdk.send(phoneNumber, "🎉 Great job! You've completed all questions. Keep studying!")
  }
}

// --- 1️⃣2️⃣  Process each incoming message ---
async function processMessage(message) {
  try {
    let text = message.text

    // If Photon gives empty message text, try direct DB decode
    if (!text || text.trim() === '') {
      text = fetchMessageBodyFromDb(message.guid)
      if (text) message.text = text
    }

    console.log(`📨 New message from ${message.sender}: ${text || '(still no text)'}`)

    if (!text || text.trim() === '') {
      console.log('⏭️  Skipping message (no text content)\n')
      return
    }

    // Check if this is from the demo phone number (user replies will come from this number)
    // Phone numbers can be in different formats, so check multiple formats
    const senderNormalized = message.sender.replace(/\D/g, '') // Remove non-digits
    const demoNormalized = DEMO_PHONE_NUMBER.replace(/\D/g, '')
    const isDemoNumber = senderNormalized === demoNormalized || 
                         message.sender.includes('4047165833') ||
                         message.sender.includes('+14047165833')
    
    if (isDemoNumber) {
      console.log(`📱 Message from demo number: ${message.sender}`)
      
      // Check if this is an answer to a pending question
      const questionsData = loadQuestions()
      const pendingQuestion = findPendingQuestion(questionsData, message.sender)
      
      if (pendingQuestion) {
        // This is an answer to a question
        console.log(`💬 Processing answer to question: ${pendingQuestion.question.id}`)
        await handleQuestionAnswer(message, pendingQuestion)
        return
      }
      
      // Check if user wants another question
      if (wantsAnotherQuestion(text)) {
        console.log(`📨 User requested another question`)
        const questionsData = loadQuestions()
        // Find the most recent course with unanswered questions
        let found = false
        for (const courseId in questionsData) {
          const course = questionsData[courseId]
          // Check if this course matches the sender's phone number
          const senderNormalized = message.sender.replace(/\D/g, '')
          const coursePhoneNormalized = (course.phoneNumber || DEMO_PHONE_NUMBER).replace(/\D/g, '')
          const matchesPhone = senderNormalized === coursePhoneNormalized || 
                               message.sender.includes(coursePhoneNormalized.substring(coursePhoneNormalized.length - 10))
          
          if (matchesPhone && course.currentQuestionIndex < course.questions.length) {
            await sendNextQuestion(courseId)
            found = true
            break
          }
        }
        if (!found) {
          // Use the sender's phone number for the response
          await sdk.send(message.sender, "All questions have been answered! Upload more content to get new questions.")
        }
        return
      }
      
      // Check if user wants a study plan
      if (wantsStudyPlan(text)) {
        console.log(`📚 User requested a study plan`)
        const questionsData = loadQuestions()
        const coursesData = loadCourses()
        
        // Find the most recent course that matches the sender's phone number
        let courseFound = false
        const senderNormalized = message.sender.replace(/\D/g, '')
        
        for (const courseId in questionsData) {
          const course = questionsData[courseId]
          // Check if this course matches the sender's phone number
          const coursePhoneNormalized = (course.phoneNumber || DEMO_PHONE_NUMBER).replace(/\D/g, '')
          const matchesPhone = senderNormalized === coursePhoneNormalized || 
                               message.sender.includes(coursePhoneNormalized.substring(coursePhoneNormalized.length - 10))
          
          // Only generate study plan if there's some performance data and phone matches
          if (matchesPhone && course.questionPerformance && Object.keys(course.questionPerformance).length > 0) {
            console.log(`📊 Generating study plan for course: ${courseId}`)
            const studyPlan = await generateStudyPlan(courseId, questionsData, coursesData)
            
            // Use phone number from course data, or fall back to sender
            const phoneNumber = course.phoneNumber || message.sender
            
            // Send study plan as one complete message
            // iMessage will handle long messages automatically
            try {
              await sdk.send(phoneNumber, studyPlan)
              console.log(`✅ Sent study plan as single message (${studyPlan.length} characters)`)
            } catch (error) {
              console.error('❌ Error sending study plan:', error.message)
              // If sending fails due to length, try a shorter version
              if (error.message && error.message.includes('length') || error.message && error.message.includes('too long')) {
                const shortenedPlan = studyPlan.substring(0, 20000) + '\n\n[Study plan truncated due to length limits]'
                await sdk.send(phoneNumber, shortenedPlan)
              } else {
                await sdk.send(phoneNumber, "I encountered an error sending your study plan. Please try again later.")
              }
            }
            courseFound = true
            break
          }
        }
        
        if (!courseFound) {
          // Use the sender's phone number for the response
          await sdk.send(message.sender, "I need some performance data to generate a study plan. Please answer a few questions first, then ask for a study plan!")
        }
        return
      }
      
      // If it's from demo number but not a question answer or request, just log it
      console.log('⏭️  Message from demo number but not a question answer\n')
      return
    }

    // For messages from other numbers, don't auto-reply (study bot mode)
    console.log('⏭️  Skipping message (not from demo number)\n')
  } catch (error) {
    if (!error.message?.includes('condition')) {
      console.error('❌ Error processing message:', error.message)
    }
  }
}

// --- 1️⃣3️⃣  Start watching for new messages ---
async function startBot() {
  console.log('🤖 Study Buddy Photon Bot starting...')
  console.log('📡 Watching for new messages...')
  console.log(`📱 Demo phone number: ${DEMO_PHONE_NUMBER}\n`)

  // Check for questions to send every 5 seconds
  const questionCheckInterval = setInterval(async () => {
    await checkAndSendQuestions()
  }, 5000) // Check every 5 seconds

  // Store interval ID for cleanup
  process.questionCheckInterval = questionCheckInterval

  // Initial check after 20 seconds (to allow time for question generation)
  setTimeout(async () => {
    console.log('⏰ Checking for questions to send (20 second delay)...')
    await checkAndSendQuestions()
  }, 20000) // 20 seconds delay

  await sdk.startWatching({
    onNewMessage: async (message) => await processMessage(message),
    onGroupMessage: async (message) =>
      console.log(`👥 Group message from ${message.sender} in chat ${message.chatId}`),
    onError: (error) => console.error('❌ Watcher error:', error),
  })

  console.log('✅ Bot is now actively watching for messages...')
  console.log('💡 Press Ctrl + C to stop\n')
}

// --- 1️⃣4️⃣  Graceful shutdown handler ---
process.on('SIGINT', async () => {
  console.log('\n🛑 Stopping bot...')
  
  // Clear question check interval
  if (process.questionCheckInterval) {
    clearInterval(process.questionCheckInterval)
  }
  
  sdk.stopWatching()
  await sdk.close()
  db.close()
  console.log('✅ Bot stopped')
  process.exit(0)
})

// --- 9️⃣  Launch the bot ---
startBot().catch((error) => {
  console.error('Failed to start bot:', error)
  process.exit(1)
})
