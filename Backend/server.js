const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fetch = require("node-fetch");
const admin = require("firebase-admin");

// Load environment variables from .env file
dotenv.config();

// Check for the API key on startup
if (!process.env.GEMINI_API_KEY) {
    console.error("FATAL ERROR: GEMINI_API_KEY is not defined in your .env file.");
    process.exit(1); // Stop the server if the key is missing
}

// Initialize Firebase Admin SDK
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());


// --- API ROUTES ---

// Endpoint to dynamically generate follow-up questions
app.post("/api/generate-question", async (req, res) => {
    const { history, firstSymptom } = req.body;
    if (!history) {
        return res.status(400).json({ error: "Conversation history is required" });
    }
    try {
        const API_KEY = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`;
        let prompt;

        if (history.length === 1 && firstSymptom) {
            prompt = `Analyze the following user input to determine if it is a plausible medical symptom. User input: "${firstSymptom}"\n\nIf it is NOT a plausible medical symptom, you MUST respond with the exact text: "INVALID_SYMPTOM".\nIf it IS a plausible medical symptom, act as a compassionate medical assistant and ask a single, relevant follow-up question to understand the symptom better. The question should be concise and easy to answer. Do NOT add any preamble or explanation. Just provide the question.`;
        } else {
            const conversationForPrompt = history.map(entry => `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.parts[0].text}`).join('\n');
            prompt = `You are a compassionate medical assistant continuing a conversation with a user about their symptoms. Based on the following conversation history, ask the SINGLE next most relevant follow-up question. The question must be concise and easy for the user to answer. Do NOT add any preamble or explanation.\n\nIMPORTANT: If you have enough information to proceed to an analysis (usually after 2-3 good follow-up questions), then DO NOT ask another question. Instead, YOU MUST RESPOND WITH THE EXACT TEXT 'ANALYSIS_READY' AND NOTHING ELSE.\n\nConversation History:\n${conversationForPrompt}`;
        }
        
        const geminiResponse = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });

        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.json();
            throw new Error(errorData.error?.message || "AI service error.");
        }

        const responseData = await geminiResponse.json();
        let nextQuestion = responseData.candidates[0].content.parts[0].text.trim();

        if (nextQuestion.includes("ANALYSIS_READY")) {
            nextQuestion = "ANALYSIS_READY";
        }
        
        res.json({ nextQuestion });
    } catch (err) {
        console.error("Error in /api/generate-question:", err);
        res.status(500).json({ error: err.message || "Failed to generate next question" });
    }
});

// Endpoint to get user profile data
app.get("/api/profile/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
        const userRef = db.collection('users').doc(userId);
        const doc = await userRef.get();
        if (!doc.exists) {
            return res.status(404).json({ error: "Profile not found." });
        }
        res.json(doc.data());
    } catch (err) {
        console.error("Error fetching profile:", err);
        res.status(500).json({ error: "Failed to fetch profile." });
    }
});

// Endpoint to create/update user profile data
app.post("/api/profile/:userId", async (req, res) => {
    const { userId } = req.params;
    const { name, age, gender } = req.body;
    if (!name || !age || !gender) {
        return res.status(400).json({ error: "Name, age, and gender are required." });
    }
    try {
        const userRef = db.collection('users').doc(userId);
        await userRef.set({ name, age, gender }, { merge: true });
        res.json({ success: true, message: "Profile updated successfully." });
    } catch (err) {
        console.error("Error updating profile:", err);
        res.status(500).json({ error: "Failed to update profile." });
    }
});


// Endpoint for analyzing symptoms, now with personalization
app.post("/api/analyze", async (req, res) => {
    const { conversationHistory, userId, age, gender } = req.body;
    if (!conversationHistory || !userId) {
        return res.status(400).json({ error: "Conversation history and User ID are required" });
    }
    try {
        const API_KEY = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`;
        const conversationSummary = conversationHistory.map(entry => `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.parts[0].text}`).join('\n');
        
        let userContext = "";
        if (age && gender) {
            userContext = `User Context: The user is a ${age}-year-old ${gender}.`;
        }

        const symptomsPrompt = `Your primary role is an empathetic and helpful AI health assistant. Your purpose is to provide clear, safe, and actionable information without giving a medical diagnosis. Analyze the user's symptoms from the conversation transcript.\n\n${userContext}\n\nYou MUST format your response using the following structure with the exact section markers...\n###empathetic_intro###\n[Start with a single reassuring and empathetic sentence...]\n###summary###\n[A brief summary...]\n###possible_causes###\n[List 2-3 common causes...]\n###home_care_plan###\n[Provide a clear, bulleted list...]\n* 🛌 **Rest:** [Explanation]\n* 💧 **Hydration:** [Explanation]\n* 💊 **Symptom Relief:** [Suggestions]\n###when_to_see_a_doctor###\n[Create a distinct, bulleted list of 'red flag' symptoms...]\n###disclaimer###\n[Disclaimer text...]\n\nConversation Transcript:\n"${conversationSummary}"`;

        const geminiResponse = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: symptomsPrompt }] }] }),
        });
        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.json();
            throw new Error(errorData.error?.message || "AI service error.");
        }
        const responseData = await geminiResponse.json();
        const fullText = responseData.candidates[0].content.parts[0].text.trim();
      
        if (!fullText.startsWith("Sorry, I cant help you")) {
            const historyRef = db.collection('users').doc(userId).collection('history').doc();
            await historyRef.set({
                symptoms: conversationHistory[0].parts[0].text,
                result: fullText,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        }
      
        res.json({ result: fullText });
    } catch (err) {
        console.error("Error in /api/analyze:", err);
        res.status(500).json({ error: err.message || "Failed to analyze symptoms" });
    }
});


// Endpoint to fetch history for a user
app.get("/api/history/:userId", async (req, res) => {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: "User ID is required" });

    try {
        const historyCollection = db.collection('users').doc(userId).collection('history');
        const snapshot = await historyCollection.orderBy('timestamp', 'desc').get();

        if (snapshot.empty) return res.json([]);

        const historyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(historyData);
    } catch (err) {
        console.error("Error fetching history:", err);
        res.status(500).json({ error: "Failed to fetch user history" });
    }
});

// Endpoint to delete a specific history item
app.delete("/api/history/:userId/:docId", async (req, res) => {
    const { userId, docId } = req.params;
    if (!userId || !docId) return res.status(400).json({ error: "User and Document IDs are required" });

    try {
        await db.collection('users').doc(userId).collection('history').doc(docId).delete();
        res.json({ success: true, message: "History item deleted successfully." });
    } catch (err) {
        console.error("Error deleting history item:", err);
        res.status(500).json({ error: "Failed to delete history item" });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});