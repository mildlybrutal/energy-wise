import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
    HumanMessage,
    AIMessage,
    SystemMessage,
} from "@langchain/core/messages";

if (!process.env.GOOGLE_API_KEY) {
    console.error("Error: GOOGLE_API_KEY environment variable is not set.");
    console.error("Please create a .env file and add your Google API Key.");
    process.exit(1);
}

const app = express();

app.use(
    cors({
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true,
    })
);

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true,
    },
});

let model;
try {
    model = new ChatGoogleGenerativeAI({
        model: "gemini-2.0-flash",
        apiKey: process.env.GOOGLE_API_KEY,
        maxOutputTokens: 2048,
    });
    console.log("✅ Google Generative AI Model Initialized");
} catch (error) {
    console.error("❌ Failed to initialize Google Generative AI Model:", error);
    process.exit(1);
}

io.on("connection", (socket) => {
    console.log("✅ User connected:", socket.id);

    let history = [
        new SystemMessage(
            `You are an Energy-Wise assistant, specializing in helping users manage their electricity usage efficiently.

            Your core responsibilities include:
            1. Analyzing electricity bills and usage patterns
            2. Providing customized energy-saving tips based on user location and habits
            3. Calculating potential savings from energy-efficient appliance upgrades
            4. Explaining electricity tariffs and billing structures in simple terms
            5. Offering practical advice for reducing electricity consumption

            When responding:
            - Be conversational yet informative
            - Present numerical data clearly (costs, kWh, estimated savings)
            - Organize longer responses with appropriate spacing between sections
            - Tailor energy-saving tips to the user's specific climate and location
            - Consider local electricity costs in your calculations when provided
            - Keep explanations simple and actionable

            For Indian users specifically:
            - Acknowledge Bharat's energy context and challenges
            - Reference relevant government schemes like PM KUSUM or solar subsidies when appropriate
            - Use rupees as the default currency unless specified otherwise
            - Consider seasonal variations across different regions (monsoon, summers, winters)

            Avoid:
            - Using markdown formatting with asterisks
            - Creating bullet-point lists
            - Providing overly generic advice without considering user context
            - Using technical jargon without explanation

            Always strive to provide practical, implementable solutions that lead to measurable energy savings and reduced electricity bills.`
        ),
    ];

    socket.on("user_message", async (userMessage) => {
        if (
            !userMessage ||
            typeof userMessage !== "string" ||
            userMessage.trim() === ""
        ) {
            socket.emit("bot_message", "Sorry, I received an empty message.");
            return;
        }

        console.log(`[${socket.id}] User: ${userMessage}`);

        try {
            history.push(new HumanMessage(userMessage));

            const res = await model.invoke(history);

            const botReply = res.content;

            if (typeof botReply !== "string") {
                console.error("❌ Unexpected response type from AI:", botReply);
                throw new Error("Invalid response format from AI model.");
            }

            console.log(`[${socket.id}] AI: ${botReply}`);

            history.push(new AIMessage(botReply));

            socket.emit("bot_message", botReply);
        } catch (error) {
            console.error(
                `❌ Error processing message for ${socket.id}:`,
                error
            );
            socket.emit(
                "bot_message",
                "Sorry, I encountered an error while processing your request. Please try again later."
            );
        }
    });

    socket.on("disconnect", (reason) => {
        console.log("🔌 User disconnected:", socket.id, "Reason:", reason);
    });

    socket.on("connect_error", (err) => {
        console.error(`❌ Connect Error for ${socket.id}: ${err.message}`);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

process.on("SIGINT", () => {
    console.log("\n🔌 Shutting down server...");
    io.close(() => {
        console.log("✅ Socket.IO connections closed.");
        server.close(() => {
            console.log("✅ HTTP server closed.");
            process.exit(0);
        });
    });
});
