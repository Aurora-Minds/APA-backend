const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const FocusSession = require('../models/FocusSession');
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route   POST api/focus-sessions
// @desc    Create a new focus session
// @access  Private
router.post('/', [
    auth,
    [
        check('taskId', 'Task ID is required').not().isEmpty(),
        check('duration', 'Duration is required').isNumeric(),
        check('xpEarned', 'XP earned is required').isNumeric(),
        check('status', 'Status must be completed or interrupted').optional().isIn(['completed', 'interrupted']),
        check('notes', 'Notes must be a string').optional().isString()
    ]
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { taskId, duration, xpEarned, status, notes } = req.body;

        // Create new focus session
        const newSession = new FocusSession({
            user: req.user.id,
            task: taskId,
            duration,
            xpEarned,
            status: status || 'completed',
            notes
        });

        // Save the session
        const session = await newSession.save();

        // Update user's total XP
        await User.findByIdAndUpdate(
            req.user.id,
            { $inc: { xp: xpEarned } }
        );

        res.json(session);
    } catch (err) {
        console.error('Error creating focus session:', err.message);
        res.status(500).json({ msg: 'Error creating focus session' });
    }
});

// @route   GET api/focus-sessions
// @desc    Get all focus sessions for a user
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const sessions = await FocusSession.find({ user: req.user.id })
            .sort({ completedAt: -1 })
            .populate('task', 'title subject');
        res.json(sessions);
    } catch (err) {
        console.error('Error fetching focus sessions:', err.message);
        res.status(500).json({ msg: 'Error fetching focus sessions' });
    }
});

// @route   GET api/focus-sessions/stats
// @desc    Get focus session statistics for a user
// @access  Private
router.get('/stats', auth, async (req, res) => {
    try {
        const stats = await FocusSession.aggregate([
            { $match: { user: req.user.id } },
            {
                $group: {
                    _id: null,
                    totalSessions: { $sum: 1 },
                    totalDuration: { $sum: '$duration' },
                    totalXp: { $sum: '$xpEarned' },
                    completedSessions: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    },
                    interruptedSessions: {
                        $sum: { $cond: [{ $eq: ['$status', 'interrupted'] }, 1, 0] }
                    }
                }
            }
        ]);

        res.json(stats[0] || {
            totalSessions: 0,
            totalDuration: 0,
            totalXp: 0,
            completedSessions: 0,
            interruptedSessions: 0
        });
    } catch (err) {
        console.error('Error fetching focus session stats:', err.message);
        res.status(500).json({ msg: 'Error fetching focus session statistics' });
    }
});

// @route   GET api/focus-sessions/task/:taskId
// @desc    Get all focus sessions for a specific task
// @access  Private
router.get('/task/:taskId', auth, async (req, res) => {
    try {
        const sessions = await FocusSession.find({
            user: req.user.id,
            task: req.params.taskId
        })
            .sort({ completedAt: -1 })
            .populate('task', 'title subject');
        res.json(sessions);
    } catch (err) {
        console.error('Error fetching task focus sessions:', err.message);
        res.status(500).json({ msg: 'Error fetching task focus sessions' });
    }
});

module.exports = router; 