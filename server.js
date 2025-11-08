// server.js
const express = require("express");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { loadEnvFile } = require("node:process");
const sqlite3 = require("sqlite3").verbose();
const pdfParse = require("pdf-parse");

loadEnvFile("./.env");

const app = express();
const port = 3000;

app.use(express.json());

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

        // let scheduled;
        // [scheduled, freeTimes] = scheduleAndReserve(freeTimes, 10, 5);
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
 * POST /schedule
 * Body: {
 *   "userId": "string",
 *   "pdf": "<base64 pdf data>",
 *   "schedule": "<base64 schedule data>"
 * }
 */
app.post("/schedule", async (req, res) => {
    try {
        //userinput is if the user has additional comments
        const { userId, userInput, pdf, schedule } = req.body;

        if (!userId) {
            return res
                .status(400)
                .json({ error: "Missing userId, pdf, or schedule" });
        }
        //all times for users
        const times = readTokensFile(timesFilePath);

        //schedule times for messages, updatedfreetimes and schedule times returned 
        let [scheduled, updatedFreeTimes] = scheduleAndReserve(times[userId], 10, 2);
        times[userId] = updatedFreeTimes;
        writeTokensFile(timesFilePath, times);

        // Generate a new course ID
        const courseId = uuidv4();

        // Convert Base64 to Buffer
        const pdfBuffer = Buffer.from(pdf, "base64");

        // Extract text from PDF
        const pdfData = await pdfParse(pdfBuffer);
        const extractedText = pdfData.text.trim();

        const scheduleBuffer = Buffer.from(schedule, "base64");



        //write to the courses file with the new course content
        const courses = readTokensFile(coursesFilePath);
        courses[courseId] = extractedText;
        writeTokensFile(coursesFilePath, courses);

        res.json({
            userId,
            courseId,
        });
    } catch (error) {
        console.error("Error in /schedule:", error);
        res.status(500).json({
            error: "Failed to process schedule",
            details: error.message,
        });
    }
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
