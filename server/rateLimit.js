const requestBuckets = new Map();

function limit(max, windowMs) {
    return (req, res, next) => {
        const key = `${req.ip}:${req.path}`;
        const now = Date.now();
        const bucket = requestBuckets.get(key) || { count: 0, start: now };
        if (now - bucket.start > windowMs) Object.assign(bucket, { count: 0, start: now });
        bucket.count += 1;
        requestBuckets.set(key, bucket);
        if (bucket.count > max) return res.status(429).json({ message: 'Příliš mnoho pokusů. Zkus to za chvíli.' });
        next();
    };
}

module.exports = { limit };
