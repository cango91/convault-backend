const Message = require('../modules/chat/models/message');
const ChatSession = require('../modules/chat/models/chatSession');
const mongoose = require('mongoose');

const AsyncLock = require('async-lock');
const lock = new AsyncLock();

/** Deletes a thread starting from head message (non-ACID)
 *  (in production, use a replica set and enable transactions for atomicity of operation)
 */
const deleteThread = async (chatSession) => {
    return await lock.acquire(chatSession._id, async () => {
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
    userId = typeof(userId) === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
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
        msg = msg.previous ? await Message.findById(msg.previous) : null;
    }
    return unreadCount;
}

const getMessageDate = async(messageId)=>{
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

module.exports = {
    deleteThread,
    fetchUserSessions,
    calculateUnreadCount,
    getUserSessions,
}