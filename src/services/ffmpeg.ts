import ffmpeg from "fluent-ffmpeg"
import fs from "fs/promises"

export function getDuration(input){
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(input, (err, metadata) => {
            if(err){
                return reject(err);
            }
            const duration = Number(metadata?.format?.duration);
            if(!Number.isFinite(duration)){
                return reject(new Error("Could not read video duration"));
            }
            resolve(duration);
        });
    });
}

function asEscape(text){
    return String(text)
    .replace(/\\/g,"\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\r?\n/g, "\\N");
}

export async function writeAs(segments, outputPath, clipStart, clipEnd){
    const lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        "PlayResX: 1080",
        "PlayResY: 1920",
        "",
        "[V4+ Styles]",
        "Format: Name, FontName, FontSize, PrimaryColour,SecondaryColour,OnlineColour,BackColour,Bold,Italic,Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        "Style: Caption, Arial, 54, &H00FFFFFF, &H000000FF,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,40,1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, MarginL, MarginR, MarginV, Effect,Text"
    ];

    const selected = segments.filter(s => s.end > clipStart && s.start < clipEnd);

    const fmt = seconds => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) /60);
        const s = Math.floor(seconds % 60);
        const cs = Math.floor((seconds - Math.floor(seconds)) * 100);
        return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
    }

    for(const seg of selected){
        const start = Math.max(clipStart, seg.start) - clipStart;
        const end = Math.min(clipEnd, seg.end) - clipStart;
        lines.push(
            `Dialogue: 0,${fmt(start)},${fmt(end)},Caption,0,0,0,,${asEscape(seg.text)}`  
        );
    }
    await fs.writeFile(outputPath, lines.join("\n"), "utf-8");
}


export function renderVerticalClip({input, output, start, duration, asPath}){
    return new Promise((resolve, reject) => {
        const filters = ["scale=1080:-2", "crop=1080:1920"];
        if(asPath){
            filters.push(`ass=${asPath.replace(/\\/g, "\\\\").replace(/:/g, "\\:")}`);
            }
            
            ffmpeg(input).setStartTime(start).setDuration(duration).setVideoFilters(filters).videoCodec("libx264").audioCodec("aac").outputOptions([
                "-preset", "veryfast",
                "-crf", "23",
                "-movflags", "+faststart"
            ]).output(output).on("end", resolve).on("error", reject).run();
        });
    }