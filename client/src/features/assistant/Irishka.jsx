import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, ArrowUp, ArrowDown, CalendarDays, FileText, Bell, X, MessageCirclePlus, Plus, Search, MessageCircle, Pencil, Trash2, Check, Copy, LoaderCircle, Route, Sparkles, LockKeyhole, AlertCircle } from "lucide-react";
import { today } from "../../shared/domain/timetable.js";
import { Dialog } from "../../shared/ui/ui.jsx";
import { ReplyAction } from "./IrishkaActions.jsx";
import { ReplyBlocks } from "./IrishkaReply.jsx";
import { newRequestId } from "../../shared/api/request-id.js";
const loadMarkdown = () => import("./IrishkaMarkdown.jsx");
const ReplyMarkdown = lazy(loadMarkdown);
function ChatSidebarIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4.5" /><path d="M9 3v18" /></svg>;
}
export function IrishkaMark({
  className = "",
  followPointer = true
}) {
  const mark = useRef(null);
  useEffect(() => {
    if (!followPointer) return;
    const element = mark.current;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const fine = matchMedia("(pointer: fine)");
    let frame;
    const reset = () => {
      element.style.setProperty("--look-x", "0px");
      element.style.setProperty("--look-y", "0px");
      element.style.setProperty("--character-lean", "0deg");
    };
    const follow = event => {
      if (motion.matches || !fine.matches || event.pointerType === "touch") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = element.getBoundingClientRect();
        if (!bounds.width) return;
        const dx = event.clientX - bounds.x - bounds.width / 2;
        const dy = event.clientY - bounds.y - bounds.height / 2;
        const distance = Math.hypot(dx, dy);
        const amount = Math.min(distance / 100, 1);
        element.style.setProperty("--look-x", `${distance ? dx / distance * amount * 5 : 0}px`);
        element.style.setProperty("--look-y", `${distance ? dy / distance * amount * 4 : 0}px`);
        element.style.setProperty("--character-lean", `${Math.max(-4, Math.min(4, dx / 60))}deg`);
      });
    };
    const leave = event => {
      if (!event.relatedTarget) reset();
    };
    window.addEventListener("pointermove", follow, {
      passive: true
    });
    window.addEventListener("pointerout", leave);
    window.addEventListener("blur", reset);
    motion.addEventListener("change", reset);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", follow);
      window.removeEventListener("pointerout", leave);
      window.removeEventListener("blur", reset);
      motion.removeEventListener("change", reset);
    };
  }, [followPointer]);
  return <svg ref={mark} className={`irishka-mark ${className}`} viewBox="0 0 120 136" fill="none" aria-hidden="true">
    <g className="irishka-body">
      <path fill="currentColor" d="M60 5c13 0 20 7 26 16 4 6 15 5 23 18 10 16 7 33-5 43-7 6-7 17-15 24-8 7-19 6-29 6s-21 1-29-6c-8-7-8-18-15-24C4 72 1 55 11 39c8-13 19-12 23-18C40 12 47 5 60 5Z" />
      <g className="irishka-gaze"><g className="irishka-eyes"><rect x="40" y="44" width="10" height="29" rx="5" fill="var(--irishka-paper)" /><rect x="70" y="44" width="10" height="29" rx="5" fill="var(--irishka-paper)" /></g></g>
    </g>
    <rect className="irishka-foot" x="40" y="122" width="40" height="9" rx="4.5" fill="currentColor" />
  </svg>;
}
const assistantPhases = {
  thinking: "Тинки обдумывает вопрос",
  tools: "Тинки смотрит данные кабинета",
  answering: "Тинки отвечает"
};
function activeChatStorage(ownerId, id) {
  if (!ownerId) return null;
  const key = `atlas-tinky-chat:${ownerId}`;
  try {
    if (id === undefined) return sessionStorage.getItem(key);
    sessionStorage.setItem(key, id);
  } catch {
    return null;
  }
}
function MessageActions({
  message,
  onAction,
  actionHref
}) {
  const categoryLinks = {
    rooms: "navigator",
    people: "directory",
    subjects: "schedule",
    services: "services"
  };
  const cardLinks = {
    schedule: ["schedule"],
    route: ["navigator"],
    place: ["navigator"],
    documents: ["docs"],
    sports: ["sports", "services"]
  };
  const actions = message.actions?.filter(({
    action
  }) => !message.blocks?.some(block => cardLinks[block.type]?.includes(action) || block.type === "search" && block.matches.some(match => categoryLinks[match.category] === action)));
  if (!actions?.length) return null;
  return <div className="irishka-message-actions">{actions.map(action => <ReplyAction key={action.action} action={action.action} onAction={onAction} actionHref={actionHref}>
      {action.label}<ArrowUpRight size={14} aria-hidden="true" />
    </ReplyAction>)}</div>;
}
export default function Irishka({
  onAction,
  actionHref,
  request,
  sendStream,
  onBookSport,
  sportsBookings,
  ownerId,
  name = "",
  role,
  phone = false
}) {
  const [open, setOpen] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [chats, setChats] = useState([]);
  const [chatId, setChatId] = useState("");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [stream, setStream] = useState(null);
  const busy = stream !== null;
  const [error, setError] = useState("");
  const [failed, setFailed] = useState(null);
  const [copied, setCopied] = useState("");
  const [renaming, setRenaming] = useState("");
  const [title, setTitle] = useState("");
  const [deleting, setDeleting] = useState("");
  const [jump, setJump] = useState(false);
  const input = useRef(null),
    scroll = useRef(null),
    end = useRef(null);
  const historyPanel = useRef(null);
  useEffect(() => {
    if (phone && sidebar) historyPanel.current?.focus({
      preventScroll: true
    });
  }, [phone, sidebar]);
  const sending = useRef(false),
    selection = useRef(0),
    nearBottom = useRef(true);
  const activeId = useRef(""),
    historyRequest = useRef(0);
  const streamRequest = useRef(null),
    lookedForLatest = useRef(false);
  const firstName = name.split(" ")[1] || name || "друг";
  const suggestions = role === "office" ? [[FileText, "Что с обращениями студентов?"], [Bell, "Покажи уведомления"], [CalendarDays, "Расписание на неделю"], [Sparkles, "Что ты умеешь?"]] : [[CalendarDays, "Расписание на неделю"], [FileText, "Как заказать справку?"], [Route, "Как пройти до Б-412?"], [Sparkles, "Что ты умеешь?"]];
  const current = chats.find(chat => chat.id === chatId);
  const visibleMessages = stream?.text ? [...messages, {
    id: stream.id,
    role: "assistant",
    text: stream.text,
    streaming: true
  }] : messages;
  const visibleChats = chats.filter(chat => chat.title.toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru")));
  function rememberChat({
    id,
    title,
    created,
    updated
  }) {
    if (!title) return;
    const summary = {
      id,
      title,
      created,
      updated
    };
    setChats(previous => {
      const next = previous.some(chat => chat.id === id) ? previous.map(chat => chat.id === id ? summary : chat) : [summary, ...previous];
      return next.sort((left, right) => right.updated - left.updated);
    });
  }
  async function loadHistory() {
    const version = ++historyRequest.current;
    setHistoryLoading(true);
    try {
      const history = await request("irishka/chats");
      if (version === historyRequest.current) setChats(history);
      return history;
    } catch {
      return null;
    } finally {
      if (version === historyRequest.current) setHistoryLoading(false);
    }
  }
  useEffect(() => {
    if (!open) return;
    void loadMarkdown().catch(() => {});
    const history = loadHistory();
    if (activeId.current || !ownerId) return;
    const saved = activeChatStorage(ownerId);
    if (saved) {
      void chooseChat(saved, true);
    } else if (saved === null && !lookedForLatest.current) {
      lookedForLatest.current = true;
      const version = selection.current;
      void history.then(items => {
        if (!items) {
          lookedForLatest.current = false;
          return;
        }
        if (version !== selection.current || sending.current || activeId.current) return;
        const latest = items.find(chat => chat.title !== "Новый чат" || chat.updated !== chat.created);
        if (latest) void chooseChat(latest.id, true);
      });
    }
  }, [open, ownerId]);
  useEffect(() => () => streamRequest.current?.abort(), []);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!open || !phone || !viewport) return;
    const conversation = scroll.current;
    const dialog = conversation.closest("dialog");
    let frame;
    function clearViewport() {
      dialog.style.removeProperty("--irishka-viewport-height");
      dialog.style.removeProperty("--irishka-viewport-top");
    }
    function syncViewport() {
      frame = undefined;
      if (Math.abs(viewport.scale - 1) > 0.01) {
        clearViewport();
        return;
      }
      dialog.style.setProperty("--irishka-viewport-height", `${viewport.height}px`);
      dialog.style.setProperty("--irishka-viewport-top", `${viewport.offsetTop}px`);
      if (nearBottom.current && conversation.querySelector(".irishka-messages")) {
        conversation.scrollTop = conversation.scrollHeight;
      }
    }
    function scheduleViewportSync() {
      frame ??= requestAnimationFrame(syncViewport);
    }
    syncViewport();
    viewport.addEventListener("resize", scheduleViewportSync);
    viewport.addEventListener("scroll", scheduleViewportSync);
    return () => {
      viewport.removeEventListener("resize", scheduleViewportSync);
      viewport.removeEventListener("scroll", scheduleViewportSync);
      cancelAnimationFrame(frame);
      clearViewport();
    };
  }, [open, phone]);
  useEffect(() => {
    if (!open) return;
    const element = input.current;
    if (element) {
      element.style.height = "0px";
      element.style.height = Math.min(element.scrollHeight, 144) + "px";
    }
  }, [draft, open, loading]);
  useEffect(() => {
    if (!messages.length) {
      if (scroll.current) scroll.current.scrollTop = 0;
    } else if (nearBottom.current) {
      end.current?.scrollIntoView({
        block: "end"
      });
    }
  }, [messages, stream, open]);
  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(""), 1800);
    return () => clearTimeout(timeout);
  }, [copied]);
  function newChat() {
    if (sending.current) return;
    ++selection.current;
    selectActiveChat("");
    setMessages([]);
    setDraft("");
    setError("");
    setFailed(null);
    setLoading(false);
    setSidebar(false);
    setRenaming("");
    setDeleting("");
    nearBottom.current = true;
    setJump(false);
    requestAnimationFrame(() => input.current?.focus());
  }
  function selectActiveChat(id) {
    activeId.current = id;
    setChatId(id);
    activeChatStorage(ownerId, id);
  }
  async function chooseChat(id, restoring = false) {
    if (sending.current) return;
    const version = ++selection.current;
    selectActiveChat(id);
    setSidebar(false);
    setLoading(true);
    setMessages([]);
    setDraft("");
    setError("");
    setFailed(null);
    setRenaming("");
    setDeleting("");
    nearBottom.current = true;
    setJump(false);
    try {
      const chat = await request(`irishka/chats/${id}`);
      if (version === selection.current) {
        rememberChat(chat);
        setMessages(chat.messages);
      }
    } catch (e) {
      if (version !== selection.current) return;
      if (restoring && e.status === 404) selectActiveChat("");else setError(e.message);
    } finally {
      if (version === selection.current) setLoading(false);
    }
  }
  async function send(text = draft, retry = null) {
    text = text.trim();
    if (!text || sending.current || loading || failed && !retry) return;
    const turn = retry || {
      request_id: newRequestId(),
      text,
      context_date: today()
    };
    const controller = new AbortController();
    streamRequest.current = controller;
    sending.current = true;
    setStream({
      id: turn.request_id + "-assistant",
      state: "thinking",
      text: ""
    });
    setError("");
    setFailed(null);
    setDraft("");
    nearBottom.current = true;
    setJump(false);
    if (!retry) setMessages(previous => [...previous, {
      id: turn.request_id + "-user",
      role: "user",
      text,
      created: Date.now(),
      pending: true
    }]);
    try {
      let id = activeId.current;
      if (!id) {
        const chat = await request("irishka/chats", {}, {
          signal: controller.signal
        });
        id = chat.id;
        selectActiveChat(id);
      }
      const chat = await sendStream(id, turn, event => {
        setStream(previous => {
          if (!previous) return previous;
          if (event.type === "status") return {
            ...previous,
            state: event.state
          };
          if (event.type === "delta") return {
            ...previous,
            text: previous.text + event.text
          };
          if (event.type === "reset") return {
            ...previous,
            text: ""
          };
          return previous;
        });
      }, controller.signal);
      rememberChat(chat);
      setMessages(chat.messages);
      void loadHistory();
    } catch (e) {
      if (e.name !== "AbortError") {
        setError(e.message);
        setFailed(turn);
      }
    } finally {
      streamRequest.current = null;
      sending.current = false;
      setStream(null);
      input.current?.focus();
    }
  }
  function editFailed() {
    setDraft(failed.text);
    setMessages(previous => previous.filter(message => message.id !== failed.request_id + "-user"));
    setFailed(null);
    setError("");
    input.current?.focus();
  }
  async function rename(event, id) {
    event.preventDefault();
    if (!title.trim() || sending.current) return;
    try {
      const chat = await request(`irishka/chats/${id}/rename`, {
        title: title.trim()
      });
      rememberChat(chat);
      setRenaming("");
      await loadHistory();
    } catch (e) {
      setError(e.message);
    }
  }
  async function remove(id) {
    if (sending.current) return;
    try {
      await request(`irishka/chats/${id}/delete`, {});
      if (activeId.current === id) newChat();
      setDeleting("");
      await loadHistory();
    } catch (e) {
      setError(e.message);
    }
  }
  async function copy(message) {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(message.id);
    } catch {
      setError("Не удалось скопировать. Выделите текст сообщения и скопируйте вручную.");
    }
  }
  function go(action, detail) {
    if (action !== "document-download") setOpen(false);
    onAction(action, detail);
  }
  const messageTime = timestamp => new Intl.DateTimeFormat("ru", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow"
  }).format(timestamp);
  return <>
    <button className={phone ? "phone-nav-button phone-assistant" : "irishka-trigger"} aria-label="Тинки — помощник" title="Тинки" aria-haspopup="dialog" aria-expanded={open} onClick={event => {
      event.currentTarget.focus({
        preventScroll: true
      });
      setOpen(true);
    }}>{phone ? <><span className="phone-nav-icon"><IrishkaMark followPointer={false} /></span></> : <IrishkaMark />}</button>
    {createPortal(<Dialog open={open} onClose={() => setOpen(false)} maxWidth={1240} className="irishka-dialog" label="Тинки — помощник" focusSelf>
      <div className={`irishka-chat ${sidebar ? "history-open" : ""}`}>
        {!phone && <nav className="irishka-chat-rail" aria-label="Управление чатами">
          <button aria-label={sidebar ? "Скрыть историю чатов" : "История чатов"} title="История чатов" aria-expanded={sidebar} aria-controls="irishka-history" onClick={() => setSidebar(!sidebar)}><ChatSidebarIcon /></button>
          <button aria-label="Новый чат" title="Новый чат" onClick={newChat} disabled={busy}><MessageCirclePlus size={21} strokeWidth={1.6} /></button>
        </nav>}
        {sidebar && <>
          <button className="irishka-history-scrim" aria-label="Закрыть историю чатов" onClick={() => setSidebar(false)} />
          <aside ref={historyPanel} tabIndex={-1} className="irishka-history" id="irishka-history" aria-label="История чатов">
            <div className="irishka-history-heading"><h2>Твои чаты</h2><button aria-label="Скрыть список чатов" onClick={() => setSidebar(false)}><X size={18} /></button></div>
            <button className="irishka-new-chat" onClick={newChat} disabled={busy}><Plus size={17} />Новый чат</button>
            <label className="irishka-history-search"><Search size={16} /><input aria-label="Поиск по чатам" placeholder="Поиск" value={search} onChange={e => setSearch(e.target.value)} /></label>
            <div className="irishka-history-list" aria-busy={historyLoading}>
              {historyLoading && !chats.length ? <p className="irishka-history-empty">Загружаю чаты…</p> : !visibleChats.length ? <div className="irishka-history-empty"><MessageCircle size={24} strokeWidth={1.6} /><p>{search ? "Чатов с таким названием нет" : "Здесь будут твои разговоры"}</p><small>{search ? "Попробуй другой запрос" : "Начни с вопроса Тинки"}</small></div> : visibleChats.map(chat => <div key={chat.id} className={`irishka-history-item ${chatId === chat.id ? "active" : ""}`}>
                {renaming === chat.id ? <form onSubmit={e => rename(e, chat.id)} className="irishka-rename"><input autoFocus aria-label="Название чата" maxLength={80} value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setRenaming("");
                    }
                  }} /><button aria-label="Сохранить название" type="submit"><Check size={16} /></button><button type="button" aria-label="Отменить переименование" onClick={() => setRenaming("")}><X size={16} /></button></form> : <>
                  <button className="irishka-history-select" aria-current={chatId === chat.id ? "page" : undefined} disabled={busy} onClick={() => chooseChat(chat.id)}><span>{chat.title}</span><small>{new Intl.DateTimeFormat("ru", {
                        day: "numeric",
                        month: "short",
                        timeZone: "Europe/Moscow"
                      }).format(chat.updated)}</small></button>
                  <div className="irishka-history-options"><button disabled={busy} aria-label={`Переименовать чат «${chat.title}»`} title="Переименовать" onClick={() => {
                      setRenaming(chat.id);
                      setTitle(chat.title);
                      setDeleting("");
                    }}><Pencil size={14} /></button><button disabled={busy} aria-label={`Удалить чат «${chat.title}»`} title="Удалить" onClick={() => {
                      setDeleting(chat.id);
                      setRenaming("");
                    }}><Trash2 size={14} /></button></div>
                </>}
                {deleting === chat.id && <div className="irishka-delete-confirm"><p>Удалить чат и все сообщения?</p><button onClick={() => remove(chat.id)}>Удалить</button><button onClick={() => setDeleting("")}>Отмена</button></div>}
              </div>)}
            </div>
            <p className="irishka-history-private"><LockKeyhole size={13} />Чаты видны только тебе</p>
          </aside>
        </>}
        <section className="irishka-chat-main" aria-label="Разговор с Тинки" inert={phone && sidebar ? true : undefined}>
          <header className="irishka-chat-header">
            {phone && <button aria-label={sidebar ? "Скрыть историю чатов" : "История чатов"} aria-expanded={sidebar} aria-controls="irishka-history" onClick={() => setSidebar(!sidebar)}><ChatSidebarIcon /></button>}
            <div><span>{current?.title || (phone ? "Тинки" : "Новый чат")}</span></div>
            {phone && <button aria-label="Новый чат" title="Новый чат" onClick={newChat} disabled={busy}><MessageCirclePlus size={22} strokeWidth={1.6} /></button>}
            <button onClick={() => setOpen(false)} aria-label="Закрыть Тинки" title="Закрыть"><X size={24} strokeWidth={1.5} /></button>
          </header>
          <div className="irishka-chat-scroll" ref={scroll} onScroll={e => {
            const el = e.currentTarget;
            nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
            setJump(!nearBottom.current);
          }}>
            {loading ? <div className="irishka-chat-loading" role="status"><LoaderCircle size={24} className="irishka-spin" /><p>Открываю разговор…</p></div> : !messages.length ? <div className="irishka-welcome">
              <IrishkaMark className="irishka-character" />
              <h2>Привет, {firstName}</h2><p>Я Тинки. Чем могу помочь?</p>
              <div className="irishka-suggestions">{suggestions.map(([Icon, text]) => <button key={text} onClick={() => send(text)} disabled={busy}><Icon size={18} strokeWidth={1.6} />{text}</button>)}</div>
            </div> : <div className="irishka-messages" role="log" aria-label="Сообщения чата" aria-live="polite" aria-relevant="additions text" aria-busy={busy}>{visibleMessages.map(message => <article key={message.id} className={`irishka-message ${message.role}`} aria-label={message.role === "user" ? "Твоё сообщение" : "Ответ Тинки"}>
              {message.role === "assistant" && <span className="irishka-message-avatar"><IrishkaMark followPointer={false} /></span>}
              <div className="irishka-message-content">
                {message.role === "assistant" ? <Suspense fallback={<div className="irishka-message-text">{message.text}</div>}><ReplyMarkdown text={message.text} /></Suspense> : <div className="irishka-message-text">{message.text}</div>}
                {!!message.blocks?.length && <ReplyBlocks blocks={message.blocks} role={role} onAction={go} actionHref={actionHref} sportsBookings={sportsBookings} onBookSport={onBookSport} onAsk={busy ? undefined : send} />}
                <MessageActions message={message} onAction={go} actionHref={actionHref} />
                {!message.streaming && <div className="irishka-message-meta">
                  <span>{message.role === "assistant" ? "Тинки · " : ""}{messageTime(message.created)}{message.pending && failed ? " · Не отправлено" : message.pending ? " · Отправляется" : ""}</span>
                  <button onClick={() => copy(message)} aria-label={copied === message.id ? "Скопировано" : "Скопировать сообщение"} title={copied === message.id ? "Скопировано" : "Скопировать"}>{copied === message.id ? <Check size={14} /> : <Copy size={14} />}</button>
                </div>}
              </div>
            </article>)}</div>}
            {busy && !stream.text && <div className="irishka-thinking" role="status">
              <IrishkaMark followPointer={false} />
              <span>{assistantPhases[stream.state] || assistantPhases.thinking}<span aria-hidden="true">…</span></span>
            </div>}
            <div ref={end} />
          </div>
          {jump && messages.length > 0 && <button className="irishka-to-bottom" aria-label="К последнему сообщению" onClick={() => {
            nearBottom.current = true;
            end.current?.scrollIntoView({
              behavior: "smooth"
            });
          }}><ArrowDown size={18} /></button>}
          <div className="irishka-composer-wrap">
            {error && <div className="irishka-chat-error" role="alert"><AlertCircle size={17} /><div><p>{error}</p>{failed ? <div><button onClick={() => send(failed.text, failed)}>Повторить отправку</button><button onClick={editFailed}>Изменить сообщение</button></div> : <button onClick={() => chatId ? chooseChat(chatId) : setError("")}>Повторить</button>}</div></div>}
            <form className="irishka-composer" onSubmit={e => {
              e.preventDefault();
              void send();
            }}>
              <textarea ref={input} rows={1} maxLength={4000} aria-label="Сообщение Тинки" placeholder={phone ? "Сообщение Тинки" : "Спроси Тинки о чём-нибудь…"} value={draft} disabled={loading || !!failed} onChange={e => setDraft(e.target.value)} onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }} />
              <button type="submit" aria-label="Отправить сообщение" title="Отправить · Enter" disabled={!draft.trim() || busy || loading || !!failed}>{busy ? <LoaderCircle size={20} className="irishka-spin" /> : <ArrowUp size={22} />}</button>
              {draft.length > 3500 && <span className="irishka-input-count">{draft.length}/4000</span>}
            </form>
          </div>
        </section>
      </div>
    </Dialog>, document.querySelector(".v-application") || document.body)}
  </>;
}
