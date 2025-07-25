const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const { 
  syncTaskToCalendar, 
  getCalendarEvents, 
  createCalendarEvent,
  deleteCalendarEvent 
} = require('../services/googleCalendar');

// @route   GET api/google-calendar/events
// @desc    Get user's calendar events
// @access  Private
router.get('/events', auth, async (req, res) => {
  try {
    const { timeMin, timeMax } = req.query;
    const result = await getCalendarEvents(req.user.id, timeMin, timeMax);
    
    if (result.success) {
      res.json({ events: result.events });
    } else {
      res.status(400).json({ msg: result.error });
    }
  } catch (error) {
    console.error('Error getting calendar events:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST api/google-calendar/sync-task/:taskId
// @desc    Sync a specific task to Google Calendar
// @access  Private
router.post('/sync-task/:taskId', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task || task.user.toString() !== req.user.id) {
      return res.status(404).json({ msg: 'Task not found' });
    }

    const result = await syncTaskToCalendar(req.user.id, task);
    
    if (result.success) {
      // Update task with calendar event ID
      task.calendarEventId = result.eventId;
      await task.save();
      
      res.json({ 
        msg: 'Task synced to Google Calendar successfully',
        eventId: result.eventId 
      });
    } else {
      res.status(400).json({ msg: result.error });
    }
  } catch (error) {
    console.error('Error syncing task to calendar:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST api/google-calendar/create-event
// @desc    Create a new calendar event
// @access  Private
router.post('/create-event', auth, async (req, res) => {
  try {
    const { title, description, startTime, endTime } = req.body;
    
    if (!title || !startTime || !endTime) {
      return res.status(400).json({ msg: 'Title, start time, and end time are required' });
    }

    const eventData = {
      title,
      description,
      startTime,
      endTime
    };

    const result = await createCalendarEvent(req.user.id, eventData);
    
    if (result.success) {
      res.json({ 
        msg: 'Calendar event created successfully',
        eventId: result.eventId,
        event: result.event
      });
    } else {
      res.status(400).json({ msg: result.error });
    }
  } catch (error) {
    console.error('Error creating calendar event:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   DELETE api/google-calendar/event/:eventId
// @desc    Delete a calendar event
// @access  Private
router.delete('/event/:eventId', auth, async (req, res) => {
  try {
    const result = await deleteCalendarEvent(req.user.id, req.params.eventId);
    
    if (result.success) {
      res.json({ msg: 'Calendar event deleted successfully' });
    } else {
      res.status(400).json({ msg: result.error });
    }
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST api/google-calendar/sync-all-tasks
// @desc    Sync all user's tasks to Google Calendar
// @access  Private
router.post('/sync-all-tasks', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ 
      user: req.user.id, 
      status: { $ne: 'completed' },
      dueDate: { $exists: true }
    });

    const results = [];
    for (const task of tasks) {
      try {
        const result = await syncTaskToCalendar(req.user.id, task);
        if (result.success) {
          task.calendarEventId = result.eventId;
          await task.save();
          results.push({
            taskId: task._id,
            taskTitle: task.title,
            success: true,
            eventId: result.eventId
          });
        } else {
          results.push({
            taskId: task._id,
            taskTitle: task.title,
            success: false,
            error: result.error
          });
        }
      } catch (error) {
        results.push({
          taskId: task._id,
          taskTitle: task.title,
          success: false,
          error: error.message
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      msg: `Synced ${successful} tasks successfully, ${failed} failed`,
      results
    });
  } catch (error) {
    console.error('Error syncing all tasks to calendar:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router; 