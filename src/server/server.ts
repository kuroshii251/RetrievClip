import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import fs from "fs/promises";
import dotenv from "dotenv";
import path from "path";
import multer from "multer";
import { randomUUID } from "crypto";
import {createJob, updateJob, getJob} from "../jobs/jobsManager";
import {getDuration, renderVerticalClip, writeAs} from "../services/ffmpeg";
import {buildContent} from "../services/contentClip.ts";
import {generateClips} from "../services/clipAgent";
import {remixcontent} from "../services/remixAgents";
import { generateMetadata } from "../services/metadataAgent";
import { transcribeVideo } from "../services/transcription";


dotenv.config();


const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const uploads = path.join(_dirname, "uploads");
const output = path.join(_dirname, "output");
const temp = path.join(_dirname, "temp");

await Promise.all([
    fs.mkdir(uploads, {recursive: true}),
    fs.mkdir(output, {recursive: true}),
    fs.mkdir(temp, {recursive: true})
    
]);

app.use(cors({
    origin: CLIENT_ORIGIN
}));

app.use(express.json({limit: "2mb"}));
app.use("/clips", express.static(output));

const maxBytes = Number(process.env.MAX_UPLOAD_MB || 124) * 1024 * 1024;

const storage = multer.diskStorage({
    destination: uploads,
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || ".mp4") || ".mp4";
        cb(null, `${randomUUID()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: {fileSize: maxBytes},
    fileFilter: (_req, file, cb) => {
        if(!String(file.mimetype).startsWith("video/")){
            return cb(new Error("Only video files accepted"));
        }
        cb(null, true);
    }
});

function clampClip(clip, duration){
    let start = Number(clip.start);
    let end = Number(clip.end);

    if(!Number.isFinite(start))
        start = 0;
    if(!Number.isFinite(end))
        end = start + 30;

    start = Math.max(0, Math.min(start, Math.max(0, duration - 1)));
    end = Math.max(start + 1, Math.min(end, duration));

    if(end - start > 60)
        end = start + 60;
    if(end > duration)
        end = duration;

    if(end <=start)
        return null;

    return {
        ...clip,
        start: Number(start.toFixed(2)),
        end: Number(end.toFixed(2)),
        duration: Number((end - start).toFixed(2))
    };
    
}

async function downloadVideoDirectory(url, destination){
    const parsed = new URL(url);
    if(!["http:", "https:"].includes(parsed.protocol)){
        throw new Error("Only http/https URL allowed");
    }
    
    const response = await fetch(url, {
    redirect: "follow"
});

const contentType = response.headers.get("content-type") || "";
if(!contentType.startsWith("video/")){
    throw new Error("URL must poin directly to a video file.The platform page URLs not supported");
}

const contentLength = Number(response.headers.get("content-length") || 0);
if(contentLength && contentLength > maxBytes){
    throw new Error("Remote video exceeds the configured size limit");

}


const buffer = Buffer.from(await response.arrayBuffer());
if(buffer.length > maxBytes){
    throw new Error("Remote video exceeds the configured  size limit");
}
await fs.writeFile(destination, buffer);

}

async function processVideo(jobId, videoPath, options){
    try {
        updateJob(jobId, {
            progress: 15,
            stage: "Transcribing Audio"
        });

        const transcript = await transcribeVideo(videoPath, temp);

        updateJob(jobId, {
            transcript,
            progress: 35,
            stage: "Building Content"
        });

        const retrievclip = await buildContent(transcript);

        updateJob(jobId, {
            retrievclip,
            progress: 52,
            stage: "AI Designing Clips"
        });

        const selection = await generateClips(transcript, retrievclip, options);
        const rawClips = Array.isArray(selection.clips) ? selection.clips: [];

        const duration = await getDuration(videoPath);
        const clips = [];

        for(let i = 0; i < rawClips.length; i++){
            const clip = clampClip(rawClips[i], duration);
            if(!clip){
                continue;
            }

            const filename = `${jobId}-${i}.mp4`;
            const outputPath = path.join(output, filename);
            const asPath = path.join(temp, `${jobId}-${i}.ass`);

            await writeAs(
                transcript,
                asPath,
                clip.start,
                clip.end
            );

            updateJob(jobId, {
                progress: 55 + Math.round((i + 1) / Math.max(rawClips.length, 1) * 35),
                stage: `Rendering Clips ${i + 1} / ${rawClips.length}`
            });

            await renderVerticalClip({
                input: videoPath,
                output: outputPath,
                start: clip.start,
                duration: clip.duration,
                asPath
            });

            const metadata = await generateMetadata(
                clip,
                options.audience,
                options.platform
            );

            clips.push({
                ...clip,
                index: clips.length + 1,
                url: `/clips/${filename}`,
                metadata
            });

            updateJob(jobId, {
                progress: 55 + Math.round((i + 1) / Math.max(rawClips.length, 1) * 35),
                stage: `Rendering clips ${i+1} / ${rawClips.length}`,
                clips
            });
        }

            updateJob(jobId, {
                status: "completed",
                progress: 100,
                stage: "Complete",
                clips
            });
            } catch(err) {
                console.error(err);
                updateJob(jobId, {
                    status: "Error",
                    stage: "Failed",
                    error: err.message
                });
            }
        }

            app.get("/api/health", (_req, res) => {
                res.json({
                    ok:true,
                    message: "Hello",
                    service: "content-retrieve-clip"
                });
            });

            app.post("/api/upload", upload.single("video"), async(req, res) => {
                if(!req.file){
                    return res.status(500).json({
                        error: "Video file required"
                    });
                }
                
                const jobId = randomUUID();

                const options = {
                    count: Math.min(Math.max(Number(req.body.count || 8), 1), 12),
                    audience: req.body.audience || "general",
                    platform: req.body.platform || "shorts",
                    tone: req.body.tone ||"engaging",
                };

                    createJob(jobId, options);
                    res.status(202).json({jobId});
                    processVideo(jobId, req.file.path, options);
            });

            app.post("/api/url", async (req, res) => {
                try {
                    const {
                        url,
                        count = 8,
                        audience = "general",
                        platform = "shorts",
                        tone = "engaging"
                    } = req.body;

                    if(!url){
                        return res.status(400).json({
                            error:"Direct video URL is required"
                        });
                    }

                    const jobId = randomUUID();
                    const filePath = path.join(uploads, `${jobId}.mp4`);

                    const options = {
                        count: Math.min(Math.max(Number(count), 1), 12),
                        audience,
                        platform,
                        tone
                    };

                    createJob(jobId, options);

                    await downloadVideoDirectory(url, filePath);

                    res.status(202).json({jobId});
                    processVideo(jobId, filePath, options);
                } catch (err){
                    res.status(400).json({error: err.message});
                }
            });

            app.post("/api/jobs/:id/remix", async (req,res) => {
                const job = getJob(req.params.id);
                if(!job?.retrievclip || !job?.transcript){
                    return res.status(409).json({
                        error: "The resource must finish analysis before remixing."
                    });
                }

                try {
                    const result = await remixcontent({
                        transcript: job.transcript,
                        retrievclip: job.retrievclip,
                        audience: req.body.audience || "general",
                        platform: req.body.platform || "shorts",
                        count: Math.min(
                            Math.max(Number(req.body.count || 5), 1), 10
                        )
                    })

                    res.json(result);
                } catch(err){
                    res.status(500).json({error: err.message});
                };
                
                
            });

            app.get("/api/jobs/:id", (req, res) => {
                const job = getJob(req.params.id);

                if(!job){
                    return res.status(400).json({error: "Job not found"});
                }
                res.json(job);
            });

            app.use((err, _req,res, _next) => {
                console.error(err);
                res.status(400).json({
                    error: err.message || "request failed"
                });
            });

            app.listen(PORT, () => {
                console.log(`Content API: http://localhost:${PORT}`);
            });

