const mongoose = require('mongoose');
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const User = require('../modules/users/models/user');
const Message = require('../modules/chat/models/message');
const chatService = require('./chat-service');
let user1,user2, user3, m1, m2, m3, m4, m5, session, otherSession;
const publicKey = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAvfAcQjTLKwQI9kw/5j+Yym+tpUgeXrVkn1cWmF8lFqM/TL6oISOnciS/vSCJbXKk41T6AR64jgcq+9Vqnh7ghLWULW81ul6v4r+D0vjQccHPUU39jQe+VRYeU/7YIOInapkLb2EfrZy2vKKvKXZPoX9km973ST5ke0jdg7DNbkWHuv/jwEGGkMq3bROYDkPlLwN/6kt5PUZmTE/1/jHwpfkT5THSjeqSc4atu7lbpv8wbAxDCSx17tBvjaaZZJIU8brEEYVAzMWAqm22W8TUJw7LKdXfq9OIaMng4mLQ27hjlUXpWlcw26Db/4aqW8wGZi/+Tn7z/0Dme0aAA1FbpLyofaw4f9wG+k70BuSyEkx1HdsDFwo2sn111mkDvvRwjnLiuqS584j8acRC1X80nIbDdxclc+DKLTiwnR09MxcUiQEfF0r4hRzzK2303sMn9xdbaZfzarcc+LArHEPtat3XIXeojyWoGudG1phaiVyRd4Yh48mi/uG1v1TMs9jBVnUpl8ti4zFXhTEdBTFsrOqeqoRlCo2cbbOdkOlao+UOGHBgyWCCrptfaTAtzzzWo7aDdVhhYnRUmxRb1o+IFLlhcgu4nKzzC0z+DlW79hUUBX7kiLYwJjX3BOArlyD+N0SVzV8BSwN+YXk5eg9kUWJuY8QjOzD7iTtbyPsCKJkCAwEAAQ==
-----END PUBLIC KEY-----`;


beforeAll(async () => {
    const ChatSession = require('../modules/chat/models/chatSession');
    await mongoose.connect(global.__MONGO_URI__, { useNewUrlParser: true });
    user1 = await User.create({
        username: 'user3',
        email: 'mail31@test.com',
        password: 'strongPassword1!',
        publicKey
    });
    user2 = await User.create({
        username: 'user4',
        email: 'mail24@test.com',
        password: 'alsoVeryStrongPassword!2',
        publicKey
    });
    user3 = await User.create({
        username: 'user6',
        email: 'mail2s4@test.com',
        password: 'alsoVeryStrongPassword!2',
        publicKey
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
        previous: m1._id,
    });
    m3 = await Message.create({
        encryptedContent: "message 3: sent",
        senderId: user1,
        recipientId: user2,
        status: 'sent',
        previous: m2._id,
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
        previous: m4._id
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
        console.log(user1Sessions);
        expect(user1Sessions.filter(s => session._id.equals(s._id)).map(s => s.unreadCount)[0]).toBe(0);
        expect(user1Sessions.filter(s => otherSession._id.equals(s._id)).map(s => s.unreadCount)[0]).toBe(0);
        const user2Sessions = await chatService.getUserSessions(user2._id.toString());
        expect(user2Sessions.length).toEqual(1);
        expect(user2Sessions.filter(s => session._id.equals(s._id)).map(s => s.unreadCount)[0]).toBe(2);
        expect(user1Sessions[0].lastMessageDate).toBeInstanceOf(Date);
    })

});


afterAll(async () => {
    await mongoose.connection.close();
});