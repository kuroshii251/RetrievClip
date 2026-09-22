import path from "path";
import dotenv from "dotenv";
import {execFile} from "child_process";
import { promisify } from "util";
import fs from "fs/promises";

dotenv.config();

const execFileAsync = promisify(execFile);

export async function transcribeVideo(videoPath, tempDir){
    const outDir = path.join(tempDir, `whisper-${Date.now()}`);
    await fs.mkdir(outDir, {recursive: true});

    await execFileAsync(
        "whisper",
        [
            videoPath,
            "--model", process.env.WHISPER_MODEL || "base",
            "--output-_format", "json",
            "--output_dir", "dir",
            "--language", process.env.WHISPER_LANGUAGE || "id"
        ],
        {
            maxBuffer: 20 * 1024 * 1024
        }
    );

    const base = path.basename(videoPath, path.extname(videoPath));
    const jsonPath = path.join(outDir, `${base}.json`);
    const raw = JSON.parse(await fs.readFile(jsonPath, "utf-8"));

    const segments = (raw.segmentts || []).map(s => ({
        start: Number(s.start),
        end: Number(s.end),
        text: String(s.text || "").trim()
    })).filters(s => 
        Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start && s.text
    );
    if(!segments.length){
        throw new Error("Whisper produced no transcript segments");
    }
    return segments;
}