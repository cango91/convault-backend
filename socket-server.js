const http = require('http');
const socketIO = require('socket.io');
const tokenService = require('./utilities/token-service');

module.exports = (app) => {
    const server = http.createServer(app);
    const io = socketIO(server,
        {
            cors:
            {
                origin: "http://localhost:3000",
                methods: ["GET", "POST"]
            }
        });
    // middleware for initial jwt handshake
    io.use((socket, next) => {
        const token = socket.handshake.query.token;
        tokenService.verifyJwt(token, process.env.JWT_SECRET)
            .catch((err) => {
                return next(new Error('Authentication error'));
            })
            .then(decoded => {
                socket.decoded = decoded;
                next();
            });
    });
    io.on('connect', (socket) => {
        console.log(`New client connected: ${socket.id}`);

        io.on('disconnect', socket => {
            console.log(`Client disconnected: ${socket.id}`);
        });

    });
    return server;
}