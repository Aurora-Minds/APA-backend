const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const passport = require('passport');
const session = require('express-session');
const cors = require('cors');

// Load environment variables FIRST, before any other imports
dotenv.config();

const app = express();

// CORS middleware configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://www.auroraminds.xyz', 'https://auroraminds.xyz']
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'DNT', 'User-Agent', 'X-Requested-With', 'If-Modified-Since', 'Cache-Control', 'Range'],
  exposedHeaders: ['Content-Length', 'Content-Range'],
  maxAge: 86400 // 24 hours
}));

// Session middleware (required for passport) - without Redis for now
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
  // Temporarily remove Redis store to fix the startup issue
}));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/academic-app', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log('MongoDB Connection Error:', err));

// Routes
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const userRoutes = require('./routes/users');
const focusSessionRoutes = require('./routes/focusSessions');
const leaderboardRoutes = require('./routes/leaderboard');
const aiRoutes = require('./routes/ai');
const githubAuthRoutes = require('./routes/githubAuth');
const emailReminderRoutes = require('./routes/emailReminders');
const analyticsRoutes = require('./routes/analytics');
const googleCalendarRoutes = require('./routes/googleCalendar');

app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/auth', githubAuthRoutes); // GitHub OAuth routes
app.use('/api/tasks', taskRoutes);
app.use('/api/focus-sessions', focusSessionRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/email-reminders', emailReminderRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/google-calendar', googleCalendarRoutes);

const PORT = process.env.PORT || 5001;

// Initialize scheduled email jobs
const { initScheduledEmails } = require('./services/scheduledEmails');
initScheduledEmails();

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));