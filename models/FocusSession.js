const mongoose = require('mongoose');

const focusSessionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    task: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
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
    }
});

// Add indexes for better query performance
focusSessionSchema.index({ user: 1, completedAt: -1 });
focusSessionSchema.index({ task: 1 });

module.exports = mongoose.model('FocusSession', focusSessionSchema); 