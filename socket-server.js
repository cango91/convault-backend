const http = require('http');
const socketIO = require('socket.io');
const experimentalSanitize = require('./middleware/socket/sanitize.experimental');
const usersController = require('./modules/users/controller');
const tokenService = require('./utilities/token-service');
const chatService = require('./utilities/chat-service');
const socialController = require('./modules/social/controller');
const SlidingWindowRateLimiter = require('./utilities/sliding-window-rate-limiter');
const handshake = require('./middleware/socket/handshake');
const sanitize = require('./middleware/socket/sanitize');

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
    io.use(handshake);
    // middleware for sanitizing user data (strings)
    io.use(sanitize);
    //io.use(experimentalSanitize);
    //io.use(require('./middleware/socket/testing'));

    // track online users' ids with client id sets
    const onlineUsers = {};

    io.on('connect', async (socket) => {
        const id = socket.id;
        const userId = socket.decoded.user._id;

        const notifyOnline = (id, eventName, eventData) => {
            if (id in onlineUsers) {
                Array.from(onlineUsers[id]).forEach(client => {
                    io.to(client).emit(eventName, eventData);
                });
            }
        }
        const emitSynced = (eventName, eventData) => {
            if (!userId in onlineUsers) return;
            Array.from(onlineUsers[userId]).forEach(client => {
                io.to(client).emit(eventName, eventData);
            });
        }

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
                        const response = await socialController.createRequest(userId, otherId);
                        const data = {
                            friendRequest: {
                                _id: response._id,
                                status: 'pending',
                                sentAt: response.createdAt,
                                direction: 'sent',
                            },
                            contact: {
                                username: response.recipientId.username
                            }
                        };
                        //socket.emit('friend-request-sent', { data });
                        emitSynced('friend-request-sent', { data });
                        const notifyData = {
                            ...data,
                            contact: {
                                username: response.senderId.username
                            },
                            friendRequest: {
                                ...data.friendRequest,
                                direction: 'received',
                            }
                        };
                        notifyOnline(otherId, 'friend-request-received', { data: notifyData });
                    } catch (error) {
                        socket.emit('send-friend-request-error', { message: error.message });
                    }
                } else {
                    socket.emit('send-friend-request-error', { message: "Too many requests" });
                }
            }
        });

        socket.on('accept-friend-request', async ({ requestId }) => {
            if (authenticated) {
                try {
                    const response = await socialController.acceptRequest(userId, requestId);
                    const data = {
                        friendRequest: {
                            _id: response._id,
                            repliedAt: response.updatedAt,
                            status: 'accepted',
                        },
                        contact: {
                            _id: response.senderId._id,
                            publicKey: response.senderId.publicKey
                        }
                    }
                    // socket.emit('friend-request-accepted', { data });
                    emitSynced('friend-request-accepted', { data });
                    const notifyData = {
                        ...data,
                        contact: {
                            _id: response.recipientId._id,
                            publicKey: response.recipientId.publicKey
                        }
                    };
                    notifyOnline(response.senderId._id.toString(), 'friend-request-accepted', { data: notifyData });
                } catch (error) {
                    socket.emit('accept-friend-request-error', { message: error.message });
                }
            }
        });

        socket.on('send-message', async ({recipient, content}) => {
            try {
                if(!content.replace(/\s+/g,'')) throw new Error('Empty message');
                content = content.replace(/^\s+|\s+$/g, '')
                const {message, session} = await chatService.sendMessage(recipient, userId,content);
                emitSynced('message-sent',{data: {message, session}});
                notifyOnline(recipient,'message-received',{data: {message,session}});
            } catch (error) {
                socket.emit('send-message-error',{message: error.message, data:{recipient,content}});
            }
        });

        socket.on('get-messages', async ({from, session, count})=>{
            count = Math.min(Math.abs(count || 50));
            try {
                const messages = await chatService.getMessagesFrom(userId,from, session, count);
                emitSynced('messages-retrieved',{messages, session, from});
            } catch (error) {
                console.error(error);
                socket.emit('get-messages-error',{message: error.message, data: {from, session, count}});
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