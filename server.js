import express from 'express';
import 'dotenv/config';
import { Readable } from 'stream';

const app = express();
const PORT = process.env.PORT || 3000;

// --- NEW: In-Memory Cache for Suggested Topics ---
let cachedTopics = {
    timestamp: 0,
    data: []
};
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours

app.use(express.json());
app.use(express.static('public'));

// --- NEW: Endpoint to get suggested topics ---
app.get('/api/suggested-topics', async (req, res) => {
    console.log('Request received for /api/suggested-topics');
    const now = Date.now();

    // If cache is fresh, return it immediately
    if (now - cachedTopics.timestamp < CACHE_DURATION && cachedTopics.data.length > 0) {
        console.log('Returning cached topics.');
        return res.json(cachedTopics.data);
    }

    console.log('Cache is stale or empty. Generating new topics...');
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.error('API key not configured for suggestions.');
        return res.status(500).json({ error: 'Server configuration error.' });
    }

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "mistralai/mistral-7b-instruct:free",
                messages: [{ role: 'user', content: getSuggestionsPrompt() }],
            })
        });

        if (!response.ok) throw new Error('Failed to fetch from OpenRouter');
        
        const data = await response.json();
        const content = data.choices[0].message.content;
        
        // Clean the response to get just the JSON array
        const firstBracket = content.indexOf('[');
        const lastBracket = content.lastIndexOf(']');
        const jsonString = content.substring(firstBracket, lastBracket + 1);

        const newTopics = JSON.parse(jsonString);

        // Update cache
        cachedTopics = {
            timestamp: now,
            data: newTopics
        };
        console.log('Successfully generated and cached new topics.');
        res.json(newTopics);

    } catch (error) {
        console.error('Failed to generate suggested topics:', error);
        // Fallback to a default list if the API fails
        res.json(["The Silk Road", "Quantum Computing", "History of Coffee", "Bioluminescence", "Ancient Inventions"]);
    }
});

// The existing endpoint for generating trivia
app.post('/api/trivia', async (req, res) => {
    // This entire function remains unchanged...
    const { topic } = req.body;
    const apiKey = process.env.OPENROUTER_API_KEY;
    // ... all the logic is the same as before
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: "mistralai/mistral-7b-instruct:free", messages: [{ role: 'user', content: getPrompt(topic) }], stream: true, })
        });
        if (!response.ok) { const errorBody = await response.text(); console.error('OpenRouter API error:', errorBody); throw new Error(`OpenRouter API error: ${response.statusText}`); }
        res.setHeader('Content-Type', 'text/event-stream');
        Readable.fromWeb(response.body).pipe(res);
    } catch (error) {
        console.error('Error fetching trivia:', error.message);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to fetch trivia data.' });
    }
});

// --- NEW: Prompt for generating suggestions ---
function getSuggestionsPrompt() {
    return `You are a "Curiosity Curator". Your goal is to suggest fascinating and diverse topics. 
    Generate a JSON array of 6 interesting and currently relevant topics. 
    Mix trending subjects (like recent scientific discoveries or cultural events) with timeless, fascinating subjects (like historical events or scientific concepts).
    Topics should be 2-4 words long. Do not include controversial, political, or overly sensitive topics.
    Your entire response MUST be ONLY the raw JSON array, starting with [ and ending with ]. 
    Do not include markdown or any other text.
    Example: ["The Great Emu War", "The Future of Fusion Energy", "History of the Silk Road", "James Webb Telescope Discoveries", "The Pompeii Ruins", "Deep Sea Creatures"]`;
}

function getPrompt(topic) {
    // This prompt remains unchanged
    return `You are a brilliant trivia and fun fact generator... [YOUR FULL PROMPT HERE]`;
}

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
