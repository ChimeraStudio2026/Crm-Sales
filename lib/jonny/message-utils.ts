import type { UIMessage } from 'ai';

export function getTextFromMessage(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

export function messageHasToolParts(message: UIMessage): boolean {
  return message.parts.some((part) => part.type.startsWith('tool-'));
}
