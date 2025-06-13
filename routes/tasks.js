const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const Task = require('../models/Task');

// Middleware to verify JWT token
const auth = require('../middleware/auth');

// @route   GET api/tasks
// @desc    Get all tasks for a user
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const tasks = await Task.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(tasks);
    } catch (err) {
        console.error('Error fetching tasks:', err.message);
        res.status(500).json({ msg: 'Error fetching tasks. Please try again later.' });
    }
});

// @route   POST api/tasks
// @desc    Create a task
// @access  Private
router.post('/', [
    auth,
    [
        check('title', 'Title is required').not().isEmpty().trim(),
        check('subject', 'Subject is required').not().isEmpty().trim(),
        check('dueDate', 'Due date must be a valid date').optional().isISO8601(),
        check('priority', 'Priority must be low, medium, or high').optional().isIn(['low', 'medium', 'high'])
    ]
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const newTask = new Task({
            title: req.body.title.trim(),
            subject: req.body.subject.trim(),
            description: req.body.description?.trim(),
            dueDate: req.body.dueDate,
            priority: req.body.priority || 'medium',
            user: req.user.id
        });

        const task = await newTask.save();
        res.json(task);
    } catch (err) {
        console.error('Error creating task:', err.message);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ msg: 'Invalid task data provided' });
        }
        res.status(500).json({ msg: 'Error creating task. Please try again later.' });
    }
});

// @route   PUT api/tasks/:id
// @desc    Update a task
// @access  Private
router.put('/:id', [
    auth,
    [
        check('title', 'Title is required').optional().not().isEmpty().trim(),
        check('subject', 'Subject is required').optional().not().isEmpty().trim(),
        check('dueDate', 'Due date must be a valid date').optional().isISO8601(),
        check('priority', 'Priority must be low, medium, or high').optional().isIn(['low', 'medium', 'high']),
        check('status', 'Status must be pending, in-progress, or completed').optional().isIn(['pending', 'in-progress', 'completed'])
    ]
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ msg: 'Task not found' });
        }

        // Make sure user owns the task
        if (task.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        // Update only provided fields
        const updateFields = {};
        if (req.body.title) updateFields.title = req.body.title.trim();
        if (req.body.subject) updateFields.subject = req.body.subject.trim();
        if (req.body.description !== undefined) updateFields.description = req.body.description?.trim();
        if (req.body.dueDate) updateFields.dueDate = req.body.dueDate;
        if (req.body.priority) updateFields.priority = req.body.priority;
        if (req.body.status) updateFields.status = req.body.status;

        const updatedTask = await Task.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        res.json(updatedTask);
    } catch (err) {
        console.error('Error updating task:', err.message);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ msg: 'Invalid task data provided' });
        }
        res.status(500).json({ msg: 'Error updating task. Please try again later.' });
    }
});

// @route   DELETE api/tasks/:id
// @desc    Delete a task
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ msg: 'Task not found' });
        }

        // Make sure user owns the task
        if (task.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        await Task.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Task removed' });
    } catch (err) {
        console.error('Error deleting task:', err.message);
        if (err.name === 'CastError') {
            return res.status(400).json({ msg: 'Invalid task ID' });
        }
        res.status(500).json({ msg: 'Error deleting task. Please try again later.' });
    }
});

module.exports = router; 