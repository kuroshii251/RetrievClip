import { askToAI, extractJSON } from "./ai_integrated";

export async function remixcontent({transcript, content, audience, platform, count}){
    const text = transcript.map(s => `[${s.end}] ${s.text}`).join("\n");

    const prompt = `
    Remix the source for this audience and platform
    Audience: ${audience}
    Platform: ${platform}
    Create ${count} alternative clip content by selecting relevant moments from the same source.
    Don't invent dialogue or timestamps.
    
    Preserve factual meaning

    Content:
    ${JSON.stringify(content)}

    Transcript:
    ${text}

    Return:
    {
    "strategy": "",
    "clips": [
    {
    "start":0,
    "end":0,
    "title": "",
    "reason":"",
    "hook": "" 
    }
    ],
    "caption": "",
    "hashtags": []
}
    `;

    return extractJSON(await askToAI(prompt));
}