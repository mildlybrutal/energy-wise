import { useEffect, useState, useRef, ChangeEvent, KeyboardEvent } from "react";
import { io, Socket } from "socket.io-client";
import ReactMarkdown from "react-markdown";
import "./App.css";
import { Zap, Send, User, MessageSquare } from "lucide-react";

interface Message {
    role: "user" | "assistant" | "system";
    content: string;
}

type ConnectionStatus = "connected" | "disconnected" | "connecting" | "error";

const SOCKET_URL = "http://localhost:3001";
const socket: Socket = io(SOCKET_URL, {
    autoConnect: false,
    reconnectionAttempts: 5,
    reconnectionDelay: 3000,
});

export default function App() {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content:
                "Welcome to Energy-Wise! I'm here to help with all your electricity usage questions.",
        },
    ]);
    const [input, setInput] = useState<string>("");
    const [status, setStatus] = useState<ConnectionStatus>("connecting");
    const [isTyping, setIsTyping] = useState<boolean>(false);

    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        if (status === "connected") {
            inputRef.current?.focus();
        }
    }, [status]);

    useEffect(() => {
        const handleConnect = () => {
            console.log("✅ Socket connected:", socket.id);
            setStatus("connected");
        };

        const handleDisconnect = (reason: Socket.DisconnectReason) => {
            console.log("🔌 Socket disconnected:", reason);
            setStatus("disconnected");
            setMessages((prev) => [
                ...prev,
                {
                    role: "system",
                    content: `Connection lost. Attempting to reconnect...`,
                },
            ]);
        };

        const handleConnectError = (error: Error) => {
            console.error("❌ Socket connection error:", error);
            setStatus("error");
            setMessages((prev) => [
                ...prev,
                {
                    role: "system",
                    content: `Unable to connect to the server. Please check your internet connection.`,
                },
            ]);
        };

        const handleBotMessage = (botMessage: string) => {
            setIsTyping(true);

            setTimeout(() => {
                if (typeof botMessage === "string") {
                    const cleanedMessage = botMessage.replace(/\*\*/g, "");
                    setMessages((prev) => [
                        ...prev,
                        { role: "assistant", content: cleanedMessage },
                    ]);
                } else {
                    console.warn(
                        "Received non-string message from bot:",
                        botMessage
                    );
                    setMessages((prev) => [
                        ...prev,
                        {
                            role: "system",
                            content:
                                "Something went wrong with the assistant's response.",
                        },
                    ]);
                }
                setIsTyping(false);
            }, 800);
        };

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        socket.on("connect_error", handleConnectError);
        socket.on("bot_message", handleBotMessage);

        if (!socket.connected) {
            console.log("Attempting to connect socket...");
            socket.connect();
        }

        return () => {
            console.log("Cleaning up socket listeners...");
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
            socket.off("connect_error", handleConnectError);
            socket.off("bot_message", handleBotMessage);
        };
    }, []);

    const sendMessage = (): void => {
        if (input.trim() === "" || status !== "connected") {
            if (status !== "connected")
                console.warn("Cannot send message, socket not connected.");
            return;
        }
        socket.emit("user_message", input);
        setMessages((prev) => [...prev, { role: "user", content: input }]);
        setInput("");

        if (inputRef.current) {
            inputRef.current.style.height = "auto";
        }
    };

    const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
        setInput(e.target.value);
    };

    const autoResizeTextarea = () => {
        const textarea = inputRef.current;
        if (textarea) {
            textarea.style.height = "auto";
            textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
        }
    };

    const getStatusIndicator = () => {
        switch (status) {
            case "connected":
                return "bg-emerald-500";
            case "connecting":
                return "bg-amber-400 animate-pulse";
            case "disconnected":
                return "bg-gray-500";
            case "error":
                return "bg-rose-500";
            default:
                return "bg-gray-600";
        }
    };

    const fontFamilyClass = "font-switzer font-sans";

    return (
        <div
            className={`flex flex-col h-screen bg-gray-900 ${fontFamilyClass}`}
        >
            <div className="flex flex-col h-screen w-full">
                <header className="flex items-center justify-between px-6 py-4 bg-gray-800 text-gray-100 shadow-lg border-b border-gray-700">
                    <div className="flex items-center space-x-3">
                        <Zap
                            className="w-8 h-8"
                            color="#10b981"
                            strokeWidth={2}
                        />
                        <h1 className="text-xl font-bold tracking-tight text-gray-100">
                            Energy-Wise
                        </h1>
                    </div>
                    <div className="flex items-center space-x-2 bg-gray-700 py-1.5 px-4 rounded-full text-sm">
                        <span
                            className={`w-2.5 h-2.5 rounded-full ${getStatusIndicator()}`}
                        ></span>
                        <span className="font-medium text-gray-100 capitalize">
                            {status}
                        </span>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-900">
                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`mb-3 flex ${
                                msg.role === "user"
                                    ? "justify-end"
                                    : "justify-start"
                            } w-full`}
                        >
                            {msg.role === "system" ? (
                                <div className="py-2 px-4 text-xs text-center text-gray-400 bg-gray-800 rounded-full w-fit mx-auto shadow-md">
                                    <MessageSquare className="inline-block mr-1 w-3 h-3" />
                                    {msg.content}
                                </div>
                            ) : (
                                <div
                                    className={`max-w-2xl rounded-xl px-4 py-3 break-words ${
                                        // Added break-words
                                        msg.role === "assistant"
                                            ? "bg-gray-800 text-gray-100"
                                            : "bg-emerald-600 text-gray-100"
                                    }`}
                                >
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>{" "}
                                    {/* Render content as Markdown */}
                                </div>
                            )}
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex items-start max-w-xs sm:max-w-md md:max-w-lg">
                            <div className="w-8 h-8 mr-2 flex-shrink-0 bg-emerald-600 rounded-full flex items-center justify-center text-gray-100">
                                <Zap className="w-4 h-4" color="white" />
                            </div>
                            <div className="p-4 rounded-2xl rounded-tl-none bg-gray-800 border border-gray-700 shadow-lg">
                                <div className="flex space-x-2">
                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-100"></div>
                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-200"></div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                <div className="px-4 sm:px-6 py-5 bg-gray-800 border-t border-gray-700 shadow-inner">
                    <div className="flex items-end space-x-3 max-w-4xl mx-auto">
                        <div className="relative flex-1">
                            <textarea
                                ref={inputRef}
                                id="message-input"
                                aria-label="Chat message input"
                                className={`w-full bg-gray-700 border border-gray-600 text-gray-100 rounded-2xl px-4 py-3
                resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                disabled:bg-gray-800 min-h-[50px] max-h-[120px] placeholder-gray-400 ${fontFamilyClass}
                text-base leading-relaxed shadow-inner transition-all duration-200`}
                                placeholder={
                                    status === "connected"
                                        ? "Type your message..."
                                        : "Connecting..."
                                }
                                value={input}
                                onChange={(e) => {
                                    handleChange(e);
                                    autoResizeTextarea();
                                }}
                                onKeyDown={handleKeyPress}
                                disabled={status !== "connected"}
                                rows={1}
                            />
                        </div>

                        <button
                            onClick={sendMessage}
                            className={`bg-gradient-to-r from-emerald-600 to-teal-700 text-gray-100 p-3
            rounded-full shadow-lg hover:shadow-emerald-700/30 transition-all duration-200
            transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100
            disabled:cursor-not-allowed flex items-center justify-center
            ${
                input.trim() !== "" && status === "connected"
                    ? "animate-subtle-pulse"
                    : ""
            }`}
                            disabled={
                                status !== "connected" || input.trim() === ""
                            }
                            aria-label="Send message"
                        >
                            <Send className="w-5 h-5" color="white" />
                        </button>
                    </div>

                    <div
                        className={`mt-3 text-xs text-center ${fontFamilyClass} text-gray-400 max-w-2xl mx-auto`}
                    >
                        {status === "connected"
                            ? "Energy-Wise is ready to help with your electricity usage questions"
                            : status === "connecting"
                            ? "Connecting to Energy-Wise assistant..."
                            : status === "disconnected"
                            ? "Disconnected. Attempting to reconnect..."
                            : "Connection error. Please try again later."}
                    </div>
                </div>
            </div>
        </div>
    );
}
