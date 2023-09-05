const mongoose = require('mongoose');

const refreshToken = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, required: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    status: {
        type: String,
        enum: ['valid', 'expired', 'revoked'],
        required:true,
        default: 'valid'
    }
},{
    timestamps:true,
});

refreshToken.methods.revoke = function () {
    this.status = 'revoked';
    return this.save();
}

refreshToken.methods.expire = function () {
    this.status = 'expired';
    return this.save();
}

refreshToken.statics.expireAll = function () {
    return this.updateMany(
        { expiresAt: { $lt: new Date() } },
        { status: 'expired' });
}

refreshToken.statics.deleteAllRevokedAndExpired = function () {
    return this.deleteMany(
        { status: { $ne: 'valid' } }
    );
}
/** 
 * Checks if a refreshToken for a given user is valid
 * 
 * Side effect: if the token has expired but status was valid, will modify db record
*/
refreshToken.statics.isValid = async function (user, token) {
    try {
        const storedToken = await this.findOne({ token });
        if (!storedToken)
            return false;
        if(storedToken.status === 'revoked') return false;
        if (storedToken.expiresAt < new Date())
            await storedToken.expire();
        return storedToken.user._id.equals(user._id) && storedToken.status === 'valid';
    } catch (error) {
        console.error(error);
        return false;
    }
}

module.exports = mongoose.model('RefreshToken', refreshToken);