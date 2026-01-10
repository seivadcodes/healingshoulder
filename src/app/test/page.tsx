'use client';

import { useState, useEffect, useRef } from 'react';

export default function WebSocketTestPage() {
  const [userId, setUserId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<{ id: string; text: string; sender: string; type: 'incoming' | 'outgoing' | 'system' }>>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (text: string, sender: string, type: 'incoming' | 'outgoing' | 'system') => {
    setMessages(prev => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        text,
        sender,
        type
      }
    ]);
  };

  const addSystemMessage = (text: string) => {
    addMessage(text, 'system', 'system');
  };

  const connectWebSocket = () => {
    if (!userId.trim()) {
      setError('Please enter a User ID');
      return;
    }

    // Close existing connection if any
    if (ws) {
      ws.close();
    }

    try {
      const socket = new WebSocket(`ws://178.128.210.229:8085?userId=${userId.trim()}`);
      
      socket.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setError(null);
        addSystemMessage(`✅ Connected as ${userId.trim()}`);
        setWs(socket);
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received message:', data);
          
          // Handle chat messages
          if (data.type === 'chat' && data.payload?.message) {
            addMessage(data.payload.message, data.payload.fromUserId || 'unknown', 'incoming');
          } 
          // Handle any other message types
          else {
            addSystemMessage(`📥 Received: ${JSON.stringify(data)}`);
          }
        } catch (err) {
          console.error('Error parsing message:', err);
          addSystemMessage(`⚠️ Raw message: ${event.data}`);
        }
      };
      
      socket.onclose = (event) => {
        console.log('WebSocket closed:', event.reason);
        setIsConnected(false);
        setWs(null);
        if (event.code !== 1000) { // 1000 = normal closure
          setError('Connection lost. Reconnecting...');
          addSystemMessage('❌ Disconnected from server. Attempting to reconnect...');
          setTimeout(() => {
            connectWebSocket();
          }, 3000);
        }
      };
      
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('WebSocket connection error');
      };
      
    } catch (err) {
      console.error('Connection error:', err);
      setError('Failed to connect to WebSocket server');
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !targetUserId.trim()) {
      setError('Please enter both a message and target User ID');
      return;
    }

    if (!isConnected || !ws) {
      setError('Not connected to WebSocket server. Click "Connect" first.');
      return;
    }

    // Add to UI immediately (optimistic update)
    addMessage(message.trim(), userId || 'me', 'outgoing');
    const currentMessage = message.trim();
    setMessage('');

    try {
      const response = await fetch('http://178.128.210.229:8086', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toUserId: targetUserId.trim(),
          type: 'chat',
          payload: {
            message: currentMessage,
            fromUserId: userId.trim(),
            timestamp: new Date().toISOString()
          }
        }),
      });

      const result = await response.json();
      console.log('Message sent result:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send message');
      }

      if (!result.delivered) {
        addSystemMessage(`ⓘ Message sent but user ${targetUserId.trim()} may be offline`);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      // Don't revert the optimistic update since it might still be delivered
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">WebSocket Test</h1>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              isConnected 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          
          <div className="space-y-6">
            {/* User Setup */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your User ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="Enter your user ID (e.g., user1)"
                    className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isConnected}
                  />
                  <button
                    onClick={connectWebSocket}
                    disabled={!userId.trim() || isConnected}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      isConnected || !userId.trim()
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isConnected ? 'Connected' : 'Connect'}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target User ID
                </label>
                <input
                  type="text"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  placeholder="Enter recipient user ID (e.g., user2)"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Messages Area */}
            <div className="border rounded-lg p-4 h-96 bg-gray-50 overflow-y-auto">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.type === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.type === 'incoming' 
                          ? 'bg-blue-50 text-blue-800 border border-blue-200' 
                          : msg.type === 'outgoing'
                          ? 'bg-green-50 text-green-800 border border-green-200'
                          : 'bg-gray-100 text-gray-600 italic'
                      }`}
                    >
                      {msg.type !== 'system' && (
                        <div className="text-xs font-medium mb-1">
                          {msg.sender === 'me' ? 'You' : msg.sender}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Message Input */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message..."
                  className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    !isConnected || !targetUserId.trim() ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                  disabled={!isConnected || !targetUserId.trim()}
                />
                <button 
                  onClick={sendMessage}
                  disabled={!isConnected || !targetUserId.trim() || !message.trim()}
                  className={`px-6 py-2 rounded-lg font-medium ${
                    !isConnected || !targetUserId.trim() || !message.trim()
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  Send
                </button>
              </div>
              
              {error && (
                <div className="text-red-500 text-sm p-2 bg-red-50 rounded-lg">
                  {error}
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 p-4 rounded-lg text-sm border border-blue-200">
              <p className="font-medium mb-2">How to test:</p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Open this page in <strong>two different browser tabs</strong></li>
                <li><strong>Tab 1:</strong> Your User ID = <code>user1</code>, Target User ID = <code>user2</code></li>
                <li><strong>Tab 2:</strong> Your User ID = <code>user2</code>, Target User ID = <code>user1</code></li>
                <li>Click <strong>Connect</strong> in both tabs</li>
                <li>Start sending messages!</li>
              </ol>
              <p className="mt-3 text-xs text-gray-600">
                Server: WebSocket (<code>ws://178.128.210.229:8085</code>) | HTTP API (<code>http://178.128.210.229:8086</code>)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}