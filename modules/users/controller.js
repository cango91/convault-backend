const User = require('./models/user');
const tokenService = require('../../utilities/token-service');
const utils = require('../../utilities/utils');

/** Create new User */
const create = async (req, res, next) => {
    try {
        const user = new User(req.body);
        await user.save();
        const accessToken = tokenService.createJwt(user, process.env.JWT_EXP);
        const refreshToken = await tokenService.createRefreshToken(user, process.env.REFRESH_EXP);
        tokenService.setCookie(res, refreshToken);
        res.json({ accessToken });
    } catch (error) {
        console.error(error);
        utils.respondWithStatus(res);
    }
}

/** Log existing User in */
const login = async (req, res, next) => {
    try {
        const { username, password } = req.body;
        //if(!username || !password) throw new Error('Bad Credentials');
        const user = await User.findOne({ username });
        if (!user || !(await user.verifyPassword(password))) {
            return utils.respondWithStatus(res, 401, 'Bad Credentials');
        }
        const accessToken = tokenService.createJwt(user, process.env.JWT_EXP);
        const refreshToken = await tokenService.createRefreshToken(user, process.env.REFRESH_EXP);
        tokenService.setCookie(res, refreshToken);
        res.json({ accessToken });
    } catch (error) {
        console.error(error);
        utils.respondWithStatus(res);
    }
}

/** Log a User out by revoking their current refresh token and clearing their cookie */
const logout = async (req, res, next) => {
    try {
        const refreshToken = req.newRefreshToken || req.cookies.refreshToken;
        const accessToken = res.getHeader('New-Access-Token') || req.get('Authorization').split(" ")[1];
        await tokenService.revokeRefreshToken(accessToken, refreshToken);
        res.clearCookie('refreshToken');
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error(error);
        utils.respondWithStatus(res);
    }
}

/** Log a User out by revoking all of their valid refresh tokens and clearing current UA's cookie */
const logoutAll = async (req, res, next) => {

}
const getUserStatus = async (req, res, next) => {

}
const setUserStatus = async (req, res, next) => {

}

/** Get the public key of a User */
const getPublicKey = async (req, res, next) => {
    try {
        // TODO: Add friend-or-self check
        const userId = req.params.id;
        const user = await User.findById(userId);
        if(user && user.publicKey){
            res.json({publicKey: user.publicKey});
        }else{
            res.status(404).json({message: "public key not found"});
        }
    } catch (error) {
        console.error(error);
        utils.respondWithStatus(res);
    }
}

/** Set a User's public key if one does not exist already */
const setPublicKey = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');
        if (user.publicKey) throw new Error('User has public key. Delete existing key first.');
        if (!req.body.publicKey) throw new Error('Public key is required');
        user.publicKey = req.body.publicKey;
        await user.save();
        let refreshToken = req.newRefreshToken ||  req.cookies.refreshToken;
        let accessToken = res.getHeader('New-Access-Token') || req.get('Authorization').split(" ")[1];
        //const tokens = await tokenService.refreshTokens(refreshToken);
        const tokens = await tokenService.refreshTokensIdempotent({accessToken,refreshToken});
        tokenService.setCookie(res, tokens.refreshToken);
        res.set('New-Access-Token', tokens.accessToken);
        console.log('Public key refreshed token');
        res.json(user);
    } catch (error) {
        console.error(error);
        utils.respondWithStatus(res);
    }
}

/** TODO: Return information about current refresh cookie of User */
const getTokenStatus = async (req, res, next) => {

}

/** Manual endpoint for refreshing jwts */
const manualRefreshToken = async (req, res, next) => {
    // verify jwt signature
    try {
        const bearer = req.get('Authorization');
        if (!bearer) return res.status(401).json({ message: 'Unauthorized' });
        const jwtToken = bearer.split(' ')[1];
        if (!tokenService.verifySignature(jwtToken)) return res.status(401).json({ message: 'Unauthorized' });
        const refreshToken = req.newRefreshToken || req.cookies.refreshToken;
        if (!refreshToken) return res.status(401).json({ message: 'Unauthorized' });
        //const tokens = await tokenService.refreshTokens(refreshToken);
        const tokens = await tokenService.refreshTokensIdempotent({accessToken:jwtToken,refreshToken});
        tokenService.setCookie(res, tokens.refreshToken);
        res.set('New-Access-Token', tokens.accessToken);
        return res.json({ accessToken: tokens.accessToken });
    } catch (error) {
        console.error(error);
        utils.respondWithStatus(res);
    }
}

const getIdFromUsername = async (username) =>{
    try {
        if(!username) throw new Error('Missing argument');
        const user = await User.findOne({username: username}).collation({strength: 2, locale: 'en'});
        if(!user) throw new Error('User not found');
        return user._id;
    } catch (error) {
        console.error;
        throw error;
    }
}


module.exports = {
    login,
    create,
    logout,
    logoutAll,
    getUserStatus,
    setUserStatus,
    setPublicKey,
    getPublicKey,
    getTokenStatus,
    getIdFromUsername,
    manualRefreshToken,
}