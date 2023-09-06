const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    encryptedContent: {
        type: String
    },
    status: {
        type: String,
        enum: ['sent','delivered','read','deleted'],
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
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    }

},
{
    timestamps:true
});

/** If both parties deleted message, empty the message content */
messageSchema.pre('save', function (next) {
    this._wasModified = this.isModified('isDeletedRecipient') || this.isModified('isDeletedSender');
    next();
  });  

messageSchema.post('save',async function(doc,next){
    if(!doc._wasModified) return next();
    if(doc.isDeletedRecipient && doc.isDeletedSender){
        await doc.updateOne({encryptedContent:"",status:"deleted"});
    }
    next();
});

module.exports = mongoose.model('Message',messageSchema);