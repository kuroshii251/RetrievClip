
const MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";

function formatTranscript (t = []){
    return t.map(s => `[${s.start} - ${s.end} ${s.text}]`).join("\n");
    
}

async function callOpenRouter(prompt){
    const r = await fetch("https://openrouter/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-type": "application/json",
            "HTTP-Referer": process.env.SITE_URL || "http://localhost:5173",
            "X-Title": "RetrievClip"
            },
            body: JSON.stringify({
                model: MODEL,
                temperature: 0.2,
                messages: [
                    {
                        role: "system",
                        content: "You are a precise editor. Return JSON only. Never invent timestamps."
                    },
                    {
                        role: "user",
                        content:  prompt
                    }
                ]
            })
        });

        if(!r.ok){
            const errText = await r.text();
            throw new Error(`Open Router error ${r.status} : ${errText}`);
        }

        const data = await r.json();
        return data.choices?.[0]?.message?.content ?? "";
}

function extractJSON(text){
    if(!text) 
        return null;
    const cleaned = text.replace(/```json|```/g, "").trim();
    try {
        return JSON.parse(cleaned);
    } catch{
        const match = cleaned.match(/\{[\s\S]*\}/);
        if(match){
            try {
                return JSON.parse(match[0]);

            } catch {
                return null;
            }
        } return null;
}
}


export default async function handler(req, res){
    if(req.method!=="POST")
        return res.status(405).json({error: "Method not allowed"});
    if(!process.env.OPENROUTER_API_KEY)
        return res.status(500).json({error: "API KEY Not Configured"});
    try {
        const {transcript = [],
            retrievclip = {},
            audience= "general",
            count= 5
        } = req.body || {};
        if(!transcript.length){
            return res.status(400).json({error: "Transcript required"});
        }
            const prompt = `Remix the same source for audience ${audience}.
            
            Create ${count} alternative clip  concepts. Dont invent dialogue or  timestamp.
            
            Return:
            {
                "strategy":"",
                "clips":[{
                    "start":0,
                    "end": 0,
                    "title":"",
                    "reason":"",
                    "hook":""}],
                    "caption":"",
                    "hashtags":[]
            }
            
            Content:
            ${JSON.stringify(retrievclip)}
            
            Transcript:
            ${formatTranscript(transcript)}`;
            
            return res.status(200).json(extractJSON(await callOpenRouter(prompt)));
        } catch(err) {
            console.error({error: err.message || "Remix Failed"});
        }
    }