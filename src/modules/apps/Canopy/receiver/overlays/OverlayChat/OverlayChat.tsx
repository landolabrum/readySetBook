import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './OverlayChat.scss';

type ChatMessage = {
  id: string;
  user: string;
  color?: string;
  badges?: string[];
  text: string;
  ts: number;
};

interface OverlayChatProps {
  channel?: string;
  maxMessages?: number;
  showBadges?: boolean;
  showColors?: boolean;
  title?: string | null;
  description?: string | null;
  variant?: string | null;
}

const DEFAULT_COLORS = [
  '#FF4500', '#1E90FF', '#00FF7F', '#FFD700', '#FF69B4',
  '#9ACD32', '#00CED1', '#FF6347', '#BA55D3', '#7FFFD4',
];

const stableColor = (user: string): string => {
  let h = 0;
  for (let i = 0; i < user.length; i++) h = (h * 31 + user.charCodeAt(i)) >>> 0;
  return DEFAULT_COLORS[h % DEFAULT_COLORS.length];
};

const parseTags = (tagStr: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const part of tagStr.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    out[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return out;
};

const parsePrivmsg = (line: string): ChatMessage | null => {
  let tags: Record<string, string> = {};
  let rest = line;
  if (line.startsWith('@')) {
    const sp = line.indexOf(' ');
    if (sp < 0) return null;
    tags = parseTags(line.slice(1, sp));
    rest = line.slice(sp + 1);
  }
  const m = rest.match(/^:([^!]+)![^ ]+ PRIVMSG #[^ ]+ :(.*)$/);
  if (!m) return null;
  const user = tags['display-name'] || m[1];
  const text = m[2];
  const color = tags['color'] || undefined;
  const badges = tags['badges'] ? tags['badges'].split(',').map((b) => b.split('/')[0]).filter(Boolean) : [];
  return {
    id: tags['id'] || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    user,
    color,
    badges,
    text,
    ts: Date.now(),
  };
};

const OverlayChat: React.FC<OverlayChatProps> = ({
  channel,
  maxMessages = 50,
  showBadges = true,
  showColors = true,
  title,
  description,
  variant,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'joined' | 'error' | 'closed'>('idle');
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const maxMessagesRef = useRef(maxMessages);
  maxMessagesRef.current = maxMessages;
  const cleanChannel = useMemo(
    () => String(channel || '').trim().replace(/^#/, '').toLowerCase(),
    [channel],
  );

  useEffect(() => {
    if (!cleanChannel) return;
    let closed = false;
    setStatus('connecting');
    const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    wsRef.current = ws;

    ws.onopen = () => {
      if (closed) return;
      const nick = `justinfan${Math.floor(Math.random() * 90000) + 10000}`;
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      ws.send(`NICK ${nick}`);
      ws.send(`JOIN #${cleanChannel}`);
    };

    ws.onmessage = (ev) => {
      const lines = String(ev.data || '').split('\r\n').filter(Boolean);
      for (const line of lines) {
        if (line.startsWith('PING')) {
          ws.send(line.replace('PING', 'PONG'));
          continue;
        }
        // Detect successful join: server sends 366 (end of NAMES) for the channel
        if (/(^| )(366|JOIN) /.test(line) && line.toLowerCase().includes(`#${cleanChannel}`)) {
          if (!closed) setStatus('joined');
        }
        const msg = parsePrivmsg(line);
        if (!msg) continue;
        setMessages((prev) => {
          const cap = maxMessagesRef.current;
          const next = [...prev, msg];
          if (next.length > cap) next.splice(0, next.length - cap);
          return next;
        });
      }
    };

    ws.onerror = () => { if (!closed) setStatus('error'); };
    ws.onclose = () => { if (!closed) setStatus('closed'); };

    return () => {
      closed = true;
      try { ws.close(); } catch { /* noop */ }
      wsRef.current = null;
    };
  }, [cleanChannel]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <>
      <style jsx>{styles}</style>
      <div className={`overlay-chat${variant === 'blank' ? ' overlay-chat--blank' : ''}`}>
        {(title || description) && (
          <div className="overlay-chat__head">
            {title && <div className="overlay-chat__title">{title}</div>}
            {description && <div className="overlay-chat__sub">{description}</div>}
          </div>
        )}
        <div className="overlay-chat__list" ref={scrollRef}>
          {!cleanChannel && (
            <div className="overlay-chat__empty">No Twitch channel configured</div>
          )}
          {cleanChannel && messages.length === 0 && (
            <div className="overlay-chat__empty">
              {status === 'joined' && `Connected to #${cleanChannel} — waiting for messages…`}
              {status === 'connecting' && `Connecting to #${cleanChannel}…`}
              {status === 'error' && `Connection error — retrying on remount`}
              {status === 'closed' && `Disconnected from #${cleanChannel}`}
              {status === 'idle' && `Connecting to #${cleanChannel}…`}
            </div>
          )}
          {messages.map((m) => {
            const userColor = showColors ? (m.color || stableColor(m.user)) : undefined;
            return (
              <div className="overlay-chat__row" key={m.id}>
                {showBadges && m.badges && m.badges.length > 0 && (
                  <span className="overlay-chat__badges">
                    {m.badges.map((b) => (
                      <span key={b} className={`overlay-chat__badge overlay-chat__badge--${b}`}>{b}</span>
                    ))}
                  </span>
                )}
                <span className="overlay-chat__user" style={userColor ? { color: userColor } : undefined}>
                  {m.user}
                </span>
                <span className="overlay-chat__sep">: </span>
                <span className="overlay-chat__text">{m.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default OverlayChat;
