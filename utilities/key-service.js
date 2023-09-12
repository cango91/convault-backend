const Key = require('../modules/chat/models/keyStore');
const SlidingWindowRateLimiter = require('./sliding-window-rate-limiter');

const limiter = new SlidingWindowRateLimiter(50);

const get = async (userId, key) => {
    try {
        if(limiter.isRateLimited(userId)) throw new Error('Too many requests');
        const record = await Key.findOne({ key });
        if (!record || !record.user.equals(userId)) throw new Error('Invalid key');
        return { key, value: record.value };
    } catch (error) {
        console.error(error);
        throw error;
    }
}

const set = async (userId, key, value) => {
    try {
        const existing = await Key.findOne({key});
        if(existing) return;
        if(limiter.isRateLimited(userId)) throw new Error('Too many requests');
        await Key.create({ user: userId, key, value });
    } catch (error) {
        console.error(error);
        throw error;
    }
}

module.exports = {
    get,
    set,
}