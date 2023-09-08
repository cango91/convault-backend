const http = require('http');
const socketIO = require('socket.io');
const usersController = require('./modules/users/controller');
const tokenService = require('./utilities/token-service');
const chatService = require('./utilities/chat-service');
const socialController = require('./modules/social/controller');
const SlidingWindowRateLimiter = require('./utilities/sliding-window-rate-limiter');

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
                if (!decoded) return next(new Error('Authentication error'));
                console.log(new Date(decoded.exp * 1000));
                socket.decoded = decoded;
                next();
            });
    });

    const onlineUsers = {};

    io.on('connect', async (socket) => {
        const notifyOnline = (id, eventName, eventData) => {
            if (id in onlineUsers) {
                socket.emit(eventName, eventData);
            }
        }
        const id = socket.id;
        const userId = socket.decoded.user._id;
        let authenticated = true;
        if (!onlineUsers[userId]) {
            onlineUsers[userId] = new Set();
        }
        onlineUsers[userId].add(id);
        const friendRequestLimiter = new SlidingWindowRateLimiter();

        let safetyMargin = 5000; // 5 seconds
        const reauth = () => {
            authenticated = false;
            socket.timeout(5000).emit('reauth');
            console.log(`${id}: must reauth`);
        }
        // initialize re-auth logic
        let t = setTimeout(reauth, socket.decoded.exp * 1000 - Date.now() - safetyMargin);
        socket.on('reauth', ({ token }) => {
            if (!typeof (token) === 'string') {
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
                    if (!decoded) {
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

        socket.on('send-friend-request', async ({ friendUsername }) => {
            if (authenticated) {
                if (!friendRequestLimiter.isRateLimited(userId)) {
                    try {
                        const otherId = await usersController.getIdFromUsername(friendUsername);
                        const friendRequest = socialController.createRequest(userId, otherId);
                        socket.emit('friend-request-sent', { friendRequest });
                        notifyOnline('friend-request-received', friendRequest);
                    } catch (error) {
                        socket.emit('error', { event: 'send-friend-request', message: error.message });
                    }
                } else {
                    socket.emit('error', { event: 'send-friend-request', message: 'Too many requests' });
                }
            }
        });

        


        // send out contacts and chat sessions data on session beginning
        try {
            socket.emit('all-contacts', await socialController.getAllFriendsOfUser(userId));
        } catch (error) {
            socket.emit('error', { message: 'Could not retrieve contacts' });
        }

        try {
            socket.emit('all-sessions', await chatService.getUserSessions(userId));
        } catch (error) {
            socket.emit('error', { message: 'Could not retrieve chat sessions' });
        }



        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${id}`);
            //onlineUsers.delete(userId);
            onlineUsers[userId].delete(id);
            if (!onlineUsers[userId].size) delete onlineUsers[userId];
            clearTimeout(t);
        });
    });
    return server;
}