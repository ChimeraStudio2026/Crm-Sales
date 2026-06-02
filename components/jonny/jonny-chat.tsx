'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { MessageCircle, Send, X } from 'lucide-react';
import { getTextFromMessage, messageHasToolParts } from '@/lib/jonny/message-utils';

const JONNY_CHAT_API = '/api/jonny/chat';
const CRM_UPDATED_EVENT = 'jonny:crm-updated';

function dispatchCrmUpdated(): void {
  window.dispatchEvent(new CustomEvent(CRM_UPDATED_EVENT));
}

export function JonnyChat() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status, error, clearError } = useChat({
    transport: new DefaultChatTransport({ api: JONNY_CHAT_API }),
    onFinish: ({ message }) => {
      if (message.role === 'assistant' && messageHasToolParts(message)) {
        dispatchCrmUpdated();
      }
    },
  });
  const isBusy = status === 'streaming' || status === 'submitted';
  const lastAssistantText = [...messages].reverse().find((message) => message.role === 'assistant');
  const hasStreamingAssistantText = Boolean(lastAssistantText && getTextFromMessage(lastAssistantText));
  const scrollToBottom = useCallback((): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages, scrollToBottom]);
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isBusy) return;
    clearError();
    sendMessage({ text: trimmed });
    setInput('');
  };
  const handleToggle = (): void => {
    setIsOpen((prev) => !prev);
  };
  return (
    <div className={`jonny-chat-root${isOpen ? ' is-open' : ''}`} aria-live="polite">
      {isOpen ? (
        <>
          <button
            type="button"
            className="jonny-chat-backdrop"
            onClick={handleToggle}
            aria-label="Chiudi chat Jonny"
          />
          <section className="jonny-chat-panel" aria-label="Chat con Jonny">
          <header className="jonny-chat-header">
            <div className="jonny-chat-header-info">
              <span className="jonny-chat-avatar" aria-hidden="true">J</span>
              <div>
                <h2 className="jonny-chat-title">Jonny</h2>
                <p className="jonny-chat-subtitle">Assistente CRM Sales</p>
              </div>
            </div>
            <button
              type="button"
              className="jonny-chat-close"
              onClick={handleToggle}
              aria-label="Chiudi chat"
            >
              <X size={18} />
            </button>
          </header>
          <div className="jonny-chat-messages">
            {messages.length === 0 ? (
              <div className="jonny-chat-empty">
                <p>Ciao! Sono Jonny. Chiedimi qualcosa sui clienti, task, idee o fatturati.</p>
                <ul>
                  <li>«Quanti clienti Top 20% abbiamo?»</li>
                  <li>«Mostrami i task aperti di questa settimana»</li>
                  <li>«Aggiorna l&apos;azione del cliente X con...»</li>
                </ul>
              </div>
            ) : (
              messages.map((message) => (
                <JonnyMessageBubble key={message.id} message={message} />
              ))
            )}
            {isBusy && !hasStreamingAssistantText ? (
              <div className="jonny-chat-message jonny-chat-message-assistant jonny-chat-typing">
                Jonny sta cercando nei dati...
              </div>
            ) : null}
            {error ? (
              <div className="jonny-chat-error" role="alert">
                {error.message.includes('503') || error.message.includes('non configurato')
                  ? 'Jonny non è configurato: manca ANTHROPIC_API_KEY sul server. In locale aggiungila in .env.local e riavvia npm run dev; su Vercel verifica che il nome sia esattamente ANTHROPIC_API_KEY (non ANTHRIOPIC).'
                  : error.message}
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>
          <form className="jonny-chat-form" onSubmit={handleSubmit}>
            <textarea
              className="jonny-chat-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Scrivi a Jonny..."
              rows={2}
              disabled={isBusy}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button
              type="submit"
              className="jonny-chat-send"
              disabled={isBusy || !input.trim()}
              aria-label="Invia messaggio"
            >
              <Send size={18} />
            </button>
          </form>
        </section>
        </>
      ) : null}
      {!isOpen ? (
      <button
        type="button"
        className={`jonny-chat-fab${isOpen ? ' jonny-chat-fab-open' : ''}`}
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Chiudi Jonny' : 'Apri Jonny'}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
        <span className="jonny-chat-fab-label">Jonny</span>
      </button>
      ) : null}
    </div>
  );
}

interface JonnyMessageBubbleProps {
  message: UIMessage;
}

function JonnyMessageBubble({ message }: JonnyMessageBubbleProps) {
  const text = getTextFromMessage(message);
  if (!text) return null;
  const isUser = message.role === 'user';
  return (
    <div className={`jonny-chat-message jonny-chat-message-${isUser ? 'user' : 'assistant'}`}>
      {!isUser ? <span className="jonny-chat-message-author">Jonny</span> : null}
      <p>{text}</p>
    </div>
  );
}
