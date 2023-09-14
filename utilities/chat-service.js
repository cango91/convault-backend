const Message = require('../modules/chat/models/message');
const ChatSession = require('../modules/chat/models/chatSession');
const mongoose = require('mongoose');
// const ChatSession = mongoose.model('ChatSession');

const AsyncLock = require('async-lock');
const lock = new AsyncLock();

/** Generate a key unique for each pair of users by concating their usernames/ids after sorting */
const generatePairKey = (...users) => {
    const sortedUsers = [users[0], users[1]].sort();
    return sortedUsers.join(':');
}

/** Deletes a thread starting from head message (non-ACID)
 *  (in production, use a replica set and enable transactions for atomicity of operation)
 *  (or use mongoose.session, but more involved)
 */
// const deleteThread = async (chatSession) => {
//     const key = generatePairKey(chatSession.user1, chatSession.user2);
//     return await lock.acquire(key, async () => {
//         // const session = await mongoose.startSession();
//         // session.startTransaction();
//         try {
//             chatSession.decryptHead();
//             let currentMessageId = chatSession.head;
//             while (currentMessageId) {
//                 const message = await Message.findOne({ _id: currentMessageId }) //.session(session);
//                 if (!message) break;
//                 currentMessageId = message.previous;
//                 await Message.deleteOne({ _id: message._id }) //.session(session);
//             }
//             // await session.commitTransaction();
//         } catch (error) {
//             // await session.abortTransaction();
//             throw error;
//         }
//         // finally {
//         //     session.endSession();
//         // }
//     });
// }

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
        if (msg.status === 'read') break;
        else unreadCount++;
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
        const ret = [];
        const sessions = await fetchUserSessions(userId);
        for (let session of sessions) {
            session.decryptHead();
            const unread = await calculateUnreadCount(session, userId);
            const lastDate = await getMessageDate(session.head);
            session = session.toObject();
            session.unreadCount = unread;
            session.lastMessageDate = lastDate;
            ret.push(session);

        }
        return ret;
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
    return session;
}

/** Send message. Updates session head (or creates one) */
const sendMessage = async (recipientId, senderId, content) => {
    return await lock.acquire(generatePairKey(recipientId, senderId), async () => {
        try {
            let message = await createMessage(recipientId, senderId, content);
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
                session = await createSession(senderId, recipientId, message._id);
            }
            await message.save();
            await session.save();
            session.decryptHead();
            message = await Message.findById(message._id);
            return { message, session };
        } catch (error) {
            console.error(error);
            throw error;
        }
    });
}

const getMessagesFrom = async (userId, fromId, session, count = 50) => {
    try {
        // Retrieve first message
        const first = await Message.findById(fromId);
        if (!first) throw new Error('Message not found');
        // Check if the user is an owner of message
        if (!first.recipientId.equals(userId) && !first.senderId.equals(userId)) throw new Error('Invalid message');
        // Retrieve session
        const sess = await ChatSession.findById(session);
        if (!sess) throw new Error('Invalid session');
        // Check if the sessison has user1Tail or user2Tail set for the relevant user
        const userString = sess.user1.equals(userId) ? 'user1' : 'user2';
        let tail = null;
        if (sess[`${userString}Tail`]) {
            tail = sess[`${userString}Tail`];
        }
        const ret = [first];
        let idx = 1;
        let msg = first;
        while (first && idx < count) {
            msg = await Message.findById(msg.previous);
            if (msg) {
                // If we reach tail message, break
                if (tail && msg._id.equals(tail)) break;
                // If the user has deleted the message unilaterally, send empty content
                if ((msg.senderId.equals(userId) && msg.isDeletedSender)
                    || (msg.recipientId.equals(userId) && msg.isDeletedRecipient)) {
                    msg.encryptedContent = "";
                }
                ret.push(msg);
                idx++;
            } else {
                break;
            }
        }
        return ret;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

const sendEncrypted = async (senderId, recipientId, content, key) => {
    return await lock.acquire(generatePairKey(recipientId, senderId), async () => {
        try {
            let message = await createMessage(recipientId, senderId, content);
            message.symmetricKey = key;
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
                session.user1Status = 'active';
                session.user2Status = 'active';
            } else {
                session = await createSession(senderId, recipientId, message._id);
            }
            await message.save();
            await session.save();
            session.decryptHead();
            message = await Message.findById(message._id);
            return { message, session };
        } catch (error) {
            console.error(error);
            throw error;
        }
    });
}

const deleteMessage = async (userId, messageId, both = false) => {
    try {
        const message = await Message.findById(messageId);
        if (!message || (!message.senderId.equals(userId) && !message.recipientId.equals(userId))) throw new Error('Invalid message');
        const deletedBy = message.senderId.equals(userId) ? 'Sender' : 'Recipient';
        if (both && deletedBy === 'Recipient') throw new Error('Not allowed');
        if (!both) {
            message[`isDeleted${deletedBy}`] = true;
        } else {
            message.isDeletedRecipient = true;
            message.isDeletedSender = true;
            message.status = 'deleted';
        }
        await message.save();
        return message[`${deletedBy === 'Sender' ? 'recipient' : 'sender'}Id`]._id;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

const readMessages = async (userId, senderId) => {
    try {
        await Message.updateMany({
            recipientId: userId,
            senderId,
            status: { $nin: ['read', 'deleted'] }
        },
            { status: 'read' });
    } catch (error) {
        console.error(error);
        throw error;
    }
}

const markThreadDeleted = async (userId, session) => {
    try {
        const sess = await ChatSession.findById(session);
        if (!sess || (!sess.user1.equals(userId) && !sess.user2.equals(userId)))
            throw new Error('Invalid session');
        const userString = sess.user1.equals(userId) ? 'user1' : 'user2';
        const key = generatePairKey(sess.user1, sess.user2);
        return await lock.acquire(key, async () => {
            sess.decryptHead();
            sess[`${userString}Tail`] = sess.head;
            sess[`${userString}Status`] = 'deleted';
            await sess.save();
        });
    } catch (error) {
        console.error(error);
        throw error;
    }
}

module.exports = {
    // deleteThread,
    fetchUserSessions,
    calculateUnreadCount,
    getUserSessions,
    sendMessage,
    sendEncrypted,
    getMessagesFrom,
    deleteMessage,
    readMessages,
    markThreadDeleted,
}