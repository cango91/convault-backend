const mongoose = require('mongoose');
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const User = require('../modules/users/models/user');
const Message = require('../modules/chat/models/message');
const chatService = require('./chat-service');
let user1,user2, user3, m1, m2, m3, m4, m5, session, otherSession;

beforeAll(async () => {
    const ChatSession = require('../modules/chat/models/chatSession');
    await mongoose.connect(global.__MONGO_URI__, { useNewUrlParser: true });
    user1 = await User.create({
        username: 'user3',
        email: 'mail31@test.com',
        password: 'strongPassword1!',
    });
    user2 = await User.create({
        username: 'user4',
        email: 'mail24@test.com',
        password: 'alsoVeryStrongPassword!2'
    });
    user3 = await User.create({
        username: 'user6',
        email: 'mail2s4@test.com',
        password: 'alsoVeryStrongPassword!2'
    });
    
    m1 = await Message.create({
        encryptedContent: "message 1: read",
        senderId: user1,
        recipientId: user2,
        status: 'read'
    });
    m2 = await Message.create({
        encryptedContent: "message 2: delivered",
        senderId: user1,
        recipientId: user2,
        status: 'delivered',
        previous: m1,
    });
    m3 = await Message.create({
        encryptedContent: "message 3: sent",
        senderId: user1,
        recipientId: user2,
        status: 'sent',
        previous: m2,
    });
    m4 = await Message.create({
        encryptedContent: "other users exist",
        senderId: user3,
        recipientId: user1,
        status: 'read'
    }),
    m5 = await Message.create({
        encryptedContent: "read it!",
        senderId: user1,
        recipientId: user3,
        status: 'sent',
        previous: m4
    }),
    
    session = await ChatSession.create({
        head: m3._id.toString(),
        user1: user1,
        user2: user2
    });

    otherSession = await ChatSession.create({
        head: m4._id,
        user1: user3,
        user2: user1,
    })
    
});

describe("Check", ()=>{
    it("chat sessions should exist", async ()=>{
        const ChatSession = require('../modules/chat/models/chatSession');
        const sess = await ChatSession.find({}).exec();
        expect(sess.length).toBeGreaterThan(0);
    })
})

describe("Chat Service", ()=>{
    it("should fetch all sessions of a User", async ()=>{
        const user1Sessions = await chatService.fetchUserSessions(user1);
        const user2Sessions = await chatService.fetchUserSessions(user2._id.toString());
        expect(user1Sessions.length).toEqual(2);
        expect(user2Sessions.length).toEqual(1);
        expect(user2Sessions[0]._id).toEqual(session._id);
    });

    it("should count unread messages for a User correctly", async ()=>{
        let decryptedSession = session;
        decryptedSession.decryptHead();
        const unreads1 = await chatService.calculateUnreadCount(decryptedSession, user1._id);
        const unreads2 = await chatService.calculateUnreadCount(decryptedSession, user2._id);
        expect(unreads1).toBe(0);
        expect(unreads2).toBe(2);       
    });

    it("should get all sessions for user with unread counts", async ()=>{
        const user1Sessions = await chatService.getUserSessions(user1._id);
        expect(user1Sessions.length).toEqual(2);
        expect(user1Sessions.filter(s => s.equals(session)).map(s => s.unreadCount)[0]).toBe(0);
        expect(user1Sessions.filter(s => s.equals(otherSession)).map(s => s.unreadCount)[0]).toBe(0);
        const user2Sessions = await chatService.getUserSessions(user2._id.toString());
        expect(user2Sessions.length).toEqual(1);
        expect(user2Sessions.filter(s => s.equals(session)).map(s => s.unreadCount)[0]).toBe(2);
        expect(user1Sessions[0].lastMessageDate).toBeInstanceOf(Date);
    })

});


afterAll(async () => {
    await mongoose.connection.close();
});