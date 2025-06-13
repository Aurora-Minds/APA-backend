const mongoose = require('mongoose');

const FocusSessionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['focus', 'shortBreak', 'longBreak'],
        required: true
    },
    duration: {
        type: Number,
        required: true,
        comment: 'Duration of the session in seconds'
    },
    xpEarned: {
        type: Number,
        required: true,
        default: 1,
        comment: 'XP earned from this session'
    },
    completedAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['completed', 'interrupted'],
        default: 'completed',
        comment: 'Whether the session was completed or interrupted'
    },
    notes: {
        type: String,
        trim: true,
        comment: 'Optional notes about the session'
    },
    startedAt: {
        type: Date,
        required: true
    },
    endedAt: {
        type: Date,
        required: true
    }
});

// Add indexes for better query performance
FocusSessionSchema.index({ user: 1, completedAt: -1 });
FocusSessionSchema.index({ type: 1 });

module.exports = mongoose.model('FocusSession', FocusSessionSchema); 