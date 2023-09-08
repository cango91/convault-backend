const tokenService = require('../../utilities/token-service');

module.exports = (socket, next) => {
    const token = socket.handshake.query.token;
    tokenService.verifyJwt(token, process.env.JWT_SECRET)
        .catch((err) => {
            return next(new Error('Authentication error'));
        })
        .then(decoded => {
            if (!decoded) return next(new Error('Authentication error'));
            console.log(new Date(decoded.exp * 1000));
            socket.decoded = decoded;
            next();
        });
}