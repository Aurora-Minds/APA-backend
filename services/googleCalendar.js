const { google } = require('googleapis');
const User = require('../models/User');

// Google OAuth2 setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const scopes = [
  'https://www.googleapis.com/auth/calendar.events'
];

// Create calendar event
const createCalendarEvent = async (userId, eventData) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.googleRefreshToken) {
      throw new Error('User not found or Google Calendar not connected');
    }

    // Set credentials using refresh token
    oauth2Client.setCredentials({
      refresh_token: user.googleRefreshToken
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const event = {
      summary: eventData.title,
      description: eventData.description || '',
      start: {
        dateTime: eventData.startTime,
        timeZone: 'UTC',
      },
      end: {
        dateTime: eventData.endTime,
        timeZone: 'UTC',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 30 }, // 30 minutes before
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    return {
      success: true,
      eventId: response.data.id,
      event: response.data
    };
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Sync task to Google Calendar
const syncTaskToCalendar = async (userId, task) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.googleRefreshToken) {
      throw new Error('User not found or Google Calendar not connected');
    }

    // Set credentials using refresh token
    oauth2Client.setCredentials({
      refresh_token: user.googleRefreshToken
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Calculate event times
    const dueDate = new Date(task.dueDate);
    const startTime = new Date(dueDate);
    startTime.setHours(dueDate.getHours() - 2); // 2 hours before due date
    
    const endTime = new Date(dueDate);
    endTime.setHours(dueDate.getHours() + 1); // 1 hour after due date

    const event = {
      summary: `📚 ${task.title}`,
      description: `Subject: ${task.subject}\nType: ${task.taskType}\n${task.description || ''}`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'UTC',
      },
      colorId: getColorIdForSubject(task.subject),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 60 }, // 1 hour before
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    return {
      success: true,
      eventId: response.data.id,
      event: response.data
    };
  } catch (error) {
    console.error('Error syncing task to calendar:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Get color ID for different subjects
const getColorIdForSubject = (subject) => {
  const colorMap = {
    'Math': '1',      // Red
    'Science': '2',   // Orange
    'English': '3',   // Yellow
    'History': '4',   // Green
    'Computer Science': '5', // Blue
    'Physics': '6',   // Purple
    'Chemistry': '7', // Pink
    'Biology': '8',   // Brown
    'default': '9'    // Gray
  };
  
  return colorMap[subject] || colorMap['default'];
};

// Get user's calendar events
const getCalendarEvents = async (userId, timeMin, timeMax) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.googleRefreshToken) {
      throw new Error('User not found or Google Calendar not connected');
    }

    // Set credentials using refresh token
    oauth2Client.setCredentials({
      refresh_token: user.googleRefreshToken
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin || new Date().toISOString(),
      timeMax: timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Next 7 days
      singleEvents: true,
      orderBy: 'startTime',
    });

    return {
      success: true,
      events: response.data.items
    };
  } catch (error) {
    console.error('Error getting calendar events:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Delete calendar event
const deleteCalendarEvent = async (userId, eventId) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.googleRefreshToken) {
      throw new Error('User not found or Google Calendar not connected');
    }

    // Set credentials using refresh token
    oauth2Client.setCredentials({
      refresh_token: user.googleRefreshToken
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });

    return {
      success: true
    };
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  createCalendarEvent,
  syncTaskToCalendar,
  getCalendarEvents,
  deleteCalendarEvent,
  oauth2Client,
  scopes
}; 