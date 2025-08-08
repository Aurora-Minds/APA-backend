const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: function() {
            return !this.githubId; // Email only required if not GitHub OAuth
        },
        unique: true,
        sparse: true,
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
        default: ['English', 'Math', 'Science', 'History', 'Computer Science', 'Art', 'Music', 'Geography']
    },
    xp: {
        type: Number,
        default: 0
    },
    // Email notification preferences
    emailNotifications: {
        taskReminders: {
            type: Boolean,
            default: true
        },
        dailyDigest: {
            type: Boolean,
            default: false
        },
        weeklyReport: {
            type: Boolean,
            default: true
        },
        reminderTime: {
            type: String,
            default: '09:00'
        }
    },
    googleRefreshToken: {
        type: String
    }
});

module.exports = mongoose.model('User', userSchema); 