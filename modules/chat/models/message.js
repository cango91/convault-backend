const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    encryptedContent: {
        type: String
    },
    status: {
        type: String,
        enum: ['sent','delivered','read','deleted'],
        default: 'sent'
    },
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    isDeletedSender: {
        type: Boolean,
        default: false
    },
    isDeletedRecipient: {
        type: Boolean,
        default: false,
    },
    previous: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    }

},
{
    timestamps:true
});

module.exports = mongoose.model('Message',messageSchema);