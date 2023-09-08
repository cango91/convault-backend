const mongoose = require('mongoose');

const friendRequestSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending'
    },
},
    {
        timestamps: true,
    });

/** Don't allow sending friend requests to self */
friendRequestSchema.pre("save", async function (next) {
    if (this.recipientId.equals(this.senderId)) return next(new Error('Can not friend yourself'));
    next();
});

friendRequestSchema.methods.accept = async function () {
    if(this.status !== 'pending') throw new Error('Friend request already answered');
    return await this.updateOne({ status: 'accepted' }, { new: true });
}

friendRequestSchema.methods.reject = async function () {
    if(this.status !== 'pending') throw new Error('Friend request already answered');
    return await this.updateOne({ status: 'rejected' }, { new: true });
}

module.exports = mongoose.model('FriendRequest', friendRequestSchema);