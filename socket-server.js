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
                if(!decoded) return next(new Error('Authentication error'));
                console.log(new Date(decoded.exp*1000));
                socket.decoded = decoded;
                next();
            });
    });
    io.on('connect', (socket) => {
        const id = socket.id;
        let authenticated = true;
        let safetyMargin = 5000; // 5 seconds
        const reauth = () => {
            authenticated = false;
            socket.emit('reauth');
            console.log(`${id}: must reauth`);
        }
        let t = setTimeout(reauth, socket.decoded.exp * 1000 - Date.now() - safetyMargin);
        socket.on('reauth', ({token}) => {
            if(!typeof(token) === 'string'){
                console.error("invalid reauth token type");
                socket.disconnect();
                return;
            }
            tokenService.verifyJwt(token, process.env.JWT_SECRET)
                .catch((err) => {
                    console.error(err);
                    socket.disconnect();
                    return;
                })
                .then((decoded) => {
                    if(!decoded){
                        console.error('invalid reauth token');
                        socket.disconnect();
                        return;
                    }
                    socket.decoded = decoded;
                    authenticated = true;
                    console.log(`${id} reauth success`);
                    t = setTimeout(reauth, socket.decoded.exp * 1000 - Date.now() - safetyMargin);
                });
        });
        console.log(`New client connected: ${id}`);

        socket.on('disconnect', s => {
            console.log(`Client disconnected: ${id}`);
        });
    });
    return server;
}