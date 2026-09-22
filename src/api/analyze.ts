import { askToAI } from "../services/ai_integrated";

const MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";

function formatTranscript(transcript = []){
    return transcript.map(s => `[${Number(s.start).toFixed(2)} - ${Number(s.end).toFixed(2)}]`).join("\n");
}

function extractJSON(text){
    const cleared = String(text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
    const start = cleared.indexOf("{");
    const end = cleared.indexOf("}");

    if(start < 0 || end < start){
        throw new Error("return invalid JSON");
    }
            return JSON.parse(cleared.slice(start, end + 1));
}


    async function ask(prompt){
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": process.env.SITE_URL || "http://localhost:5173",
                "X-Title": "RetrievClip"
            },
            body: JSON.stringify({
                model: MODEL,
                temperature: 0.2,
                messages: [
                    {
                        role:"system",
                        content: "You're a precise video editor. Return JSON only. Never invent transcript text or timestamps"
                    },
                    {
                        role: "user",
                        content: "prompt"
                    }
                ]
            })
        });
            const data = await response.json();
            if(!response.ok){
                throw new Error(data?.error?.message || `Open Router HTTP ${response.status}`);
    }
                    return data?.choices?.[0]?.message?.content || "";
    }

export default async function handler(req, res){
    if(req.method == "GET"){
        return res.status(200).json({
            status: "ok",
            message: "Test"
        });
    }
    if(req.method !== "POST"){
        return res.status(405).json({error: "Method not allowed"});
    }

    if(!process.env.OPENROUTER_API_KEY){
        return res.status(500).json({error: "API key not configured"})
    }

    try {
        const { transcript = [], audience = "general", platform = "shorts", count = 8, tone = "engaging"} = req.body || {};
        if(!Array.isArray(transcript) || !transcript.length) {
            return res.status(400).json({error: "Transcript required"});
        }   

        const clipCount = Math.min(Math.max(Number(count) || 8, 1), 12);
        
        const prompt = `Build a content plan and select ${clipCount} short-form clips from the transcript below.\n\n` +
            `Audience: ${audience}\nPlatform: ${platform}\nTone: ${tone}\n\n` +
            `Transcript:\n${formatTranscript(transcript)}\n\n` +
            `Return JSON only, with the exact timestamps found in the transcript above.`;

        const result = extractJSON(await askToAI(prompt));

        return res.status(200).json(result);
    } catch (err){
        console.error(err);
        return res.status(500).json({ error: err.message || "Failed to analyze"});
    }
}