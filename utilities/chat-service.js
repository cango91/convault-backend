const Message = require('../modules/chat/models/message');
const ChatSession = require('../modules/chat/models/chatSession');
const mongoose = require('mongoose');

const AsyncLock = require('async-lock');
const lock = new AsyncLock();

/** Generate a key unique for each pair of users by concating their usernames/ids after sorting */
const generatePairKey = (...users) => {
    const sortedUsers = [users[0], users[1]].sort();
    return sortedUsers.join(':');
}

/** Deletes a thread starting from head message (non-ACID)
 *  (in production, use a replica set and enable transactions for atomicity of operation)
 */
const deleteThread = async (chatSession) => {
    const key = generatePairKey(chatSession.user1, chatSession.user2);
    return await lock.acquire(key, async () => {
        // const session = await mongoose.startSession();
        // session.startTransaction();
        try {
            chatSession.decryptHead();
            let currentMessageId = chatSession.head;
            while (currentMessageId) {
                const message = await Message.findOne({ _id: currentMessageId }) //.session(session);
                if (!message) break;
                currentMessageId = message.previous;
                await Message.deleteOne({ _id: message._id }) //.session(session);
            }
            // await session.commitTransaction();
        } catch (error) {
            // await session.abortTransaction();
            throw error;
        }
        // finally {
        //     session.endSession();
        // }
    });
}

/** Fetch all sessions with active or archived status for userId */
const fetchUserSessions = async (userId) => {
    userId = typeof (userId) === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
    return await ChatSession.find({
        $or: [
            { user1: userId, user1Status: { $ne: 'deleted' } },
            { user2: userId, user2Status: { $ne: 'deleted' } }]
    });
}

/** Calculate unread count for a session and user */
const calculateUnreadCount = async (session, userId) => {
    let unreadCount = 0;
    const headId = session.head;
    let msg = await Message.findById(headId);
    while (msg) {
        if (!msg.recipientId.equals(userId)) {
            break;
        }
        if (msg.status !== 'read') unreadCount++;
        else break;
        msg = msg.previous ? await Message.findById(msg.previous) : null;
    }
    return unreadCount;
}

const getMessageDate = async (messageId) => {
    return (await Message.findById(messageId)).createdAt;
}

/** Fetch the active and archived sessions of a user with unread messages count */
const getUserSessions = async (userId) => {
    try {
        const sessions = await fetchUserSessions(userId);
        for (let session of sessions) {
            session.decryptHead();
            session.unreadCount = await calculateUnreadCount(session, userId);
            session.lastMessageDate = await getMessageDate(session.head);
        }
        return sessions;
    } catch (error) {
        console.error(error);
        throw error;
    }

}

const createMessage = async (recipientId, senderId, content, status = "sent", previous = null, save = false) => {
    try {
        const message = new Message({
            recipientId,
            senderId,
            encryptedContent: content,
            status,
            previous
        });
        if (save) await message.save();
        return message;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

const createSession = async (user1, user2, head, save = false) => {
    const session = new ChatSession({
        user1,
        user2,
        head
    });
    if (save) await session.save();
}

/** Send message. Updates session head (or creates one) */
const sendMessage = async (recipientId, senderId, content) => {
    return await lock.acquire(generatePairKey(recipientId, senderId), async () => {
        try {
            const message = await createMessage(recipientId, senderId, content);
            // check if a session exists between the users
            let session = await ChatSession.findOne({
                $or: [
                    { user1: recipientId, user2: senderId },
                    { user2: recipientId, user1: senderId }],
            });
            if (session) {
                session.decryptHead();
                message.previous = session.head;
                session.head = message._id;
            } else {
                session = await createSession(recipientId, sendMessage, message._id);
            }
            await message.save();
            await session.save();
            return {message, session};
        } catch (error) {
            console.error(error);
            throw error;
        }
    })

}

module.exports = {
    deleteThread,
    fetchUserSessions,
    calculateUnreadCount,
    getUserSessions,
    sendMessage,
}