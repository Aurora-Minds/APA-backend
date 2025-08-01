const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const Task = require('../models/Task');
const User = require('../models/User');
const { google } = require('googleapis');

// Middleware to verify JWT token
const auth = require('../middleware/auth');

// Function to get an authenticated OAuth2 client
const getOauth2Client = (refreshToken) => {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
};

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
        check('priority', 'Priority must be low, medium, high, or none').optional().custom((value, { req }) => {
            // Only validate priority from request body, ignore headers
            const bodyPriority = req.body.priority;
            if (bodyPriority && !['low', 'medium', 'high', 'none'].includes(bodyPriority)) {
                throw new Error('Priority must be low, medium, high, or none');
            }
            return true;
        })
    ]
], async (req, res) => {
    console.log('Task creation request received:', {
        body: req.body,
        user: req.user.id,
        priorityHeader: req.headers.priority,
        allHeaders: Object.keys(req.headers)
    });
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        console.log('Request body priority:', req.body.priority);
        console.log('Request headers priority:', req.headers.priority);
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { title, subject, taskType, description, dueDate, priority } = req.body;

        const newTask = new Task({
            title: title.trim(),
            subject: subject.trim(),
            taskType: taskType?.trim(),
            description: description?.trim(),
            dueDate: dueDate, // Directly use the ISO string from the frontend
            priority: priority || 'medium',
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

        // Google Calendar integration
        const user = await User.findById(req.user.id);
        if (user.googleRefreshToken) {
            console.log('Found Google Refresh Token for user:', user.email);
            try {
                const oauth2Client = getOauth2Client(user.googleRefreshToken);
                const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

                const event = {
                    summary: task.title,
                    description: task.description,
                    start: {
                        dateTime: task.dueDate,
                        timeZone: 'America/Toronto',
                    },
                    end: {
                        dateTime: task.dueDate, // Assuming a default duration
                        timeZone: 'America/Toronto',
                    },
                };

                console.log('Creating Google Calendar event with data:', JSON.stringify(event, null, 2));

                await calendar.events.insert({
                    calendarId: 'primary',
                    resource: event,
                });

                console.log('Successfully created Google Calendar event.');

            } catch (err) {
                console.error('Error creating Google Calendar event:', err.response ? err.response.data : err.message);
                // Don't block task creation if calendar event fails
            }
        } else {
            console.log('No Google Refresh Token found for this user.');
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

// @route   GET api/tasks/notifications
// @desc    Get tasks due soon for notifications
// @access  Private
router.get('/notifications', auth, async (req, res) => {
    try {
        const now = new Date();
        const oneHourFromNow = new Date(now.getTime() + (60 * 60 * 1000)); // 1 hour from now
        const thirtyMinutesAgo = new Date(now.getTime() - (30 * 60 * 1000)); // 30 minutes ago

        // Find tasks that are due within the next hour and haven't been completed
        const tasksDueSoon = await Task.find({
            user: req.user.id,
            status: { $ne: 'completed' },
            dueDate: {
                $gte: now,
                $lte: oneHourFromNow
            }
        }).sort({ dueDate: 1 });

        // Format the response
        const notifications = tasksDueSoon.map(task => {
            const dueDate = new Date(task.dueDate);
            const timeDiff = dueDate.getTime() - now.getTime();
            const hoursDiff = timeDiff / (1000 * 60 * 60);
            
            return {
                taskId: task._id,
                title: task.title,
                dueDate: task.dueDate,
                hoursUntilDue: Math.round(hoursDiff * 100) / 100,
                message: `"${task.title}" is due in about ${Math.round(hoursDiff * 100) / 100} hours`
            };
        });

        res.json(notifications);
    } catch (err) {
        console.error('Error fetching notifications:', err.message);
        res.status(500).json({ msg: 'Error fetching notifications' });
    }
});

module.exports = router;