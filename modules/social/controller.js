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
        const existing = await FriendRequest.findOne(
            {
                $or: [{
                    senderId: fromUser, recipientId: toUser
                },
                { recipientId: fromUser, senderId: toUser }]
            });
        if (existing) throw new Error('Friend Request already exists');
        const fr = await FriendRequest.create({
            senderId: fromUser,
            recipientId: toUser,
        });
        return await (await fr.populate('recipientId')).populate('senderId');
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function acceptRequest(recipientId, requestId) {
    try {
        const fr = await FriendRequest.findById(requestId);
        if (!fr) throw new Error('Friend Request not found');
        if(!fr.recipientId.equals(recipientId)) throw new Error("Not Allowed");
        const accepted = await fr.accept();
        return await (await accepted.populate("senderId")).populate("recipientId");
    } catch (error) {
        console.error(error);
        throw error;
    }
}
async function rejectRequest(recipientId, requestId) {
    try {
        const fr = await FriendRequest.findById(requestId);
        if (!fr) throw new Error('Friend Request not found');
        if(!fr.recipientId.equals(recipientId)) throw new Error("Not Allowed");
        const rejected = await fr.reject();
        return await (await rejected.populate("senderId")).populate("recipientId");
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function userAcceptsRequestOf(userId, senderId) {
    try {
        const fr = await FriendRequest.findOne({senderId, recipientId: userId, status: 'pending'});
        if(!fr) throw new Error('Friend Request not found');
        return await fr.accept();
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function userRejectsRequestOf(userId, senderId) {
    try {
        const fr = await FriendRequest.findOne({senderId, recipientId: userId, status: 'pending'});
        if(!fr) throw new Error('Friend Request not found');
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

/** What a behemoth of data transformation */
async function getAllFriendsOfUser(userId) {
    try {
        if (!userId) throw new Error('Missing argument');
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');

        const friendRequests = await FriendRequest.aggregate([
            {
                // match where userId is either sender or recipient for friend request
                $match: {
                    $or: [
                        { senderId: new mongoose.Types.ObjectId(userId) },
                        { recipientId: new mongoose.Types.ObjectId(userId) }
                    ],
                }
            },
            {
                $addFields: {
                    // temporary field to hold the other party's ID
                    contactId: {
                        $cond: [
                            { $eq: ["$senderId", new mongoose.Types.ObjectId(userId)] },
                            "$recipientId",
                            "$senderId"
                        ]
                    },
                    // was the friend request sent or received?
                    friendRequest: {
                        _id: "$_id",
                        direction: {
                            $cond: [
                                { $eq: ["$senderId", new mongoose.Types.ObjectId(userId)] },
                                "sent",
                                "received"
                            ]
                        },
                        status: "$status",
                        sentAt: "$createdAt",
                        repliedAt: { $cond: [{ $ne: ["$updatedAt", "$createdAt"] }, "$updatedAt", null] },
                    }
                }
            },
            // get the user from contactId
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
            // if friendRequest is rejected, don't send only username
            {
                $set: { contact: { $cond: [{ $eq: ["$status", 'accepted'] }, "$contact", { username: "$contact.username" }] } }
            },
            {
                $unset: [
                    'contact.password', 'contact.email', 'contact.createdAt',
                    'contact.updatedAt', 'contact.__v']
            },
            // get blocked or blockedby contact info
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
            // add flags for block/blocked by
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
            // cleanup
            {
                $project: {
                    recipientId: 0,
                    senderId: 0,
                    blockedByUser: 0,
                    userBlocked: 0,
                    contactId: 0,
                    __v: 0,
                    _id: 0,
                    status: 0,
                    createdAt: 0,
                    updatedAt: 0,
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
    userAcceptsRequestOf,
    userRejectsRequestOf,
}