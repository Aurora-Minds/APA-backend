const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Chat = require('../models/Chat');
const { AzureOpenAI } = require('openai');
const multer = require('multer');
const pdf = require('pdf-parse');

const upload = multer({ storage: multer.memoryStorage() });

// Initialize Azure OpenAI client lazily to ensure environment variables are loaded
let azureOpenAIClient = null;
let isAzureOpenAIConfigured = true; // Assume configured until proven otherwise

const getAzureOpenAIClient = () => {
    if (azureOpenAIClient) {
        return azureOpenAIClient;
    }
    if (!isAzureOpenAIConfigured) {
        return null;
    }

    const { AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_API_VERSION, AZURE_OPENAI_DEPLOYMENT } = process.env;

    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY || !AZURE_OPENAI_API_VERSION || !AZURE_OPENAI_DEPLOYMENT) {
        console.error('Azure OpenAI environment variables are not fully set. AI assistant will be unavailable.');
        isAzureOpenAIConfigured = false;
        return null;
    }

    try {
        azureOpenAIClient = new AzureOpenAI({
            endpoint: AZURE_OPENAI_ENDPOINT,
            apiKey: AZURE_OPENAI_API_KEY,
            apiVersion: AZURE_OPENAI_API_VERSION,
            deployment: AZURE_OPENAI_DEPLOYMENT,
        });
    } catch (err) {
        console.error('Failed to initialize Azure OpenAI client:', err);
        isAzureOpenAIConfigured = false;
        return null;
    }

    return azureOpenAIClient;
};

const aiNotConfiguredResponse = (res) => {
    return res.status(503).json({ msg: 'The AI assistant is not configured by the administrator.' });
}

const systemMessage = { 
    role: "system", 
    content: "You are a helpful assistant for students with their lab assignments. Please format your responses using Markdown. For example, use bullet points for lists and backticks for code snippets." 
};

// @route   POST api/ai/chat
// @desc    Create a new chat session
// @access  Private
router.post('/chat', [auth, upload.single('file')], async (req, res) => {
    const client = getAzureOpenAIClient();
    if (!client) {
        return aiNotConfiguredResponse(res);
    }

    const { message } = req.body;
    let fullMessage = message;

    try {
        if (req.file) {
            const data = await pdf(req.file.buffer);
            fullMessage = `Attached PDF content: ${data.text}

${message}`;
        }

        const title = message.substring(0, 30);

        const initialMessage = {
            role: 'user',
            content: message,
            attachment: req.file ? { filename: req.file.originalname } : undefined
        };

        const newChat = new Chat({
            user: req.user.id,
            title: title,
            messages: [initialMessage]
        });

        const chat = await newChat.save();

        const completion = await client.chat.completions.create({
            messages: [systemMessage, { role: "user", content: fullMessage }],
            model: process.env.AZURE_OPENAI_DEPLOYMENT,
        });

        const assistantMessage = {
            role: 'assistant',
            content: completion.choices[0].message.content
        };

        chat.messages.push(assistantMessage);
        await chat.save();

        res.json(chat);
    } catch (err) {
        console.error('Error with Azure OpenAI chat completion:', err);
        if (err.status === 401) {
            res.status(503).json({ msg: 'AI service is temporarily unavailable. Please try again later.' });
        } else {
            res.status(500).json({ msg: 'Server Error' });
        }
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

// @route   POST api/ai/chat/:id
// @desc    Send a message in an existing chat
// @access  Private
router.post('/chat/:id', [auth, upload.single('file')], async (req, res) => {
    const client = getAzureOpenAIClient();
    if (!client) {
        return aiNotConfiguredResponse(res);
    }

    const { message } = req.body;
    const chatId = req.params.id;
    let fullMessage = message;

    try {
        if (req.file) {
            const data = await pdf(req.file.buffer);
            fullMessage = `Attached PDF content: ${data.text}

${message}`;
        }

        const chat = await Chat.findById(chatId);

        if (!chat) {
            return res.status(404).json({ msg: 'Chat not found' });
        }

        if (chat.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        const userMessage = {
            role: 'user',
            content: message,
            attachment: req.file ? { filename: req.file.originalname } : undefined
        };

        chat.messages.push(userMessage);

        const messagesForApi = [systemMessage, ...chat.messages.map(m => ({ role: m.role, content: m.content }))];
        const completion = await client.chat.completions.create({
            messages: messagesForApi,
            model: process.env.AZURE_OPENAI_DEPLOYMENT,
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
        if (err.status === 401) {
            res.status(503).json({ msg: 'AI service is temporarily unavailable. Please try again later.' });
        } else {
            res.status(500).json({ msg: 'Server Error' });
        }
    }
});

// @route   DELETE api/ai/chat/:id
// @desc    Delete a chat session
// @access  Private
router.delete('/chat/:id', auth, async (req, res) => {
    try {
        const chat = await Chat.findById(req.params.id);

        if (!chat) {
            return res.status(404).json({ msg: 'Chat not found' });
        }

        // Make sure user owns the chat
        if (chat.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        await Chat.findByIdAndDelete(req.params.id);

        res.json({ msg: 'Chat removed' });
    } catch (err) {
        console.error('Error deleting chat:', err.message);
        if (err.name === 'CastError') {
            return res.status(400).json({ msg: 'Invalid chat ID' });
        }
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;
