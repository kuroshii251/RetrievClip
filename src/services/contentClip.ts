import { askToAI, extractJSON } from "./ai_integrated";

const formatTranscript = (t) =>
    t
        .map((s) => `[${s.start.toFixed(2)} - ${s.end.toFixed(2)}] ${s.text}`)
        .join("\n");

export async function buildContent(transcript) {
    const prompt = `Build a Content from this video transcript.
        
        -Overcall Summary
        - Main topics and subtopics
        - Strongest hooks
        -quotable statements
        -emotional, surprising, educational, controversial and funn moments
        - Story arcs

        Note: Only use timestamps presents in the transcript. 

        Return:
        {
        "summary": "",
        "topics": [{
            "text":"",
            "start":0,
            "end": 0
            }],
        "hooks": [{
            "text":"",
            "start":0,
            "end":0,
            "strength":0
            }],
        "quotes": [{
            "text": "",
            "start":0,
            "end":0
            }],
        "moments": [{
            "type": "",
            "start":0,
            "end":0,
            "reason":""
            }]
        }

        Transcript:
        ${formatTranscript(transcript)}
         `;

    return extractJSON(await askToAI(prompt));
}
