const mongoose = require('mongoose');
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
const User = require('../../users/models/user');
const Message = require('./message');
let user1,user2;

beforeAll(async () => {
    await mongoose.connect(global.__MONGO_URI__, { useNewUrlParser: true });
    user1 = await User.create({
        username: 'user1',
        email: 'mail1@test.com',
        password: 'strongPassword1!',
    });
    user2 = await User.create({
        username: 'user2',
        email: 'mail2@test.com',
        password: 'alsoVeryStrongPassword!2'
    });
});


afterAll(async () => {
    await mongoose.connection.close();
});

describe('Message Model', () => {
    it('should save a message', async () => {
        const message = await Message.create({ senderId: user1._id, recipientId: user2._id, encryptedContent: 'abc' });
        expect(message).toHaveProperty('_id');
    });

    it('should clear encryptedContent if deleted by both parties', async () => {
        let message = await Message.create({ senderId: user1._id, recipientId: user2._id, encryptedContent: 'abc' });
        
        message.isDeletedRecipient = true;
        message.isDeletedSender = true;
        await message.save();
    
        const updatedMessage = await Message.findById(message._id).exec();
        expect(updatedMessage.encryptedContent).toBe("");
      });

      it('should not clear encryptedContent if deleted by only one party', async ()=>{
        let message = await Message.create({ senderId: user1._id, recipientId: user2._id, encryptedContent: 'abc' });
        message.isDeletedRecipient = true;
        await message.save();
    
        const updatedMessage = await Message.findById(message._id).exec();
        expect(updatedMessage.encryptedContent).toBe("abc");
      })

});