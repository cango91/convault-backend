const User = require('./models/user');
const tokenService = require('../../utilities/token-service');
const utils = require('../../utilities/utils');

const create = async (req, res, next) => {
    try {
        const user = new User(req.body);
        await user.save();
        const accessToken = tokenService.createJwt(user, process.env.JWT_EXP);
        const refreshToken = await tokenService.createRefreshToken(user, process.env.REFRESH_EXP);
        tokenService.setCookie(res,refreshToken);
        res.json({accessToken});
    } catch (error) {
        console.error(error);
        utils.respondWithStatus(res);
    }
}

const login = async (req, res, next) => {
    try {
        const {username,password} = req.body;
        //if(!username || !password) throw new Error('Bad Credentials');
        const user = await User.findOne({username});
        if(!user || !(await user.verifyPassword(password))){
            return utils.respondWithStatus(res,401,'Bad Credentials');
        }
        const accessToken = tokenService.createJwt(user, process.env.JWT_EXP);
        const refreshToken = await tokenService.createRefreshToken(user, process.env.REFRESH_EXP);
        tokenService.setCookie(res,refreshToken);
        res.json({accessToken});
    } catch (error) {
        console.error(error);
        utils.respondWithStatus(res);
    }
}
const logout = async (req, res, next) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        await tokenService.revokeRefreshToken(refreshToken);
        res.clearCookie('refreshToken');
        res.json({message: 'Logged out successfully'});
    } catch (error) {
        console.error(error);
        utils.respondWithStatus(res);
    }
}
const logoutAll = async (req, res, next) => {

}
const getUserStatus = async (req, res, next) => {

}
const setUserStatus = async (req, res, next) => {

}
const getPublicKey = async (req, res, next) => {

}
const setPublicKey = async (req, res, next) => {
    try {
        const userId = tokenService.getUserFromToken(req.get('Authorization'))._id;
        const user = await User.findById(userId);
        if(!user) throw new Error('User not found');
        if(user.publicKey) throw new Error('User has public key. Delete existing key first.');
    } catch (error) {
        console.error(error);
        utils.respondWithStatus(res);
    }
}
const getTokenStatus = async (req, res, next) => {

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
}