import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
        "HTTP_Referer": process.env.CLIENT_ORIGIN || "http://localhost:5173",
        "X-Title" : "RetrievClip"
    }
});

export async function askToAI(prompt, temperature = 0.35){
    const response = await client.chat.completions.create({
        model: process.env.OPENROUTER_MODEL || "openrouter/free",
        messages: [
            {
                role: "system",
                content: "You are a precise autonomous video content editor. Never invent transcript text or timestamp. Return JSON only when  requested"
            },
            {
                role: "user",
                content: prompt
            }
        ], temperature
    });

    const content = response.choices?.[0]?.message?.content;
    if(!content){
        throw new Error("OpenRouter return an empty response");
    }
    return content;
    
}


export function extractJSON(text){
    const cleaned = String(text)
    .replace(/^```json\s*/i,"")
    .replace(/^```\s*/i,"")
    .replace(/\s*```$/i, "")
    .trim();

    const firstString = cleaned.indexOf("{");
    const lastString = cleaned.lastIndexOf("}");

    if(firstString < 0 || lastString < firstString){
        throw new Error("Response din't contain a JSON object");
    }
    return JSON.parse(cleaned.slice(firstString, lastString +1));
}

