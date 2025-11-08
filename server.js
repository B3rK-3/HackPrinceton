const express = require("express");
const { google } = require("googleapis");
const fs = require("fs");
const { json } = require("stream/consumers");
const { start } = require("repl");

const app = express();
const port = 3000;

// Replace with your credentials
const CLIENT_ID =process.env.ID    ;
const CLIENT_SECRET = process.env.SECRET;
const REDIRECT_URI = "http://localhost:3000/auth";

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

// Scopes for Google Calendar
const scopes = ["https://www.googleapis.com/auth/calendar.readonly"];

// Route to start OAuth2 flow
app.get("/", (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: scopes,
    });
    res.send(`<h1>Google Calendar Integration</h1>
    <a href="${url}">Connect your Google Calendar</a>`);
});

app.get("/test", async (req, res) => {
    oauth2Client.setCredentials(
        JSON.parse(fs.readFileSync("user_tokens.json"))
    );
    const [startDate, events, finalDate] = await getWeeklyEvents(oauth2Client);
    const freeTimes = await getFreeTimeFrames(startDate, events, finalDate);
    res.send([events, freeTimes]);
});
// Callback route for handling OAuth2 response
app.get("/auth", async (req, res) => {
    const code = req.query.code;

    try {
        const { tokens } = await oauth2Client.getToken(code);
        let tokensData = JSON.parse(
            fs.readFileSync("user_tokens.json", "utf-8")
        );
        console.log(tokensData);
        tokensData = tokens;
        fs.writeFileSync("user_tokens.json", JSON.stringify(tokensData));
        oauth2Client.setCredentials(tokens);

        const events = await getWeeklyEvents(oauth2Client);
        if (!events || events.length === 0) {
            res.send("No upcoming events found.");
        } else {
            const list = events
                .map(
                    (e) =>
                        `<li>${e.summary} - ${
                            e.start.dateTime || e.start.date
                        }</li>`
                )
                .join("");
            res.send(
                `<h2>Your Upcoming Google Calendar Events:</h2><ul>${list}</ul>`
            );
        }
    } catch (err) {
        console.error("Error fetching tokens or calendar events:", err);
        res.status(500).send("Error during authentication");
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

async function getWeeklyEvents(oauth2Client) {
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // 🗓️ Calculate start (Now) and end (next week Now) of the current week
    const startOfWeek = new Date();

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    console.log(
        `📅 Fetching events between ${startOfWeek.toISOString()} and ${endOfWeek.toISOString()}`
    );

    // 1️⃣ Get all calendars
    const calendarListRes = await calendar.calendarList.list();
    const calendars = calendarListRes.data.items || [];

    let eventTimes = [];

    // 2️⃣ Fetch events for each calendar
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

            // Only include events that have dateTime fields
            const timeEntries = events
                .filter((e) => e.start?.dateTime && e.end?.dateTime)
                .map((e) => ({
                    s: e.start.dateTime,
                    e: e.end.dateTime,
                    summary: e.summary,
                }));

            eventTimes.push(...timeEntries);
            nextPageToken = res.data.nextPageToken;
        } while (nextPageToken);
    }

    console.log(`✅ Found ${eventTimes.length} events with valid dateTimes.`);
    return [startOfWeek, eventTimes, endOfWeek];
}
function getFreeTimeFrames(startDate, events, finalDate) {
    let freeTimes = []; // [[start, end], ...]
    freeTimes.push([startDate, new Date(events[0].s)])
    let size = events.length;
    let endTime = new Date(events[0].e);
    for (let i = 1; i < size; i++) {
        let s = new Date(events[i].s);
        freeTimes.push([endTime, s]);
        endTime = new Date(events[i].e);
    }
    freeTimes.push([endTime, finalDate]);

    let validFreeTimes = [];
    freeTimes.forEach(([s, e]) => {
        let freeTimeMinute = (e-s)/1000/60
        if (freeTimeMinute >= 5) {
            validFreeTimes.push([s,e])
        }
    })
    return validFreeTimes;
}
