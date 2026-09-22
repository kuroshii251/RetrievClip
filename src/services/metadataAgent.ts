import {askToAI, extractJSON} from "./ai_integrated"

export async function generateMetadata(clip, audience, platform){
    const prompt= `
    Generate metadata for a short-form clip
    Audience: ${audience}
    Platform: ${platform}
    Title: ${clip.title}
    Hook: ${clip.hook}
    Topic: ${clip.topic || ""}
    Return:
    {
        "titles" : {"", "", ""},
        "description":"",
        "hashtags":["#.."],
        "thumbnailText":"",
        "callAction":""
    }
    `;
    return extractJSON(await askToAI(prompt));
}