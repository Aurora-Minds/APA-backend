const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Chat = require('../models/Chat');
const openai = require('openai');
const multer = require('multer');
const pdf = require('pdf-parse');

const upload = multer({ storage: multer.memoryStorage() });

const openaiClient = new openai({
    apiKey: process.env.OPENAI_API_KEY
});

// @route   POST api/ai/chat
// @desc    Create a new chat session
// @access  Private
router.post('/chat', auth, async (req, res) => {
    const { title, message } = req.body;

    try {
        const initialMessage = {
            role: 'user',
            content: message
        };

        const newChat = new Chat({
            user: req.user.id,
            title: title,
            messages: [initialMessage]
        });

        const chat = await newChat.save();

        const completion = await openaiClient.chat.completions.create({
            messages: [{ role: "system", content: "You are a helpful assistant for students with their lab assignments." }, { role: "user", content: message }],
            model: "gpt-3.5-turbo",
        });

        const assistantMessage = {
            role: 'assistant',
            content: completion.choices[0].message.content
        };

        chat.messages.push(assistantMessage);
        await chat.save();

        res.json(chat);
    } catch (err) {
        console.error('Error with OpenAI chat completion:', err);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/ai/chat/history
// @desc    Get user's chat history
// @access  Private
router.get('/chat/history', auth, async (req, res) => {
    try {
        const chats = await Chat.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(chats);
    } catch (err) {
        console.error('Error fetching chat history:', err);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/ai/chat/upload
// @desc    Create a new chat session from a PDF
// @access  Private
router.post('/chat/upload', [auth, upload.single('file')], async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const { chatId } = req.body;

    try {
        const data = await pdf(req.file.buffer);
        const message = data.text;

        let chat;

        if (chatId) {
            chat = await Chat.findById(chatId);
            if (!chat) {
                return res.status(404).json({ msg: 'Chat not found' });
            }
            if (chat.user.toString() !== req.user.id) {
                return res.status(401).json({ msg: 'User not authorized' });
            }

            const userMessage = {
                role: 'user',
                content: message
            };
            chat.messages.push(userMessage);

        } else {
            const initialMessage = {
                role: 'user',
                content: message
            };
            chat = new Chat({
                user: req.user.id,
                title: req.file.originalname,
                messages: [initialMessage]
            });
        }

        const completion = await openaiClient.chat.completions.create({
            messages: chat.messages.map(m => ({ role: m.role, content: m.content })),
            model: "gpt-3.5-turbo",
        });

        const assistantMessage = {
            role: 'assistant',
            content: completion.choices[0].message.content
        };

        chat.messages.push(assistantMessage);
        await chat.save();

        res.json(chat);
    } catch (err) {
        console.error('Error with OpenAI chat completion:', err);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/ai/chat/:id
// @desc    Send a message in an existing chat
// @access  Private
router.post('/chat/:id', auth, async (req, res) => {
    const { message } = req.body;
    const chatId = req.params.id;

    try {
        const chat = await Chat.findById(chatId);

        if (!chat) {
            return res.status(404).json({ msg: 'Chat not found' });
        }

        if (chat.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        const userMessage = {
            role: 'user',
            content: message
        };

        chat.messages.push(userMessage);

        const completion = await openaiClient.chat.completions.create({
            messages: chat.messages.map(m => ({ role: m.role, content: m.content })),
            model: "gpt-3.5-turbo",
        });

        const assistantMessage = {
            role: 'assistant',
            content: completion.choices[0].message.content
        };

        chat.messages.push(assistantMessage);
        await chat.save();

        res.json(chat);
    } catch (err) {
        console.error('Error with OpenAI chat completion:', err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
