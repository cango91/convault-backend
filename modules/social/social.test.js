const mongoose = require('mongoose');
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const User = require('../users/models/user');
const FR = require('./models/friendRequest');
const BC = require('./models/blockedContacts');
const frCtrl = require('./controller');
let user1, user2;
const publicKey = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAvfAcQjTLKwQI9kw/5j+Yym+tpUgeXrVkn1cWmF8lFqM/TL6oISOnciS/vSCJbXKk41T6AR64jgcq+9Vqnh7ghLWULW81ul6v4r+D0vjQccHPUU39jQe+VRYeU/7YIOInapkLb2EfrZy2vKKvKXZPoX9km973ST5ke0jdg7DNbkWHuv/jwEGGkMq3bROYDkPlLwN/6kt5PUZmTE/1/jHwpfkT5THSjeqSc4atu7lbpv8wbAxDCSx17tBvjaaZZJIU8brEEYVAzMWAqm22W8TUJw7LKdXfq9OIaMng4mLQ27hjlUXpWlcw26Db/4aqW8wGZi/+Tn7z/0Dme0aAA1FbpLyofaw4f9wG+k70BuSyEkx1HdsDFwo2sn111mkDvvRwjnLiuqS584j8acRC1X80nIbDdxclc+DKLTiwnR09MxcUiQEfF0r4hRzzK2303sMn9xdbaZfzarcc+LArHEPtat3XIXeojyWoGudG1phaiVyRd4Yh48mi/uG1v1TMs9jBVnUpl8ti4zFXhTEdBTFsrOqeqoRlCo2cbbOdkOlao+UOGHBgyWCCrptfaTAtzzzWo7aDdVhhYnRUmxRb1o+IFLlhcgu4nKzzC0z+DlW79hUUBX7kiLYwJjX3BOArlyD+N0SVzV8BSwN+YXk5eg9kUWJuY8QjOzD7iTtbyPsCKJkCAwEAAQ==
-----END PUBLIC KEY-----`;


beforeAll(async () => {
    await mongoose.connect(global.__MONGO_URI__, { useNewUrlParser: true });
    user1 = await User.create({
        username: 'usessr1',
        email: 'maaaaail1@test.com',
        password: 'strongPassword1!',
        publicKey
    });
    user2 = await User.create({
        username: 'usessr2',
        email: 'maaail2@test.com',
        password: 'alsoVeryStrongPassword!2',
        publicKey
    });
});

beforeEach(async()=>{
    await FR.deleteMany({});
})


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
            password: 'yetAnotherStrongPassword!3',
            publicKey
        });

        const fr1 = await frCtrl.createRequest(user1, user3);
        const fr2 = await frCtrl.createRequest(user2, user3);

        let foundFr1 = await FR.findById(fr1._id).exec();
        let foundFr2 = await FR.findById(fr2._id).exec();

        expect(foundFr1.status).toBe('pending');
        expect(foundFr2.status).toBe('pending');

        await frCtrl.acceptRequest(user3._id,fr1._id);
        await frCtrl.rejectRequest(user3._id,fr2._id);

        foundFr1 = await FR.findById(fr1._id).exec();
        foundFr2 = await FR.findById(fr2._id).exec();

        expect(foundFr1.status).toBe('accepted');
        expect(foundFr2.status).toBe('rejected');
    });

    it("should not allow other users to accept/reject on the recipient's behalf", async()=>{
        const user3 = await User.create({
            username: 'Yetuzer3',
            email: 'maisl3@test.com',
            password: 'yestAnotherStrongPassword!3',
            publicKey
        });
        const fr1 = await FR.create({senderId:user1,recipientId:user2});
        await expect(frCtrl.acceptRequest(user3, fr1._id )).rejects.toThrow();
        await expect(frCtrl.acceptRequest(user1, fr1._id )).rejects.toThrow();
        await expect(frCtrl.rejectRequest(user3, fr1._id )).rejects.toThrow();
        await expect(frCtrl.rejectRequest(user1, fr1._id )).rejects.toThrow();

    })

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

    it("should get all contacts with blocked/blocked by information", async()=>{
        await FR.deleteMany({});
        await BC.deleteMany({});
        const blockedUser = await User.create({
            username: "blockedUser",
            email: 'somemail@other.com',
            password: 'veryStr0ng!pass',
            publicKey
        });
        const blockingUser = await User.create({
            username: "IbLockEvery0ne",
            email: "blockb@by.com",
            password: "BlockTh1$",
            publicKey
        });
        const pendingUser = await User.create({
            username: "Immapend",
            email: 'user@pending.com',
            password: '123456!!Ts',
            publicKey
        })
        const cr1 = await frCtrl.createRequest(user1,user2);
        await cr1.reject();
        const cr2 = await frCtrl.createRequest(user1,blockingUser);
        await cr2.accept();
        const cr3 = await frCtrl.createRequest(blockedUser,user1);
        await cr3.accept();
        

        const allFriendsBefore = await frCtrl.getAllFriendsOfUser(user1);
        expect(allFriendsBefore.length).toBe(3);

        await frCtrl.blockUser(blockingUser,user1);
        await frCtrl.blockUser(user1,blockedUser);

        const allFriendsAfter = await frCtrl.getAllFriendsOfUser(user1);
        expect(allFriendsAfter.length).toBe(3);

        const blockedContacts = allFriendsAfter.filter(friend => friend.blockedContact).map(x => x.contact._id);
        expect(blockedContacts.length).toBe(1);
        expect(blockedContacts[0]._id).toEqual(blockedUser._id);
        
        const blockingContacts = allFriendsAfter.filter(f=> f.blockedByContact).map(f=>f.contact._id);
        expect(blockingContacts[0]._id).toEqual(blockingUser._id);

        await frCtrl.createRequest(user1,pendingUser);
        const finalFriendList = await frCtrl.getAllFriendsOfUser(user1);
        const pending = finalFriendList.find(f=>f.friendRequest.status==='pending');
        expect(pending.contact.username).toEqual(pendingUser.username);

        console.log(finalFriendList);
        

    });


});