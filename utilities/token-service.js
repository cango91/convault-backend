const jwt = require('jsonwebtoken');
const RefreshToken = require('../modules/users/models/refreshToken');
const { toSeconds } = require('./utils');

const signRefreshToken = (user) => {
    return jwt.sign(
        { user, timestamp: process.hrtime.bigint().toString() },
        process.env.REFRESH_SECRET,
        { expiresIn: process.env.REFRESH_EXP }
    );
}

/**
 * Parses a given jwt using base64url and returns its payload
 * @param {*} token 
 * @returns {payload}
 */
function parseJwt(token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}
/**
 * Creates a new stateless jwt with the provided user as payload
 * @param {user} user 
 * @param {String} expiresIn 
 * @returns {jwt}
 */
function createJwt(user, expiresIn) {
    return jwt.sign(
        { user },
        process.env.JWT_SECRET,
        { expiresIn }
    );
}

/**
 * Creates a stateful jwt, stored in RefreshToken collection
 * @param {user} user 
 * @param {String} expiresIn 
 * @returns {jwt}
 */
async function createRefreshToken(user, expiresIn) {
    try {
        const token = signRefreshToken(user);
        const refreshToken = new RefreshToken({
            token,
            user: user.id,
            expiresAt: new Date(Date.now() + toSeconds(expiresIn) * 1000)
        });

        await refreshToken.save();
        return token;
    } catch (error) {
        console.error(error);
        throw error;
    }
}



/**
 * Gets the user by parsing the provided jwt 
 * @param {*} token 
 * @returns {user}
 */
function getUserFromToken(token) {
    if (token && token.startsWith('Bearer ')) {
        token = token.replace('Bearer ', '');
    }
    return token ? parseJwt(token).user : null;
}

/**
 * Returns a new object containing a refreshed jwt and rotated refresh token
 * if refreshToken is valid.
 * 
 * Throws if refresh token is invalid, not found, expired or revoked
 * @param {String} refreshToken
 * @returns {{accessToken, refreshToken}}
 * @throws {Error}
 */
async function refreshTokens(refreshToken) {
    try {
        await verifyJwt(refreshToken, process.env.REFRESH_SECRET);
        const user = getUserFromToken(refreshToken);
        if (await RefreshToken.isValid(user, refreshToken)) {
            //await RefreshToken.updateOne({ token: refreshToken }, { status: 'revoked' });
            const newRefreshToken = signRefreshToken(user);
            const newJwt = createJwt(user, process.env.JWT_EXP);
            await RefreshToken.findOneAndUpdate({ token: newRefreshToken });
            return { accessToken: newJwt, refreshToken: newRefreshToken };
        } else {
            console.error(`Invalid token: ${refreshToken}`);
            throw new Error('Invalid Refresh Token');
        }
    } catch (error) {
        console.error(error);
        throw error;
    }

}

async function revokeRefreshToken(refreshToken) {
    try {
        await verifyJwt(refreshToken, process.env.REFRESH_SECRET);
        await RefreshToken.findOneAndUpdate({ token: refreshToken }, { status: 'revoked' }, { new: true });
    } catch (error) {
        console.error(error);
        throw error;
    }
}

/**
 * Checks if a jwt is valid. Returns decoded token if valid. Rejects promise with error if not.
 * @param {String} token 
 * @param {String} secret 
 * @returns {Promise}
 */
function verifyJwt(token, secret = process.env.JWT_SECRET) {
    return new Promise((resolve, reject) => {
        jwt.verify(token, secret, (error, decodedToken) => {
            if (error) {
                reject(error);
            } else {
                resolve(decodedToken);
            }
        })
    });
}

/**
 * Conveneince function to set http(s)-only strict same side cookie with refreshToken
 * 
 * Setter must be res.cookie
 * @param {Function} setter 
 * @param {String} refreshToken 
 */
function setCookie(res, refreshToken) {
    return res.cookie('refreshToken', refreshToken,
        {
            httpOnly: true,
            sameSite: 'strict',
            secure: process.env.NODE_ENV
                && process.env.NODE_ENV.toLowerCase() === 'production'
        });
}



module.exports = {
    parseJwt,
    createJwt,
    createRefreshToken,
    getUserFromToken,
    refreshTokens,
    verifyJwt,
    setCookie,
    revokeRefreshToken,
}