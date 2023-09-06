const mongoose = require('mongoose');
const chatService = require('../../../utilities/chat-service');
const cryptoService = require('../../../utilities/crypto-service');

const chatSession = new mongoose.Schema({
    user1: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    user2: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    user1Status: {
        type: String,
        enum: ['active', 'deleted', 'archived'],
        default: 'active',
        required: true,
    },
    user2Status: {
        type: String,
        enum: ['active', 'deleted', 'archived'],
        default: 'active',
        required: true,
    },
    head: { type: String, ref: 'Message', required: true }
},
    {
        timestamps: true,
    });

chatSession.pre('save',function (next){
    if(this.isModified("user1Status") || this.isModified("user2Status")){
        this._isModified = true;
    }
    next();
})

chatSession.post('save', async function (doc, next) {
    if (!doc._isModified) {
        return next();
    }
    if (doc.user1Status === 'deleted' && doc.user2Status === 'deleted') {
        try {
            await chatService.deleteThread(doc);
            await doc.deleteOne();
        } catch (error) {
            console.error(error);
            next(error);
        }
    }
    next();
});

chatSession.pre('save', async function (next) {
    if (this.isModified('head') || this.isNew) {
        this.head = cryptoService.encrypt(this.head);
    }
    next();
});

chatSession.methods.decryptHead = function () {
    this.head = cryptoService.decrypt(this.head);
}

module.exports = mongoose.model('ChatSession', chatSession);