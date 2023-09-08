const mongoose = require('mongoose');
const FriendRequest = require('./models/friendRequest');
const User = require('../users/models/user');
const BlockedContact = require('./models/blockedContacts');

async function createRequest(user, to) {
    try {
        if (!user || !to) throw new Error('Missing users');
        const fromUser = await User.findById(user);
        const toUser = await User.findById(to);
        if (!fromUser || !toUser) throw new Error('Invalid user');
        const fr = await FriendRequest.create({
            senderId: fromUser,
            recipientId: toUser,
        });
        return fr;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function acceptRequest(requestId) {
    try {
        const fr = await FriendRequest.findById(requestId);
        if (!fr) throw new Error('FriendRequest not found');
        return await fr.accept();
    } catch (error) {
        console.error(error);
        throw error;
    }
}
async function rejectRequest(requestId) {
    try {
        const fr = await FriendRequest.findById(requestId);
        if (!fr) throw new Error('FriendRequest not found');
        return await fr.reject();
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function blockUser(blockerId, blockedId) {
    try {
        if (!blockerId || !blockedId) throw new Error('Missing users');
        const block = await BlockedContact.findOne({ blockerId: blockerId, blockedId: blockedId });
        if (block) throw new Error('User already blocked');
        const blocker = await User.findById(blockerId);
        const blocked = await User.findById(blockedId);
        if (!blocker || !blocked) throw new Error('Invalid user');
        const blockedContact = await BlockedContact.create({
            blockedId: blocked,
            blockerId: blocker
        });
        return blockedContact;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function unBlockUser(blockerId, blockedId) {
    try {
        if (!blockerId || !blockedId) throw new Error('Missing users');

        const block = await BlockedContact.findOne({ blockerId: blockerId, blockedId: blockedId });
        if (!block) throw new Error('No block found');

        await block.deleteOne();
        return true;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function deleteBlock(blockedContactId) {
    try {
        if (!blockedContactId) throw new Error('Missing blockedContactId');

        const block = await BlockedContact.findById(blockedContactId);
        if (!block) throw new Error('No block found');
        await block.deleteOne();
        return true;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function getAllFriendsOfUser(userId) {
    try {
        if (!userId) throw new Error('Missing argument');
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');

        const friendRequests = await FriendRequest.aggregate([
            {
                $match: {
                    $or: [
                        { senderId: new mongoose.Types.ObjectId(userId) },
                        { recipientId: new mongoose.Types.ObjectId(userId) }
                    ],
                    status: { $ne: 'rejected' },
                }
            },
            {
                $addFields: {
                    contactId: {
                        $cond: [
                            { $eq: ["$senderId", new mongoose.Types.ObjectId(userId)] },
                            "$recipientId",
                            "$senderId"
                        ]
                    },
                    friendRequest: {
                        $cond: [
                            { $eq: ["$senderId", new mongoose.Types.ObjectId(userId)] },
                            "sent",
                            "received"
                        ]
                    }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'contactId',
                    foreignField: '_id',
                    as: 'contact'
                }
            },
            {
                $unwind: { path: '$contact' },
            },
            {
                $unset: [
                    'contact.password', 'contact.email', 'contact.createdAt',
                    'contact.updatedAt', 'contact.__v']
            },
            {
                $lookup: {
                    from: 'blockedcontacts',
                    localField: 'contactId',
                    foreignField: 'blockerId',
                    as: 'blockedByUser'
                }
            },
            {
                $lookup: {
                    from: 'blockedcontacts',
                    localField: 'contactId',
                    foreignField: 'blockedId',
                    as: 'userBlocked'
                }
            },
            {
                $addFields: {
                    blockedContact: {
                        $cond: [{ $gt: [{ $size: "$userBlocked" }, 0] }, true, false]
                    },
                    blockedByContact: {
                        $cond: [{ $gt: [{ $size: "$blockedByUser" }, 0] }, true, false]
                    }
                }
            },
            {
                $project: {
                    recipientId: 0,
                    senderId: 0,
                    _id: 0,
                    blockedByUser: 0,
                    userBlocked: 0,
                    contactId: 0,
                    __v: 0,
                }
            }
        ]);

        return friendRequests;

    } catch (error) {
        console.error(error);
        throw error;
    }
}


module.exports = {
    createRequest,
    acceptRequest,
    rejectRequest,
    blockUser,
    unBlockUser,
    deleteBlock,
    getAllFriendsOfUser,
}