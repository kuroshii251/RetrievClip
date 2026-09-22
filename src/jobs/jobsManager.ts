const jobs = new Map();

export function createJob(id, options = {}){
    const job = {
        id,
        status: "processing",
        progress:0,
        stage: "Queued",
        options,
        durations: null,
        transcript: null,
        retrievclip:null,
        clipc:[],
        error: null,
        createdAt: Date.now()
    }
    jobs.set(id, job);
    return job;
}

export function updateJob(id, patch){
    const job = jobs.get(id);
    if(job){
        Object.assign(job, patch);
    }
}

export function getJob(id){
    return jobs.get(id);
}

export function deleteJob(id){
    jobs.delete(id);
}