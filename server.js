import express from 'express';
import 'dotenv/config';
import { Readable } from 'stream';

const app = express();
const PORT = process.env.PORT || 3000;

// --- In-Memory Cache for Suggested Topics ---
let cachedTopics = {
    timestamp: 0,
    data: []
};
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours

app.use(express.json());
app.use(express.static('public'));

app.get('/api/suggested-topics', async (req, res) => {
    // This endpoint is correct and remains unchanged
    const now = Date.now();
    if (now - cachedTopics.timestamp < CACHE_DURATION && cachedTopics.data.length > 0) {
        return res.json(cachedTopics.data);
    }
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Server configuration error.' });
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: "mistralai/mistral-7b-instruct:free", messages: [{ role: 'user', content: getSuggestionsPrompt() }], })
        });
        if (!response.ok) throw new Error('Failed to fetch from OpenRouter');
        const data = await response.json();
        const content = data.choices[0].message.content;
        const firstBracket = content.indexOf('[');
        const lastBracket = content.lastIndexOf(']');
        const jsonString = content.substring(firstBracket, lastBracket + 1);
        const newTopics = JSON.parse(jsonString);
        cachedTopics = { timestamp: now, data: newTopics };
        res.json(newTopics);
    } catch (error) {
        console.error('Failed to generate suggested topics:', error);
        res.json(["The Silk Road", "Quantum Computing", "History of Coffee", "Bioluminescence", "Ancient Inventions"]);
    }
});

app.post('/api/trivia', async (req, res) => {
    // This function is correct and remains unchanged
    const { topic } = req.body;
    const apiKey = process.env.OPENROUTER_API_KEY;
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

function getSuggestionsPrompt() {
    // This prompt is correct and remains unchanged
    return `You are a "Curiosity Curator". Your goal is to suggest fascinating and diverse topics. 
    Generate a JSON array of 6 interesting and currently relevant topics. 
    Mix trending subjects (like recent scientific discoveries or cultural events) with timeless, fascinating subjects (like historical events or scientific concepts).
    Topics should be 2-4 words long. Do not include controversial, political, or overly sensitive topics.
    Your entire response MUST be ONLY the raw JSON array, starting with [ and ending with ]. 
    Do not include markdown or any other text.
    Example: ["The Great Emu War", "The Future of Fusion Energy", "History of the Silk Road", "James Webb Telescope Discoveries", "The Pompeii Ruins", "Deep Sea Creatures"]`;
}

// --- THIS IS THE FUNCTION THAT IS NOW FIXED ---
function getPrompt(topic) {
    // The full, correct prompt is now restored.
    return `You are a brilliant trivia and fun fact generator. A user is interested in the topic: "${topic}".
Your task is to generate at least 30 interesting items about this topic.

**Instructions:**
1.  Provide a mix of content types: intriguing questions, "Did you know...?" facts, and actionable tips.
2.  Group the items into 3-4 relevant, emoji-prefixed categories (e.g., "🔬 Science & Biology", "🏛️ History & Culture").
3.  For each item, provide the main text and a clean, effective Google search query for it.
4.  IMPORTANT: Your entire response MUST be ONLY the raw JSON object, starting with { and ending with }. Do not include the markdown specifier \`\`\`json, any introductory text, or any other characters outside of the JSON object itself.

**JSON Structure Example:**
\`\`\`json
{
  "🌌 The Cosmos": [
    {
      "text": "What is a quasar and how is it powered?",
      "search_query": "what is a quasar"
    }
  ]
}
\`\`\`

Now, generate the JSON for the topic: "${topic}"`;
}

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
