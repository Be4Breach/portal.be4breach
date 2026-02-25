import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Send, Loader2, Search, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import BACKEND_URL from "@/lib/api";
import { cn } from "@/lib/utils";

export default function DashboardCopilot() {
    const { token } = useAuth();
    const [query, setQuery] = useState("");
    const [messages, setMessages] = useState<{ role: "user" | "ai", text: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<"chat" | "search">("chat");
    const [isOpen, setIsOpen] = useState(true);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior: "smooth"
            });
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, loading]);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!query.trim()) return;

        const userText = query.trim();
        setMessages(prev => [...prev, { role: "user", text: userText }]);
        setQuery("");
        setLoading(true);

        try {
            const res = await fetch(`${BACKEND_URL}/api/ai/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ query: userText })
            });

            if (!res.ok) {
                throw new Error("Failed to get response");
            }

            const data = await res.json();
            setMessages(prev => [...prev, { role: "ai", text: data.response }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: "ai", text: "Sorry, I am currently unable to answer your query. Please check your connection or try again later." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full flex flex-col bg-slate-50/80 backdrop-blur-xl border border-zinc-200/80 rounded-[2rem] shadow-md overflow-hidden transition-all duration-300">
            {/* Top Tabs Bar - ALWAYS VISIBLE AT THE TOP */}
            <div
                className={cn("flex items-center gap-6 px-7 py-3 border-zinc-200/60 bg-white/40 cursor-pointer transition-colors hover:bg-white/60", isOpen ? "border-b" : "")}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-6 flex-1">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setMode("search"); setIsOpen(true); }}
                        className={cn("flex items-center gap-2 text-sm font-medium transition-colors pb-3 -mb-[13px]", mode === "search" ? "text-orange-500 border-b-2 border-orange-500" : "text-zinc-500 hover:text-zinc-700")}
                    >
                        <Search className="w-4 h-4" />
                        Search
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setMode("chat"); setIsOpen(true); }}
                        className={cn("flex items-center gap-2 text-sm font-medium transition-colors pb-3 -mb-[13px]", mode === "chat" ? "text-orange-500 border-b-2 border-orange-500" : "text-zinc-500 hover:text-zinc-700")}
                    >
                        <MessageSquare className="w-4 h-4" />
                        Chat
                    </button>
                </div>
                <button
                    type="button"
                    className="text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                    {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
            </div>

            {/* Expandable Body */}
            {isOpen && (
                <>
                    {/* Chat Messages Area (Expands if messages exist) */}
                    {messages.length > 0 && (
                        <div ref={chatContainerRef} className="flex-1 w-full bg-slate-50/30 p-6 flex flex-col gap-6 max-h-[500px] overflow-y-auto hide-scrollbar border-b border-zinc-100">
                            {messages.map((m, idx) => (
                                <div key={idx} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
                                    <div className={cn("px-5 py-4 rounded-2xl max-w-[85%] text-sm md:text-base leading-relaxed whitespace-pre-wrap shadow-sm",
                                        m.role === "user" ? "bg-orange-500 text-white rounded-br-none" : "bg-white border text-zinc-800 rounded-bl-none font-medium")}>
                                        {m.text}
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="flex flex-col items-start">
                                    <div className="px-5 py-4 rounded-2xl bg-white border text-zinc-800 rounded-bl-none shadow-sm flex items-center gap-3">
                                        <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                                        <span className="text-sm font-medium text-zinc-500">Searching your database...</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Input Bar - ALWAYS VISIBLE AT THE BOTTOM */}
                    <div className="p-3 bg-white/40">
                        <form onSubmit={handleSearch} className="flex items-center px-1">
                            <input
                                type="text"
                                className="bg-white border focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 flex-1 rounded-full px-6 py-4 text-zinc-800 text-base transition-all shadow-sm"
                                placeholder={mode === "chat" ? "Ask me anything about your security posture..." : "Search for any vulnerability, like 'SQLi'"}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                            {query.trim() && (
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="ml-3 h-12 w-12 flex shrink-0 items-center justify-center bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-1" />}
                                </button>
                            )}
                        </form>
                    </div>
                </>
            )}
        </div>
    );
}
