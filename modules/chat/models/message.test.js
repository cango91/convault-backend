const mongoose = require('mongoose');
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
const User = require('../../users/models/user');
const Message = require('./message');
let user1, user2;
const publicKey = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAvfAcQjTLKwQI9kw/5j+Yym+tpUgeXrVkn1cWmF8lFqM/TL6oISOnciS/vSCJbXKk41T6AR64jgcq+9Vqnh7ghLWULW81ul6v4r+D0vjQccHPUU39jQe+VRYeU/7YIOInapkLb2EfrZy2vKKvKXZPoX9km973ST5ke0jdg7DNbkWHuv/jwEGGkMq3bROYDkPlLwN/6kt5PUZmTE/1/jHwpfkT5THSjeqSc4atu7lbpv8wbAxDCSx17tBvjaaZZJIU8brEEYVAzMWAqm22W8TUJw7LKdXfq9OIaMng4mLQ27hjlUXpWlcw26Db/4aqW8wGZi/+Tn7z/0Dme0aAA1FbpLyofaw4f9wG+k70BuSyEkx1HdsDFwo2sn111mkDvvRwjnLiuqS584j8acRC1X80nIbDdxclc+DKLTiwnR09MxcUiQEfF0r4hRzzK2303sMn9xdbaZfzarcc+LArHEPtat3XIXeojyWoGudG1phaiVyRd4Yh48mi/uG1v1TMs9jBVnUpl8ti4zFXhTEdBTFsrOqeqoRlCo2cbbOdkOlao+UOGHBgyWCCrptfaTAtzzzWo7aDdVhhYnRUmxRb1o+IFLlhcgu4nKzzC0z+DlW79hUUBX7kiLYwJjX3BOArlyD+N0SVzV8BSwN+YXk5eg9kUWJuY8QjOzD7iTtbyPsCKJkCAwEAAQ==
-----END PUBLIC KEY-----`;

beforeAll(async () => {
    await mongoose.connect(global.__MONGO_URI__, { useNewUrlParser: true });
    user1 = await User.create({
        username: 'user1',
        email: 'mail1@test.com',
        password: 'strongPassword1!',
        publicKey
    });
    user2 = await User.create({
        username: 'user2',
        email: 'mail2@test.com',
        password: 'alsoVeryStrongPassword!2',
        publicKey
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

    it('should not clear encryptedContent if deleted by only one party', async () => {
        let message = await Message.create({ senderId: user1._id, recipientId: user2._id, encryptedContent: 'abc' });
        message.isDeletedRecipient = true;
        await message.save();

        const updatedMessage = await Message.findById(message._id).exec();
        expect(updatedMessage.encryptedContent).toBe("abc");
    });

});

describe('Message Schema Hooks', () => {
    const cryptoService = require('../../../utilities/crypto-service');
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    it('should encrypt and decrypt "previous" field correctly', async () => {
        const msg = new Message({ senderId: user1, recipientId: user2, previous: 'some data' });
        await msg.save();
        const decrypted = cryptoService.decrypt(msg.previous);
        expect(decrypted).toBe('some data');
    });


    it('should encrypt and decrypt timestamps correctly', async () => {
        const createdTime = Date.now();
        const msg = new Message({ senderId: user1, recipientId: user2, previous: 'some data' });
        await msg.save();
        const decryptedCreatedAt = cryptoService.decrypt(msg.createdAt);
        const decryptedUpdatedAt = cryptoService.decrypt(msg.updatedAt);

        // Assuming 1000ms as the acceptable difference between the times.
        expect(Math.abs(new Date(decryptedCreatedAt).getTime() - createdTime)).toBeLessThan(1000);
        expect(Math.abs(new Date(decryptedUpdatedAt).getTime() - createdTime)).toBeLessThan(1000);

        await delay(1500);
        msg.previous = "some newer data";
        const modifiedTime = Date.now();
        await msg.save();
        const modifiedDecryptedCreatedAt = cryptoService.decrypt(msg.createdAt);
        const modifiedDecryptedUpdatedAt = cryptoService.decrypt(msg.updatedAt);
        expect(modifiedDecryptedCreatedAt).toEqual(decryptedCreatedAt);
        expect(modifiedDecryptedUpdatedAt).not.toEqual(decryptedUpdatedAt);
        expect(Math.abs(new Date(modifiedDecryptedUpdatedAt).getTime() - modifiedTime)).toBeLessThan(1000);
        console.log(modifiedDecryptedUpdatedAt);
    });

});