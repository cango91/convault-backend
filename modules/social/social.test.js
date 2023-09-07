const mongoose = require('mongoose');
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const User = require('../users/models/user');
const FR = require('./models/friendRequest');
const BC = require('./models/blockedContacts');
const frCtrl = require('./controller');
let user1, user2;

beforeAll(async () => {
    await mongoose.connect(global.__MONGO_URI__, { useNewUrlParser: true });
    user1 = await User.create({
        username: 'usessr1',
        email: 'maaaaail1@test.com',
        password: 'strongPassword1!',
    });
    user2 = await User.create({
        username: 'usessr2',
        email: 'maaail2@test.com',
        password: 'alsoVeryStrongPassword!2'
    });
});


afterAll(async () => {
    await mongoose.connection.close();
});

describe("Friend Request model", () => {
    it("should create a friend request", async () => {
        const fr = await FR.create({ senderId: user1, recipientId: user2 });
        const found = await FR.findById(fr._id).exec();
        expect(found).toBeTruthy();
    });
    it("should not allow a friend request to self", async () => {
        // await FR.create({senderId:user1, recipientId:user1}) should throw
        await expect(FR.create({ senderId: user1, recipientId: user1 })).rejects.toThrow();
    });
});

describe("Social Controller", () => {
    it("should create a friend request", async () => {
        const fr = await frCtrl.createRequest(user1, user2);
        const found = await FR.findById(fr._id).exec();
        expect(found).toBeTruthy();
    });

    it("should accept/reject friend requests", async () => {
        const user3 = await User.create({
            username: 'uzer3',
            email: 'mail3@test.com',
            password: 'yetAnotherStrongPassword!3'
        });

        const fr1 = await frCtrl.createRequest(user1, user3);
        const fr2 = await frCtrl.createRequest(user2, user3);

        let foundFr1 = await FR.findById(fr1._id).exec();
        let foundFr2 = await FR.findById(fr2._id).exec();

        expect(foundFr1.status).toBe('pending');
        expect(foundFr2.status).toBe('pending');

        await frCtrl.acceptRequest(fr1._id);
        await frCtrl.rejectRequest(fr2._id);

        foundFr1 = await FR.findById(fr1._id).exec();
        foundFr2 = await FR.findById(fr2._id).exec();

        expect(foundFr1.status).toBe('accepted');
        expect(foundFr2.status).toBe('rejected');
    });

    it("should block contacts", async () => {
        const bc = await frCtrl.blockUser(user1._id, user2._id);
        const found = await BC.findById(bc._id).exec();
        expect(found).toBeTruthy();
    });

    it("should unblock contacts by blocked contact id", async () => {
        await BC.deleteMany({});
        const bc = await frCtrl.blockUser(user1._id, user2._id);
        await frCtrl.deleteBlock(bc._id);
        const found = await BC.findById(bc._id).exec();
        expect(found).toBeNull();
    });

    it("should unblock contacts by blocker and blocked user ids", async () => {
        await BC.deleteMany({});
        const bc = await frCtrl.blockUser(user1._id, user2._id);
        await frCtrl.unBlockUser(user1._id, user2._id);
        const found = await BC.findOne({ blockerId: user1._id, blockedId: user2._id }).exec();
        expect(found).toBeNull();
    });

    it("should not allow to block one's self", async () => {
        await BC.deleteMany({});
        let error;
        try {
            await frCtrl.blockUser(user1._id, user1._id);
        } catch (e) {
            error = e;
        }
        expect(error).toBeDefined();
        expect(error.message).toBe('Can not block yourself'); 
    });
});