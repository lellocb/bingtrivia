import express from 'express';
import 'dotenv/config';
import { Readable } from 'stream';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

app.post('/api/trivia', async (req, res) => {
    // --- DEBUG LOGGING ---
    console.log(`[${new Date().toISOString()}] Received request for /api/trivia`);
    
    const { topic } = req.body;
    const apiKey = process.env.OPENROUTER_API_KEY;

    // --- DEBUG LOGGING ---
    console.log(`Topic received: "${topic}"`);
    console.log('OpenRouter API Key found:', !!apiKey);

    if (!apiKey) {
        console.error('CRITICAL: API key not configured.');
        return res.status(500).json({ error: 'Server configuration error.' });
    }
    if (!topic) {
        console.error('Request failed: Topic is required.');
        return res.status(400).json({ error: 'Topic is required.' });
    }

    try {
        // --- DEBUG LOGGING ---
        console.log('Sending request to OpenRouter...');
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "mistralai/mistral-7b-instruct:free",
                messages: [{ role: 'user', content: getPrompt(topic) }],
                stream: true,
            })
        });
        
        // --- DEBUG LOGGING ---
        console.log('Received response from OpenRouter. Status:', response.status);

        if (!response.ok) {
            // Log the error response from OpenRouter itself
            const errorBody = await response.text();
            console.error('OpenRouter API returned an error:', response.status, errorBody);
            throw new Error(`OpenRouter API error: ${response.statusText}`);
        }

        console.log('Streaming response back to client...');
        res.setHeader('Content-Type', 'text/event-stream');
        Readable.fromWeb(response.body).pipe(res);

    } catch (error) {
        // --- DEBUG LOGGING ---
        console.error('FATAL: An error occurred in the /api/trivia handler:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to fetch trivia data.' });
        }
    }
});

function getPrompt(topic) {
    return `You are a brilliant trivia and fun fact generator. A user is interested in the topic: "${topic}".
Your task is to generate at least 30 interesting items about this topic.

**Instructions:**
1.  Provide a mix of content types: intriguing questions, "Did you know...?" facts, and actionable tips.
2.  Group the items into 3-4 relevant, emoji-prefixed categories (e.g., "🔬 Science & Biology", "🏛️ History & Culture").
3.  For each item, provide the main text and a clean, effective Bing search query for it.
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
