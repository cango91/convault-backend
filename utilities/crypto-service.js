const crypto = require('crypto');

const HASH_SALT_LENGTH = Number(process.env.HASH_SALT_LENGTH);
const HASH_ITERS = Number(process.env.HASH_ITER_ROUNDS);
const HASH_KEY_LEN = Number(process.env.HASH_KEY_LENGTH);
const HASH_DIGEST = process.env.HASH_DIGEST;

const hashString = (password) => {
    const salt = crypto.randomBytes(HASH_SALT_LENGTH).toString('hex');
    return new Promise((resolve, reject) => crypto.pbkdf2(password, salt, HASH_ITERS, HASH_KEY_LEN, HASH_DIGEST, (err, key) => {
        if (err) {
            reject(err);
        }
        resolve(`${salt}:${key.toString('hex')}`);
    }));
}

const compareHash = (password, hash) => {
    const [salt, key] = hash.split(':');
    return new Promise((resolve,reject) => crypto.pbkdf2(password, salt, HASH_ITERS, HASH_KEY_LEN, HASH_DIGEST, (err, compKey) => {
        if (err) {
            reject(err);
        }
        resolve(key === compKey.toString('hex'));
    }));
}

module.exports = {
    hashString,
    compareHash,
}