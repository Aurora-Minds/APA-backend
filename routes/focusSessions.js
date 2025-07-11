const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const FocusSession = require('../models/FocusSession');
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route   POST api/focus-sessions
// @desc    Create a new focus session and award XP
// @access  Private
router.post(
  '/',
  [
    auth,
    [
      check('taskId', 'Task ID is required').not().isEmpty(),
      check('duration', 'Duration is required and must be in seconds').isNumeric(),
      check('startedAt', 'Start date is required').isISO8601(),
      check('endedAt', 'End date is required').isISO8601(),
      check('status', 'Status must be completed or interrupted').isIn(['completed', 'interrupted']),
      check('notes', 'Notes must be a string').optional().isString(),
    ],
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { taskId, duration, startedAt, endedAt, status, notes } = req.body;

      let xpEarned = 0;
      // Award 1 XP per minute ONLY for completed focus sessions
      if (status === 'completed') {
        xpEarned = Math.floor(duration / 60);
      }

      const newSession = new FocusSession({
        user: req.user.id,
        task: taskId,
        type: 'focus', // Hardcode type to 'focus' as we are not tracking breaks
        duration,
        startedAt,
        endedAt,
        status,
        xpEarned,
        notes,
      });

      const session = await newSession.save();

      // If XP was earned, update the user's total XP
      if (xpEarned > 0) {
        await User.findByIdAndUpdate(req.user.id, { $inc: { xp: xpEarned } });
      }

      res.status(201).json(session);
    } catch (err) {
      console.error('Error creating focus session:', err.message);
      res.status(500).json({ msg: 'Server error while creating focus session' });
    }
  }
);

// @route   GET api/focus-sessions
// @desc    Get all focus sessions for the logged-in user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const sessions = await FocusSession.find({ user: req.user.id })
      .sort({ startedAt: -1 })
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