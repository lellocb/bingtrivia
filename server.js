import express from "express";
import "dotenv/config";
import { Readable } from "stream"; // <--- CHANGE 1: IMPORT THIS

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

app.post("/api/trivia", async (req, res) => {
  const { topic } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.error("API key is not configured.");
    return res.status(500).json({ error: "Server configuration error." });
  }

  if (!topic) {
    return res.status(400).json({ error: "Topic is required." });
  }

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistralai/mistral-7b-instruct:free",
          messages: [{ role: "user", content: getPrompt(topic) }],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("OpenRouter API error:", errorBody);
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    res.setHeader("Content-Type", "text/event-stream");

    // --- CHANGE 2: CONVERT THE WEB STREAM TO A NODE.JS STREAM BEFORE PIPING ---
    Readable.fromWeb(response.body).pipe(res);
  } catch (error) {
    console.error("Error fetching trivia:", error.message);
    // Important: Don't try to send a JSON response if headers are already sent by the pipe
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to fetch trivia data." });
    }
  }
});

function getPrompt(topic) {
  return `You are a brilliant trivia and fun fact generator. A user is interested in the topic: "${topic}".
Your task is to generate at least 30 interesting items about this topic.

**Instructions:**
1.  Provide a mix of content types: intriguing questions, "Did you know...?" facts, and actionable tips.
2.  Group the items into 3-4 relevant, emoji-prefixed categories (e.g., "🔬 Science & Biology", "🏛️ History & Culture").
3.  For each item, provide the main text and a clean, effective Google search query for it.
4.  The output must be a single, valid JSON object. Do not include any text or markdown formatting before or after the JSON.

**JSON Structure Example:**
\`\`\`json
{
  "🌌 The Cosmos": [
    {
      "text": "What is a quasar and how is it powered?",
      "search_query": "what is a quasar"
    }
  ],
  "🚀 Space Exploration": [
    {
      "text": "Tip: You can track the International Space Station's position live online.",
      "search_query": "track international space station live"
    }
  ]
}
\`\`\`

Now, generate the JSON for the topic: "${topic}"`;
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
