const mongoose = require('mongoose');

const ClaimedRewardSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rewardId: {
        type: String,
        required: true
    },
    claimedAt: {
        type: Date,
        default: Date.now
    },
    code: {
        type: String,
        required: true
    }
});

// Ensure a user can claim a specific reward only once
ClaimedRewardSchema.index({ user: 1, rewardId: 1 }, { unique: true });

module.exports = mongoose.model('ClaimedReward', ClaimedRewardSchema);