const mongoose = require('mongoose');

const blockedContactSchema = new mongoose.Schema({
    blockerId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    blockedId: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
},
{
    timestamps: true,
});

blockedContactSchema.pre("save", async function (next) {
    if (this.blockerId.equals(this.blockedId)) return next(new Error('Can not block yourself'));
    next();
});

module.exports = mongoose.model('BlockedContact',blockedContactSchema);