import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, User, Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Message {
    role: "user" | "assistant";
    content: string;
    suggestions?: string[];
    confidence?: number;
}

export default function CopilotChat({ contextIdentityId }: { contextIdentityId?: string }) {
    const { token } = useAuth();
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content: "I'm the Identity Risk Copilot. Ask me about identity risks, MFA gaps, privilege escalations, or remediation strategies. 100% free & offline.",
            suggestions: [
                "Show me a risk summary",
                "Why is MFA important?",
                "Who are the high risk users?",
                "How is the risk score calculated?",
            ],
        },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages]);

    const send = async (text?: string) => {
        const q = text ?? input;
        if (!q.trim() || loading) return;
        setInput("");

        const userMsg: Message = { role: "user", content: q };
        setMessages((prev) => [...prev, userMsg]);
        setLoading(true);

        try {
            const resp = await fetch("/api/identity-risk-intelligence/copilot/query", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ query: q, context_identity_id: contextIdentityId ?? null }),
            });
            if (!resp.ok) throw new Error("Failed");
            const data = await resp.json();
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: data.answer,
                    suggestions: data.suggestions?.slice(0, 3),
                    confidence: data.confidence,
                },
            ]);
        } catch {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Sorry, I couldn't process that. Make sure the backend is running." },
            ]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border border-border/50 flex flex-col h-full">
            <CardHeader className="pb-2 border-b">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-sm">AI Copilot</CardTitle>
                        <CardDescription className="text-[10px]">100% Free · Offline · Open Source</CardDescription>
                    </div>
                </div>
            </CardHeader>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[360px] min-h-[200px]">
                {messages.map((m, i) => (
                    <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
                        {m.role === "assistant" && (
                            <div className="h-6 w-6 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                <Bot className="h-3 w-3 text-violet-400" />
                            </div>
                        )}
                        <div
                            className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${m.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/50 border border-border/50"
                                }`}
                        >
                            <div className="whitespace-pre-wrap">{m.content}</div>
                            {m.confidence !== undefined && m.confidence > 0 && (
                                <Badge variant="outline" className="mt-1.5 text-[9px] h-4">
                                    Confidence: {Math.round(m.confidence * 100)}%
                                </Badge>
                            )}
                            {m.suggestions && m.suggestions.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {m.suggestions.map((s, si) => (
                                        <button
                                            key={si}
                                            onClick={() => send(s)}
                                            className="text-[9px] px-2 py-0.5 rounded-full border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-colors"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {m.role === "user" && (
                            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                                <User className="h-3 w-3" />
                            </div>
                        )}
                    </div>
                ))}
                {loading && (
                    <div className="flex gap-2">
                        <div className="h-6 w-6 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                            <Bot className="h-3 w-3 text-violet-400" />
                        </div>
                        <div className="bg-muted/50 border border-border/50 rounded-lg px-3 py-2">
                            <Loader2 className="h-3 w-3 animate-spin text-violet-400" />
                        </div>
                    </div>
                )}
            </div>

            <CardContent className="p-2 border-t">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        send();
                    }}
                    className="flex gap-2"
                >
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about identity risks..."
                        className="text-xs h-8"
                        disabled={loading}
                    />
                    <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={loading || !input.trim()}>
                        <Send className="h-3 w-3" />
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
