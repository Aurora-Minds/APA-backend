const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: function() {
            return !this.githubId; // Password only required if not GitHub OAuth
        }
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    // GitHub OAuth fields
    githubId: {
        type: String,
        unique: true,
        sparse: true
    },
    githubUsername: {
        type: String,
        trim: true
    },
    githubAvatar: {
        type: String
    },
    // OAuth provider
    provider: {
        type: String,
        enum: ['local', 'github'],
        default: 'local'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'system'
    },
    subjects: {
        type: [String],
        default: ['English', 'Math', 'Science', 'History']
    },
    xp: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model('User', userSchema); 