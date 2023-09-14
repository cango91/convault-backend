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
    head: { type: String, ref: 'Message', required: true },
    user1Tail: { type: String, ref: 'Message' },    // tails will be used as the cut-off for when one user
    user2Tail: { type: String, ref: 'Message' }     // deletes a chat, but the other party sends a new message
},
    {
        timestamps: true,
    });

chatSession.pre('save', function (next) {
    if (this.isModified("user1Status") || this.isModified("user2Status")) {
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
    if (this.isModified('user1Tail')){
        this.user1Tail = cryptoService.encrypt(this.user1Tail);
    }
    if (this.isModified('user2Tail')){
        this.user1Tail = cryptoService.encrypt(this.user2Tail);
    }
    next();
});

chatSession.post('findOne', (doc)=>{
    if(doc.user1Tail){
        doc.user1Tail = cryptoService.decrypt(doc.user1Tail);
    }
    if(doc.user2Tail){
        doc.user2Tail = cryptoService.decrypt(doc.user2Tail);
    }
})

chatSession.methods.decryptHead = function () {
    this.head = cryptoService.decrypt(this.head);
}

module.exports = mongoose.model('ChatSession', chatSession);