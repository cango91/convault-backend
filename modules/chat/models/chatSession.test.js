const mongoose = require('mongoose');
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
const User = require('../../users/models/user');
const Message = require('./message');
const ChatSession = require('./chatSession');
const crypto = require('../../../utilities/crypto-service');
let user1, user2;

beforeAll(async () => {
    await mongoose.connect(global.__MONGO_URI__, { useNewUrlParser: true });
    user1 = await User.create({
        username: 'user11',
        email: 'mail1@te1st.com',
        password: 'strongPassword1!',
    });
    user2 = await User.create({
        username: 'user21',
        email: 'mail2@tes1t.com',
        password: 'alsoVeryStrongPassword!2'
    });
});

describe('ChatSession Model', () => {
    it('should save and encrypt head', async () => {
        const message = await Message.create({
            encryptedContent: "abc",
            senderId: user1._id,
            recipientId: user2._id
        });

        const session = await ChatSession.create({
            user1: user1._id,
            user2: user2._id,
            head: message._id
        });

        expect(crypto.decrypt(session.head)).toBe(`${message._id.toString()}`);
    });

    it('should delete all messages in a session if session is deleted by both users',async()=>{
        const message1 = await Message.create({
            encryptedContent: "first message",
            senderId: user1._id,
            recipientId: user2._id
        });
        const message2 = await Message.create({
            encryptedContent: "second message",
            senderId: user2._id,
            recipientId: user1._id,
            previous: message1._id
        });
        const session = await ChatSession.create({
            user1: user1._id,
            user2:user2._id,
            head: message2._id
        });
        
        session.user1Status = "deleted";
        session.user2Status = "deleted";
        await session.save();

        const deletedSession = await ChatSession.findById(session._id).exec();
        expect(deletedSession).toBeNull();
        let deletedMessage = await Message.findById(message1._id).exec();
        expect(deletedMessage).toBeNull();
        deletedMessage = await Message.findById(message2._id).exec();
        expect(deletedMessage).toBeNull();
    });

});


afterAll(async () => {
    await mongoose.connection.close();
});

