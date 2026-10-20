'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { applyAssistantDraft, quoteToAssistantDraft } from '@/lib/quotes/assistant-apply';
import type { AssistantQuote } from '@/lib/quotes/assistant-schema';
import type { QuoteChatMessage, QuoteDraft } from '@/lib/quotes/types';
import type { ToastType } from '@/providers/crm-provider';

// Basta lo storico recente: la bozza completa viaggia comunque a ogni richiesta.
const HISTORY_LIMIT = 20;

const EXAMPLE_PROMPT =
  'Campagna social per un brand cosmetico, cliente diretto. 1 giorno di shooting a Milano in location, '
  + '5 attori non professionisti, regista e DOP, trucco e styling. Consegna 5 reel 30s 9:16 '
  + 'più 10 foto. Budget intorno ai 19k.';

interface QuoteChatPanelProps {
  readonly quote: QuoteDraft;
  readonly onQuoteChange: (updater: (current: QuoteDraft) => QuoteDraft) => void;
  readonly onToast: (message: string, type?: ToastType) => void;
}

function formatAssistantMessage(result: AssistantQuote): string {
  if (result.openQuestions.length === 0) return result.reply;
  const questions = result.openQuestions.map((question) => `• ${question}`).join('\n');
  return `${result.reply}\n\nDa confermare:\n${questions}`;
}

export function QuoteChatPanel({ quote, onQuoteChange, onToast }: QuoteChatPanelProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [quote.chat.length, isSending]);

  const send = async (): Promise<void> => {
    const text = message.trim();
    if (!text || isSending) return;
    const userMessage: QuoteChatMessage = { role: 'user', content: text, createdAt: new Date().toISOString() };
    const history = quote.chat.slice(-HISTORY_LIMIT).map(({ role, content }) => ({ role, content }));
    setIsSending(true);
    setMessage('');
    onQuoteChange((current) => ({ ...current, chat: [...current.chat, userMessage] }));
    try {
      const response = await fetch('/api/quotes/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, draft: quoteToAssistantDraft(quote), history }),
      });
      const payload = (await response.json().catch(() => ({}))) as { result?: AssistantQuote; error?: string };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error || 'Risposta non valida dall\'assistente.');
      }
      const result = payload.result;
      const assistantMessage: QuoteChatMessage = {
        role: 'assistant',
        content: formatAssistantMessage(result),
        createdAt: new Date().toISOString(),
      };
      onQuoteChange((current) => ({
        ...applyAssistantDraft(current, result.quote),
        chat: [...current.chat, assistantMessage],
      }));
    } catch (error) {
      const errorText = error instanceof Error ? error.message : 'Errore assistente.';
      onToast(errorText, 'danger');
      // Il testo torna nella casella così si può riprovare senza riscriverlo.
      setMessage(text);
      onQuoteChange((current) => ({ ...current, chat: current.chat.filter((entry) => entry !== userMessage) }));
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    void send();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <aside className="glass-card quote-chat">
      <div className="quote-chat-header">
        <Sparkles size={16} />
        <div>
          <strong>Assistente preventivi</strong>
          <p>Descrivi il lavoro: preparo la bozza dal listino. Poi puoi chiedermi modifiche.</p>
        </div>
      </div>
      <div className="quote-chat-messages" ref={listRef}>
        {quote.chat.length === 0 && !isSending ? (
          <div className="quote-chat-empty">
            <p>Esempio di richiesta:</p>
            <button type="button" className="quote-chat-example" onClick={() => setMessage(EXAMPLE_PROMPT)}>
              {EXAMPLE_PROMPT}
            </button>
          </div>
        ) : null}
        {quote.chat.map((entry, index) => (
          <div key={`${entry.createdAt}-${index}`} className={`quote-chat-message is-${entry.role}`}>
            {entry.content}
          </div>
        ))}
        {isSending ? (
          <div className="quote-chat-message is-assistant is-pending">Sto preparando la bozza...</div>
        ) : null}
      </div>
      <form className="quote-chat-form" onSubmit={handleSubmit}>
        <textarea
          className="form-input quote-chat-input"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={quote.chat.length ? 'Es. togli il drone, metti 2 giorni di shooting...' : 'Cosa ti serve?'}
          rows={4}
          disabled={isSending}
        />
        <button type="submit" className="btn btn-primary" disabled={isSending || !message.trim()}>
          <Send size={14} /> {isSending ? 'Attendere...' : 'Invia'}
        </button>
        <span className="quote-chat-hint">Ctrl/⌘ + Invio per inviare</span>
      </form>
    </aside>
  );
}
