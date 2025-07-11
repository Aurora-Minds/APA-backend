const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

// Load environment variables
dotenv.config();

const app = express();

// Enable CORS
app.use(cors({
    exposedHeaders: ['x-auth-token'],
}));

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

app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/focus-sessions', focusSessionRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));