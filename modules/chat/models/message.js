const mongoose = require('mongoose');
const cryptoService = require('../../../utilities/crypto-service');

const messageSchema = new mongoose.Schema({
    encryptedContent: {
        type: String
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read', 'deleted'],
        default: 'sent',
        required: true,
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
        default: false,
        required: true,
    },
    isDeletedRecipient: {
        type: Boolean,
        default: false,
        required: true,
    },
    previous: {
        type: String,
        ref: 'Message'
    },
    createdAt: {type: mongoose.Schema.Types.Mixed},
    updatedAt: {type: mongoose.Schema.Types.Mixed},

},
    {
        timestamps: false
    });

/** If both parties deleted message, empty the message content */
messageSchema.pre('save', function (next) {
    this._wasModified = this.isModified('isDeletedRecipient') || this.isModified('isDeletedSender');
    next();
});

messageSchema.post('save', async function (doc, next) {
    if (!doc._wasModified) return next();
    if (doc.isDeletedRecipient && doc.isDeletedSender) {
        await doc.updateOne({ encryptedContent: "", status: "deleted" });
    }
    next();
});

/** Encrypt and decrypt previous field */
/** Encrypt and decrypt timestamps */
messageSchema.pre('save', function (next) {
    if (this.isModified('previous') || this.isNew) {
        if (this.previous) {
            this.previous = cryptoService.encrypt(this.previous.toString());
        }
    }
    next();
});


messageSchema.post('findOne', function (doc) {
    if (doc) {
        if (doc.previous) {
            doc.previous = cryptoService.decrypt(doc.previous);
        }
        doc.createdAt = new Date(cryptoService.decrypt(doc.createdAt));
        doc.updatedAt = new Date(cryptoService.decrypt(doc.updatedAt));
    }
});

messageSchema.pre("save", function(next){
    if(this.isNew)
        this.createdAt = cryptoService.encrypt((new Date()).toString());
    this.updatedAt = cryptoService.encrypt((new Date()).toString());
    next();
});

module.exports = mongoose.model('Message', messageSchema);