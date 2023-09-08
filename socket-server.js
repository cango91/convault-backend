const http = require('http');
const socketIO = require('socket.io');
const tokenService = require('./utilities/token-service');
const chatService = require('./utilities/chat-service');

module.exports = (app) => {
    const server = http.createServer(app);
    const io = socketIO(server,
        {
            cors:
            {
                origin: "http://localhost:3000",
                methods: ["GET", "POST"]
            },
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
    const onlineUsers = new Set();
    io.on('connect', async (socket) => {
        const id = socket.id;
        const userId = socket.decoded.user._id;
        let authenticated = true;
        onlineUsers.add(userId);
        let safetyMargin = 5000; // 5 seconds
        const reauth = () => {
            authenticated = false;
            socket.timeout(5000).emit('reauth');
            console.log(`${id}: must reauth`);
        }
        // initialize re-auth logic
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

        // send all user sessions
        // setTimeout(async ()=>{
        //     console.log(`${id}: sending all sessions`);
        //     socket.emit("all-sessions", await chatService.getUserSessions(userId));
        // },100);

        socket.on('send-all-sessions', async () =>{
            if(authenticated){
                console.log(`${id}: sending all sessions on request`);
                socket.emit("all-sessions", await chatService.getUserSessions(userId));
            }
        });

        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${id}`);
            onlineUsers.delete(userId);
            clearTimeout(t);
        });
    });
    return server;
}