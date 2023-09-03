const User = require('./models/user');
const tokenService = require('../../utilities/token-service');
const utils = require('../../utilities/utils');

const create = async (req, res, next) => {
    try {
        const user = new User(req.body);
        const accessToken = tokenService.createJwt(user, process.env.JWT_EXP);
        const refreshToken = await tokenService.createRefreshToken(user, process.env.REFRESH_EXP);
        tokenService.setCookie(res,refreshToken);
        await user.save();
        res.json({accessToken});
    } catch (error) {
        console.error(error);
        utils.respondWithStatus(res);
    }
}

const login = async (req, res, next) => {

}
const logout = async (req, res, next) => {

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