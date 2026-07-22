import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppWindow from '../components/ui/AppWindow.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import {
  closeAdminConversation,
  getAdminChatConversations,
  getAdminChatMessages,
  markAdminConversationRead,
  reopenAdminConversation,
  sendAdminChatMessage,
} from '../services/chatApi.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const filters = ['all', 'unread', 'waiting_admin', 'waiting_customer', 'closed'];

function initials(name) {
  return (name || 'B').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function messagePreview(message, t) {
  if (!message) return t('chat.noMessagesYet');
  if (message.message_type === 'customer_card') return t('chat.shareCustomerCard');
  if (message.message_type === 'image') return t('chat.image');
  if (message.message_type === 'document') return t('chat.document');
  return message.body || t('chat.attachment');
}

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

function attachmentLabel(file, t) {
  return file.attachment_type === 'image' ? t('chat.image') : t('chat.document');
}

function CustomerCardMessage({ snapshot, onOpen, t }) {
  if (!snapshot) return null;
  return (
    <div className="chat-customer-card">
      <div className="chat-customer-card__avatar">{snapshot.profile_image_url ? <img src={snapshot.profile_image_url} alt="" /> : initials(snapshot.customer_name)}</div>
      <div>
        <strong>{snapshot.customer_name}</strong>
        <span className="code-text">{snapshot.customer_code}</span>
        <p>{snapshot.business_name || snapshot.customer_name}</p>
        <small>{snapshot.phone} · {snapshot.email}</small>
      </div>
      <Button type="button" variant="secondary" onClick={() => onOpen(snapshot)}>{t('chat.viewCustomerProfile')}</Button>
    </div>
  );
}

export default function CustomerMessages() {
  const { t, isArabic } = useLanguage();
  const navigate = useNavigate();
  const [conversationRows, setConversationRows] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reply, setReply] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [error, setError] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [cardSnapshot, setCardSnapshot] = useState(null);
  const fileInputRef = useRef(null);
  const cardButtonRef = useRef(null);

  const activeConversation = useMemo(
    () => conversationRows.find((row) => row.id === activeConversationId) || null,
    [activeConversationId, conversationRows],
  );
  const unreadTotal = conversationRows.reduce((total, row) => total + Number(row.unread_count || 0), 0);

  const loadConversations = useCallback(async () => {
    setError('');
    try {
      const response = await getAdminChatConversations({
        search,
        status: statusFilter === 'all' ? '' : statusFilter,
        page_size: 50,
      });
      const rows = response.results || [];
      setConversationRows(rows);
      setActiveConversationId((current) => current || rows[0]?.id || null);
    } catch {
      setError(t('chat.loadError'));
    } finally {
      setIsLoadingConversations(false);
    }
  }, [search, statusFilter, t]);

  const loadMessages = useCallback(async (conversationId = activeConversationId) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    setIsLoadingMessages(true);
    setError('');
    try {
      const response = await getAdminChatMessages(conversationId, { page_size: 50 });
      setMessages([...(response.results || [])].reverse());
      await markAdminConversationRead(conversationId);
      await loadConversations();
    } catch {
      setError(t('chat.loadError'));
    } finally {
      setIsLoadingMessages(false);
    }
  }, [activeConversationId, loadConversations, t]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    loadMessages(activeConversationId);
  }, [activeConversationId, loadMessages]);

  useEffect(() => {
    const id = window.setInterval(() => {
      loadConversations();
      if (activeConversationId) loadMessages(activeConversationId);
    }, 15000);
    return () => window.clearInterval(id);
  }, [activeConversationId, loadConversations, loadMessages]);

  function handleAttachmentChange(event) {
    setAttachment(event.target.files?.[0] || null);
  }

  async function handleSend(event) {
    event.preventDefault();
    if (isSending || (!reply.trim() && !attachment) || !activeConversationId) return;
    setIsSending(true);
    setError('');
    try {
      const clientId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      let payload;
      if (attachment) {
        payload = new FormData();
        payload.append('body', reply);
        payload.append('client_message_id', clientId);
        payload.append('attachment', attachment);
      } else {
        payload = { body: reply, client_message_id: clientId };
      }
      await sendAdminChatMessage(activeConversationId, payload);
      setReply('');
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadMessages(activeConversationId);
    } catch {
      setError(t('chat.sendError'));
    } finally {
      setIsSending(false);
    }
  }

  function openCustomerProfile(snapshot = activeConversation) {
    const customerId = snapshot?.customer_id || snapshot?.customer;
    if (customerId) navigate(`/customers?customer=${customerId}`);
  }

  async function handleCloseReopen() {
    if (!activeConversation) return;
    if (activeConversation.status === 'closed') {
      await reopenAdminConversation(activeConversation.id);
    } else {
      await closeAdminConversation(activeConversation.id);
    }
    await loadConversations();
  }

  return (
    <div className="page-grid chat-page">
      <Card title={t('chat.customerMessages')} subtitle={`${t('chat.unreadMessages')}: ${unreadTotal}`}>
        <div className="chat-layout">
          <aside className="chat-sidebar-panel">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('chat.searchPlaceholder')} />
            <div className="chat-filter-row">
              {filters.map((filter) => (
                <button key={filter} type="button" className={statusFilter === filter ? 'is-active' : ''} onClick={() => setStatusFilter(filter)}>
                  {t(`chat.filters.${filter}`)}
                </button>
              ))}
            </div>
            <div className="chat-conversation-list" aria-busy={isLoadingConversations}>
              {conversationRows.length === 0 ? (
                <p className="chat-empty">{isLoadingConversations ? t('chat.loading') : t('chat.noMessagesYet')}</p>
              ) : conversationRows.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={`chat-conversation-item ${conversation.id === activeConversationId ? 'is-active' : ''}`}
                  onClick={() => setActiveConversationId(conversation.id)}
                >
                  <span className="chat-avatar">{initials(conversation.customer_name)}</span>
                  <span>
                    <strong>{conversation.customer_name}</strong>
                    <small className="code-text">{conversation.customer_code}</small>
                    <em>{messagePreview(conversation.last_message, t)}</em>
                  </span>
                  {conversation.unread_count > 0 && <b>{conversation.unread_count}</b>}
                </button>
              ))}
            </div>
          </aside>
          <section className="chat-thread-panel">
            {activeConversation ? (
              <>
                <header className="chat-thread-header">
                  <div>
                    <h3>{activeConversation.customer_name}</h3>
                    <p><span className="code-text">{activeConversation.customer_code}</span> · {t(`chat.statuses.${activeConversation.status}`)}</p>
                  </div>
                  <div className="chat-thread-actions">
                    <Button type="button" variant="secondary" onClick={() => openCustomerProfile()}>{t('chat.viewCustomerProfile')}</Button>
                    <Button type="button" variant="secondary" onClick={handleCloseReopen}>{activeConversation.status === 'closed' ? t('chat.reopenConversation') : t('chat.closeConversation')}</Button>
                  </div>
                </header>
                {error && <div className="form-error"><p>{error}</p></div>}
                <div className="chat-message-list" aria-busy={isLoadingMessages}>
                  {messages.length === 0 ? (
                    <div className="chat-empty"><strong>{t('chat.noMessagesYet')}</strong><p>{t('chat.startConversation')}</p></div>
                  ) : messages.map((message) => (
                    <article key={message.id} className={`chat-message chat-message--${message.sender_type}`}>
                      <div className="chat-message__meta">
                        <strong>{message.sender_type === 'admin' ? t('admin') : t('common.customer')}</strong>
                        <time>{formatTime(message.created_at)}</time>
                      </div>
                      {message.message_type === 'customer_card' ? (
                        <CustomerCardMessage snapshot={message.card_snapshot} onOpen={(snapshot) => setCardSnapshot(snapshot)} t={t} />
                      ) : (
                        <>
                          {message.body && <p>{message.body}</p>}
                          {(message.attachments || []).map((file) => (
                            <a key={file.id} className="chat-attachment-link" href={file.download_url} target="_blank" rel="noreferrer">
                              {attachmentLabel(file, t)} · {file.original_filename}
                            </a>
                          ))}
                        </>
                      )}
                      <small>{message.sender_type === 'admin' && message.customer_read_at ? t('chat.read') : t('chat.sent')}</small>
                    </article>
                  ))}
                </div>
                <form className="chat-composer" onSubmit={handleSend}>
                  <p>{t('chat.bankCardWarning')}</p>
                  <textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder={t('chat.typeMessage')} />
                  <div className="chat-composer__actions">
                    <label className="localized-file-input">
                      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleAttachmentChange} />
                      <span className="localized-file-input__button">{t('chat.attachFile')}</span>
                      <span className="localized-file-input__name">{attachment?.name || t('chat.noAttachmentSelected')}</span>
                    </label>
                    {attachment && <Button type="button" variant="secondary" onClick={() => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>{t('chat.removeAttachment')}</Button>}
                    <Button type="submit" disabled={isSending || (!reply.trim() && !attachment)}>{isSending ? t('chat.sending') : t('chat.send')}</Button>
                  </div>
                </form>
              </>
            ) : (
              <div className="chat-empty"><strong>{t('chat.noMessagesYet')}</strong><p>{t('chat.startConversation')}</p></div>
            )}
          </section>
        </div>
      </Card>
      <AppWindow
        id="chat-customer-card"
        title={t('chat.shareCustomerCard')}
        description={cardSnapshot?.customer_code || ''}
        isOpen={Boolean(cardSnapshot)}
        openerRef={cardButtonRef}
        onClose={() => setCardSnapshot(null)}
      >
        <CustomerCardMessage snapshot={cardSnapshot} onOpen={openCustomerProfile} t={t} />
      </AppWindow>
    </div>
  );
}
