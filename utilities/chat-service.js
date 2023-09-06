const Message = require('../modules/chat/models/message');
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

module.exports = { deleteThread }