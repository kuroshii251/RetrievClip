import { askToAI, extractJSON } from "./ai_integrated";

export async function generateClips(transcript, retrievclip, options){
    const text = transcript.map(s => `[${s.start.toFixed(2)} - ${s.end.toFixed(2)}] ${s.text}`).join("\n");

    const prompt = `Create ${options.count} short-form clip concepts
    
        Audience: ${options.audience}
        Platform: ${options.platform}
        Tone: ${options.tone}
        Rules:
        - Aim fr 20-60 second
        - Strong Opening
        - Enough context,
        - Clear Payoff
        - Natural Ending

        Content:
        ${JSON.stringify(retrievclip)}

        Transcript:
        ${text}

        Return:
        {
         "clips": [
            {
              "start": 0,
              "end": 0,
               "title": "",
               "hook":"",
               "reason":"",
               "topic":"".
               "score":0,
               "captionStyle": "bold"
             }
         ]
    }
        
        `;
        return extractJSON(await askToAI(prompt));
}