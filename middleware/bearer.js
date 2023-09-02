const tokenService = require('../utilities/token-service');
module.exports = async (req, res, next) => {
    let token = req.get('Authorization');
    req.user = null; // default to null
    if (token) {
        token = token.replace('Bearer ', '');
        try {
            // try to verify jwt
            const decoded = await tokenService.verifyJwt(token);
            req.user = decoded.user;
            return next();
        } catch (e) {
            if (e.name === 'TokenExpiredError') {
                const refreshToken = req.cookies.refreshToken;
                if (refreshToken) {
                    try {
                        const tokens = await tokenService.refreshTokens(refreshToken);
                        req.user = tokenService.getUserFromToken(tokens.accessToken);
                        res.set('New-Access-Token', tokens.accessToken);
                        res.cookie('refreshToken', tokens.refreshToken, {
                            httpOnly: true,
                            sameSite: 'strict',
                            secure: process.env.NODE_ENV
                                    && process.env.NODE_ENV.toLowerCase() === 'production'
                        });
                        return next();
                    } catch (err) {
                        // Fall through to end, where req.user is already null.
                    }
                }
            }
            // Fall through to end, where req.user is already null.
        }
    }
    // If code execution reaches this point, req.user is already null.
    return next();
}