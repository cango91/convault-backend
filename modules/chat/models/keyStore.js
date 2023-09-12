const mongoose = require('mongoose');
const cryptoService = require('../../../utilities/crypto-service');

const keyStoreSchema = new mongoose.Schema({
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    key: {type: String, required: true},
    value: {type: String, required: true},
    createdAt: {type:mongoose.Schema.Types.Mixed},
    updatedAt: {type:mongoose.Schema.Types.Mixed},
},
{
    timestamps:false,
});

keyStoreSchema.pre("save", function(next){
    if(this.isNew)
        this.createdAt = cryptoService.encrypt((new Date()).toString());
    this.updatedAt = cryptoService.encrypt((new Date()).toString());
    next();
});

keyStoreSchema.post('findOne', function (doc) {
    if (doc) {
        doc.createdAt = new Date(cryptoService.decrypt(doc.createdAt));
        doc.updatedAt = new Date(cryptoService.decrypt(doc.updatedAt));
    }
});

module.exports = mongoose.model('KeyStore',keyStoreSchema);