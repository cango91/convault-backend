const mongoose = require('mongoose');
const crypto = require('../../../utilities/crypto-service');


function validateEmailPattern(val) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/gi.test(val);
}

function usernameHasNoWhitespace(val) {
    return !/\s/g.test(val);
}

function validatePasswordPattern(val) {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\.\*!@_\-\(\)\[\]\=\?\'\"\\\/\#\$\%\|\^\&\+\:\;\!\<\>])[a-zA-Z\d\.\*!@_\-\(\)\[\]\=\?\'\"\\\/\#\$\%\|\^\&\+\:\;\!\<\>]{8,}$/.test(val);
}

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        validate: [usernameHasNoWhitespace, "{PATH} must not contain whitespace"]
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        validate: [validateEmailPattern, "{PATH} does not match acceptable email pattern"],
    },
    password: {
        type: String,
        trim: true,
        minLength: 8,
        required: true,
        validate: [validatePasswordPattern, "{PATH} does not meet minimum pattern requirements"]
    },
    salt: {
        type: String,
    },
    publicKey: {
        type: String,
    },
},
    {
        timestamps: true,
        toJSON: {
            transform: function (_, ret) {
                delete ret.password;
                delete ret.email;
                delete ret.salt;
                return ret;
            }
        }
    });

userSchema.pre('save', function (next) {
    // 'this' is the user document
    if (!this.isModified('password')) return next();
    // Replace the password with the computed hash
    try {
        this.password = crypto.hashPassword(this.password);
        return next();
    } catch (error) {
        console.log(error);
        return next(error);
    }
});

userSchema.methods.verifyPassword = function (password) {
    try {
        return crypto.compareHash(password, this.password);
    } catch (error) {
        console.log(error);
        throw error;
    }
}

module.exports = mongoose.model('User', userSchema);