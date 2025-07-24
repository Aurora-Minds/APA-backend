const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const Task = require('../models/Task');
const User = require('../models/User');

// Middleware to verify JWT token
const auth = require('../middleware/auth');

// @route   GET api/tasks
// @desc    Get all tasks for a user
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const tasks = await Task.find({ user: req.user.id }).sort({ createdAt: -1 });
        
        // Format dates to ensure consistency
        const formattedTasks = tasks.map(task => {
            const taskObj = task.toObject();
            if (taskObj.dueDate) {
                // Ensure the date is in ISO format for consistent frontend handling
                taskObj.dueDate = new Date(taskObj.dueDate).toISOString();
            }
            return taskObj;
        });
        
        res.json(formattedTasks);
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
        check('taskType', 'Task type must be lab, assignment, or project').optional().isIn(['lab', 'assignment', 'project']),
        check('dueDate', 'Due date must be a valid date').optional().custom((value) => {
            if (!value) return true; // Allow empty values
            // Accept both ISO8601 format and YYYY-MM-DD format
            const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (isoRegex.test(value) || dateRegex.test(value)) {
                return true;
            }
            throw new Error('Due date must be in YYYY-MM-DD or ISO8601 format');
        }),
        check('priority', 'Priority must be low, medium, or high').optional().isIn(['low', 'medium', 'high'])
    ]
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        // Handle date properly to avoid timezone issues
        let dueDate = req.body.dueDate;
        console.log('Backend received dueDate:', dueDate);
        
        if (dueDate) {
            if (!dueDate.includes('T')) {
                // If it's just a date string (YYYY-MM-DD), add time to make it local midnight
                dueDate = dueDate + 'T00:00:00.000Z';
                console.log('Backend processed date-only:', dueDate);
            } else {
                // If it includes time, just store it as-is without timezone conversion
                // The frontend will handle the timezone display
                dueDate = dueDate + 'Z'; // Add Z to make it ISO format
                console.log('Backend processed date+time:', dueDate);
            }
        }

        const newTask = new Task({
            title: req.body.title.trim(),
            subject: req.body.subject.trim(),
            taskType: req.body.taskType?.trim(),
            description: req.body.description?.trim(),
            dueDate: dueDate,
            priority: req.body.priority || 'medium',
            user: req.user.id
        });

        const task = await newTask.save();
        
        // Award XP based on priority when creating a task
        let xpGained = 0;
        switch (task.priority) {
            case 'high':
                xpGained = 20;
                break;
            case 'medium':
                xpGained = 15;
                break;
            case 'low':
                xpGained = 10;
                break;
            default:
                xpGained = 5; // For 'none' or any other priority
                break;
        }
        
        if (xpGained > 0) {
            await User.findByIdAndUpdate(req.user.id, { $inc: { xp: xpGained } });
        }
        
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
        check('taskType', 'Task type must be lab, assignment, or project').optional().isIn(['lab', 'assignment', 'project']),
        check('dueDate', 'Due date must be a valid date').optional().custom((value) => {
            if (!value) return true; // Allow empty values
            // Accept both ISO8601 format and YYYY-MM-DD format
            const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (isoRegex.test(value) || dateRegex.test(value)) {
                return true;
            }
            throw new Error('Due date must be in YYYY-MM-DD or ISO8601 format');
        }),
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

        const oldStatus = task.status;

        // Update only provided fields
        const updateFields = {};
        if (req.body.title) updateFields.title = req.body.title.trim();
        if (req.body.subject) updateFields.subject = req.body.subject.trim();
        if (req.body.taskType !== undefined) updateFields.taskType = req.body.taskType?.trim();
        if (req.body.description !== undefined) updateFields.description = req.body.description?.trim();
        if (req.body.dueDate) {
            // Handle date properly to avoid timezone issues
            let dueDate = req.body.dueDate;
            if (dueDate && !dueDate.includes('T')) {
                // If it's just a date string (YYYY-MM-DD), add time to make it local midnight
                dueDate = dueDate + 'T00:00:00.000Z';
            }
            updateFields.dueDate = dueDate;
        }
        if (req.body.priority) updateFields.priority = req.body.priority;
        if (req.body.status) updateFields.status = req.body.status;

        const updatedTask = await Task.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        // If task is marked as completed, award XP
        if (updatedTask.status === 'completed' && oldStatus !== 'completed') {
            let xpGained = 0;
            switch (updatedTask.priority) {
                case 'high':
                    xpGained = 50;
                    break;
                case 'medium':
                    xpGained = 25;
                    break;
                case 'low':
                    xpGained = 15;
                    break;
            }
            if (xpGained > 0) {
                await User.findByIdAndUpdate(req.user.id, { $inc: { xp: xpGained } });
            }
        }

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