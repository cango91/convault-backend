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
    this.set({status: 'accepted'});
    return await this.save();
}

friendRequestSchema.methods.reject = async function () {
    if(this.status !== 'pending') throw new Error('Friend request already answered');
    this.set({status: 'rejected'});
    return await this.save();
}

module.exports = mongoose.model('FriendRequest', friendRequestSchema);