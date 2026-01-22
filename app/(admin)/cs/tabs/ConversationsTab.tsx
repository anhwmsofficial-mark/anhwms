'use client';

import { useState, useEffect, useCallback } from 'react';
import { CSConversation, CSMessage, CSResponse } from '@/types';
import {
  PaperAirplaneIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

interface ConversationState extends CSConversation {
  partnerName?: string;
}

interface CSApiResponse {
  conversationId: string;
  intent: CSResponse['intent'];
  response: CSResponse;
}

export default function ConversationsTab() {
  const [conversations, setConversations] = useState<ConversationState[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [messagesMap, setMessagesMap] = useState<Record<string, CSMessage[]>>({});
  const [newMessage, setNewMessage] = useState('');
  const [showTranslation, setShowTranslation] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConversations([]);
  }, []);

  const appendMessages = useCallback((conversationId: string, newMessages: CSMessage[]) => {
    setMessagesMap((prev) => {
      const existing = prev[conversationId] ?? [];
      return {
        ...prev,
        [conversationId]: [...existing, ...newMessages],
      };
    });
  }, []);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    setIsSending(true);
    setError(null);

    try {
      const conversationId = selectedConvo ?? undefined;

      const response = await fetch('/api/cs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          channel: 'wechat',
          lang: 'zh',
          message: newMessage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '오류가 발생했습니다.' }));
        throw new Error(errorData.error || '메시지 전송에 실패했습니다.');
      }

      const data = (await response.json()) as CSApiResponse;
      const convoId = data.conversationId;

      if (!selectedConvo) {
        setSelectedConvo(convoId);
      }

      setConversations((prev) => {
        const exists = prev.some((convo) => convo.id === convoId);
        if (exists) {
          return prev.map((convo) =>
            convo.id === convoId
              ? {
                  ...convo,
                  updatedAt: new Date(),
                  status: 'open',
                }
              : convo
          );
        }
        return [
          ...prev,
          {
            id: convoId,
            channel: 'wechat',
            langIn: 'zh',
            status: 'open',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
      });

      const toolInfo = data.response.toolCalls?.[0];

      const partnerMessage: CSMessage = {
        id: `${convoId}-partner-${Date.now()}`,
        convoId,
        role: 'partner',
        lang: 'zh',
        content: newMessage,
        intent: data.response.intent,
        createdAt: new Date(),
        slots: data.response.slots,
      };

      const aiMessage: CSMessage = {
        id: `${convoId}-ai-${Date.now()}`,
        convoId,
        role: 'ai',
        lang: 'zh',
        content: data.response.response,
        intent: data.response.intent,
        createdAt: new Date(),
        slots: data.response.slots,
        toolName: toolInfo?.name,
        toolPayload: toolInfo?.payload,
        toolResult: toolInfo?.result,
      };

      appendMessages(convoId, [partnerMessage, aiMessage]);
      setNewMessage('');
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? '메시지 전송 중 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  const currentMessages = selectedConvo ? messagesMap[selectedConvo] ?? [] : [];

  return (
    <div className="grid grid-cols-3 gap-6 h-[calc(100vh-200px)]">
      <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
        <div className="border-b border-gray-200 px-4 py-3">
          <h3 className="text-lg font-semibold text-gray-900">대화 목록</h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">대화가 없습니다</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {conversations.map((convo) => (
                <button
                  key={convo.id}
                  onClick={() => setSelectedConvo(convo.id)}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                    selectedConvo === convo.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">
                      {convo.subject || convo.partnerName || '대화'}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        convo.status === 'open'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {convo.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {convo.channel} • {convo.langIn.toUpperCase()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="col-span-2 bg-white rounded-lg shadow overflow-hidden flex flex-col">
        {selectedConvo ? (
          <>
            <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {conversations.find((c) => c.id === selectedConvo)?.subject || '대화'}
                </h3>
                <p className="text-sm text-gray-500">
                  {conversations.find((c) => c.id === selectedConvo)?.channel}
                </p>
              </div>
              <button
                onClick={() => setShowTranslation(!showTranslation)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {showTranslation ? '번역 숨기기' : '번역 보기'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {currentMessages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  메시지가 없습니다. 대화를 시작하세요.
                </div>
              ) : (
                currentMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'partner' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        msg.role === 'partner'
                          ? 'bg-gray-100 text-gray-900'
                          : msg.role === 'ai'
                          ? 'bg-blue-100 text-blue-900'
                          : 'bg-green-100 text-green-900'
                      }`}
                    >
                      <div className="text-sm font-medium mb-1">
                        {msg.role === 'partner' ? '파트너' : msg.role === 'ai' ? 'AI' : '에이전트'}
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                      {showTranslation && msg.lang === 'zh' && (
                        <div className="text-xs text-gray-500 mt-1 border-t pt-1">
                          [번역] {msg.content}
                        </div>
                      )}
                      {msg.intent && (
                        <div className="text-xs text-gray-500 mt-1">의도: {msg.intent}</div>
                      )}
                      {msg.toolName && (
                        <div className="text-xs text-gray-400 mt-1">
                          Tool: {msg.toolName}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-gray-200 p-4">
              {error && (
                <div className="mb-2 text-sm text-red-600 flex items-center gap-2">
                  <XCircleIcon className="h-5 w-5" />
                  {error}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isSending && handleSendMessage()}
                  placeholder="메시지를 입력하세요..."
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSending}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isSending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <button className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50" disabled>
                  <CheckCircleIcon className="h-4 w-4 inline mr-1" />
                  AI 응답 생성
                </button>
                <button className="text-sm text-gray-600 hover:text-gray-700" disabled>
                  템플릿 선택
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            대화를 선택하거나 새 메시지를 전송하세요
          </div>
        )}
      </div>
    </div>
  );
}

