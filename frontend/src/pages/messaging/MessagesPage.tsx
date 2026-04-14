import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MessageSquarePlus, Send, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUnreadMessages } from '../../context/UnreadMessagesContext';
import { api, ApiError } from '../../utils/api';
import { formatDateTime } from '../../utils/helpers';
import type { ConversationListItem, ConversationMessage, Policy, Quote } from '../../types';
import Modal from '../../components/ui/Modal';

type ThreadPayload = {
  conversation: ConversationListItem & { counterpart?: string };
  practice: (Quote | Policy) | null;
  messages: ConversationMessage[];
};

type AssigneeOption = {
  id: number;
  nome?: string | null;
  cognome?: string | null;
  email?: string | null;
  role: string;
};

type NewConversationKind = 'quote' | 'policy' | 'info';

function canOpenNewConversation(role: string) {
  return (
    role === 'struttura' ||
    role === 'operatore' ||
    role === 'admin' ||
    role === 'supervisore'
  );
}

function canStartInfoRequest(role: string) {
  return role === 'struttura' || role === 'admin' || role === 'supervisore';
}

export default function MessagesPage() {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshUnread } = useUnreadMessages();
  const [list, setList] = useState<ConversationListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [thread, setThread] = useState<ThreadPayload | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [newKind, setNewKind] = useState<NewConversationKind>('quote');
  const [practices, setPractices] = useState<(Quote | Policy)[]>([]);
  const [practiceId, setPracticeId] = useState('');
  const [practiceSearch, setPracticeSearch] = useState('');
  const [practicePickerOpen, setPracticePickerOpen] = useState(false);
  const [infoAssignees, setInfoAssignees] = useState<AssigneeOption[]>([]);
  const [infoAssigneeId, setInfoAssigneeId] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newSubmitting, setNewSubmitting] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);

  const activeId = routeId ? Number(routeId) : null;

  const loadList = useCallback(async () => {
    setListError(null);
    setLoadingList(true);
    try {
      const rows = await api.get<ConversationListItem[]>('/conversations');
      setList(rows);
    } catch (e) {
      setList([]);
      setListError(e instanceof ApiError ? e.message : 'Impossibile caricare le conversazioni.');
    } finally {
      setLoadingList(false);
      void refreshUnread();
    }
  }, [refreshUnread]);

  const loadThread = useCallback(async (cid: number) => {
    setThreadError(null);
    setLoadingThread(true);
    try {
      const data = await api.get<ThreadPayload>(`/conversations/${cid}`);
      setThread(data);
    } catch (e) {
      setThread(null);
      setThreadError(e instanceof ApiError ? e.message : 'Conversazione non disponibile.');
    } finally {
      setLoadingThread(false);
      void refreshUnread();
    }
  }, [refreshUnread]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (activeId != null && Number.isFinite(activeId)) {
      loadThread(activeId);
    } else {
      setThread(null);
    }
  }, [activeId, loadThread]);

  const loadPracticesForNew = useCallback(async () => {
    if (!user) return;
    if (!canOpenNewConversation(user.role)) return;
    if (newKind === 'info') return;
    setNewError(null);
    try {
      if (newKind === 'quote') {
        const res = await api.get<{ data: Quote[] }>('/quotes?limit=500');
        setPractices(res.data ?? []);
      } else {
        const res = await api.get<{ data: Policy[] }>('/policies?limit=500');
        setPractices(res.data ?? []);
      }
      setPracticeId('');
      setPracticeSearch('');
    } catch (e) {
      setPractices([]);
      setNewError(e instanceof ApiError ? e.message : 'Impossibile caricare le pratiche.');
    }
  }, [user, newKind]);

  const loadInfoAssignees = useCallback(async () => {
    if (!user || !canStartInfoRequest(user.role)) return;
    setNewError(null);
    try {
      const rows = await api.get<AssigneeOption[]>('/users/assignees');
      setInfoAssignees(rows);
      setInfoAssigneeId('');
    } catch (e) {
      setInfoAssignees([]);
      setNewError(
        e instanceof ApiError ? e.message : 'Impossibile caricare gli operatori disponibili.',
      );
    }
  }, [user]);

  useEffect(() => {
    if (!showNew || !user || !canOpenNewConversation(user.role)) return;
    if (canStartInfoRequest(user.role) && newKind === 'info') {
      void loadInfoAssignees();
    } else {
      void loadPracticesForNew();
    }
  }, [showNew, user, newKind, loadPracticesForNew, loadInfoAssignees]);

  const handleSendReply = async () => {
    if (activeId == null || !replyText.trim()) return;
    setReplyError(null);
    setReplySending(true);
    try {
      await api.post(`/conversations/${activeId}/messages`, { content: replyText.trim() });
      setReplyText('');
      await loadThread(activeId);
      await loadList();
    } catch (e) {
      setReplyError(e instanceof ApiError ? e.message : 'Invio non riuscito.');
    } finally {
      setReplySending(false);
    }
  };

  const handleCreateConversation = async () => {
    if (newKind === 'info') {
      if (!infoAssigneeId || !newBody.trim()) {
        setNewError('Seleziona un incaricato e scrivi un messaggio.');
        return;
      }
    } else if (!practiceId || !newBody.trim()) {
      setNewError('Seleziona una pratica e scrivi un messaggio.');
      return;
    }
    setNewError(null);
    setNewSubmitting(true);
    try {
      const res = await api.post<{ id: number }>(
        '/conversations',
        newKind === 'info'
          ? {
              entity_type: 'info',
              assignee_id: Number(infoAssigneeId),
              content: newBody.trim(),
            }
          : {
              entity_type: newKind,
              entity_id: Number(practiceId),
              content: newBody.trim(),
            },
      );
      setShowNew(false);
      setNewBody('');
      setPracticeId('');
      setPracticeSearch('');
      setInfoAssigneeId('');
      await loadList();
      if (res.id) navigate(`/messaggi/${res.id}`);
    } catch (e) {
      setNewError(e instanceof ApiError ? e.message : 'Impossibile creare la conversazione.');
    } finally {
      setNewSubmitting(false);
    }
  };

  const assigneeLabel = (a: AssigneeOption) => {
    const name = [a.nome?.trim(), a.cognome?.trim()].filter(Boolean).join(' ');
    const roleIt = a.role === 'fornitore' ? 'Fornitore' : 'Operatore';
    return name ? `${name} (${roleIt})` : `${roleIt} #${a.id}`;
  };

  const practiceLabel = (row: Quote | Policy) =>
    'numero' in row && row.numero ? row.numero : String(row.id);

  const practiceOptionLine = (row: Quote | Policy) => {
    const num = practiceLabel(row);
    const nome = row.assistito_nome?.trim() || '';
    const cogn = row.assistito_cognome?.trim() || '';
    const assist = [nome, cogn].filter(Boolean).join(' ');
    return assist ? `${num} — ${assist}` : num;
  };

  const filteredPractices = useMemo(() => {
    const q = practiceSearch.trim().toLowerCase();
    if (!q) return practices;
    return practices.filter((p) => {
      const num = String(p.numero ?? '').toLowerCase();
      const id = String(p.id);
      const nome = (p.assistito_nome ?? '').toLowerCase();
      const cogn = (p.assistito_cognome ?? '').toLowerCase();
      const cf = (p.assistito_cf ?? '').toLowerCase();
      return (
        num.includes(q) ||
        id.includes(q) ||
        nome.includes(q) ||
        cogn.includes(q) ||
        `${nome} ${cogn}`.trim().includes(q) ||
        cf.includes(q)
      );
    });
  }, [practices, practiceSearch]);

  const selectPractice = (p: Quote | Policy) => {
    setPracticeId(String(p.id));
    setPracticeSearch(practiceOptionLine(p));
    setPracticePickerOpen(false);
  };

  if (!user) return null;

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Messaggi</h1>
          <p className="mt-1 text-sm text-gray-600">
            Comunicazioni sulle pratiche; richieste di informazioni per strutture, amministratori e supervisori.
          </p>
        </div>
        {canOpenNewConversation(user.role) && (
          <button type="button" onClick={() => setShowNew(true)} className="btn-primary self-start">
            <MessageSquarePlus className="h-4 w-4" />
            Nuova conversazione
          </button>
        )}
      </header>

      <div className="flex min-h-[480px] flex-col gap-4 rounded-xl border border-gray-200 bg-white shadow-sm lg:flex-row">
        <aside
          className={`lg:w-[340px] lg:shrink-0 lg:border-r lg:border-gray-100 ${
            activeId != null ? 'hidden lg:block' : ''
          }`}
        >
          {loadingList ? (
            <div className="flex items-center justify-center p-12">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : listError ? (
            <p className="p-6 text-sm text-red-700">{listError}</p>
          ) : list.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">Nessuna conversazione presente.</p>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-gray-100 overflow-y-auto">
              {list.map((c) => {
                const sel = activeId === c.id;
                const unread = (c.unread_count ?? 0) > 0;
                const unreadN = c.unread_count ?? 0;
                return (
                  <li key={c.id}>
                    <Link
                      to={`/messaggi/${c.id}`}
                      className={`relative block px-4 py-3 transition ${
                        sel
                          ? 'border-l-[5px] border-l-blue-600 bg-blue-50/80 hover:bg-blue-50'
                          : unread
                            ? 'border-l-[5px] border-l-orange-500 bg-[#fdf6e9] hover:bg-[#faf0df]'
                            : 'bg-white hover:bg-slate-50'
                      }`}
                      aria-label={
                        unread
                          ? `${c.practice_kind} ${c.practice_numero}, ${unreadN} non letti`
                          : undefined
                      }
                    >
                      {unread && !sel ? (
                        <span
                          className="absolute right-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm tabular-nums ring-2 ring-white"
                          aria-hidden
                        >
                          {unreadN > 99 ? '99+' : unreadN}
                        </span>
                      ) : null}
                      <div className={unread && !sel ? 'pr-11' : undefined}>
                        <p
                          className={`text-xs uppercase tracking-wide ${
                            unread && !sel
                              ? 'font-bold text-slate-900'
                              : 'font-semibold text-slate-500'
                          }`}
                        >
                          {c.practice_kind} · {c.practice_numero}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">Con: {c.counterpart || '—'}</p>
                      <div className="mt-1 flex items-end justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {c.last_message_preview ? (
                            <p className="line-clamp-2 text-sm text-slate-800">{c.last_message_preview}</p>
                          ) : null}
                        </div>
                        <time className="shrink-0 text-[11px] tabular-nums text-slate-400">
                          {c.last_message_at ? formatDateTime(c.last_message_at) : ''}
                        </time>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="min-h-[320px] flex-1 p-4 sm:p-6">
          {activeId == null ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center text-gray-500">
              <p className="text-sm">Seleziona una conversazione dall&apos;elenco oppure creane una nuova.</p>
            </div>
          ) : loadingThread ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : threadError ? (
            <p className="text-sm text-red-700">{threadError}</p>
          ) : thread ? (
            <div className="flex h-full flex-col gap-4">
              <div className="flex items-start gap-3 border-b border-gray-100 pb-4">
                <button
                  type="button"
                  onClick={() => navigate('/messaggi')}
                  className="mt-0.5 rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 lg:hidden"
 aria-label="Torna all'elenco"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {thread.conversation.practice_kind} · {thread.conversation.practice_numero}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Partecipanti:{' '}
                    <span className="font-medium text-slate-900">
                      {thread.conversation.counterpart || '—'}
                    </span>
                  </p>
                  {thread.practice && 'preventivo_numero' in thread.practice && thread.practice.preventivo_id ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Preventivo collegato:{' '}
                      <Link
                        to={`/preventivi/${thread.practice.preventivo_id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {thread.practice.preventivo_numero}
                      </Link>
                    </p>
                  ) : null}
                  {thread.practice && 'quote_id' in thread.practice ? (
                    <p className="mt-1 text-xs text-slate-500">
                      <Link
                        to={`/polizze/${thread.practice.id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        Apri scheda polizza
                      </Link>
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border border-gray-100 bg-slate-50/50 p-3">
                {thread.messages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">Nessun messaggio ancora.</p>
                ) : (
                  thread.messages.map((m) => {
                    const mine = m.author_id === user.id;
                    return (
                      <div
                        key={m.id}
                        className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                            mine
                              ? 'bg-blue-600 text-white'
                              : 'border border-gray-200 bg-white text-gray-900'
                          }`}
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] opacity-90">
                            <span className="font-semibold">{m.author_display || 'Utente'}</span>
                            <span className="tabular-nums">{formatDateTime(m.created_at)}</span>
                          </div>
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-gray-100 pt-3">
                {replyError && <p className="mb-2 text-sm text-red-600">{replyError}</p>}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={3}
                    placeholder="Scrivi un messaggio…"
                    className="input-field min-h-[80px] flex-1 resize-y"
                  />
                  <button
                    type="button"
                    onClick={handleSendReply}
                    disabled={replySending || !replyText.trim()}
                    className="btn-primary sm:shrink-0"
                  >
                    <Send className="h-4 w-4" />
                    {replySending ? 'Invio…' : 'Invia'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <Modal
        isOpen={showNew}
        onClose={() => {
          if (newSubmitting) return;
          setShowNew(false);
          setPracticeSearch('');
          setPracticePickerOpen(false);
          setInfoAssigneeId('');
        }}
        title="Nuova conversazione"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {newKind === 'info' && canStartInfoRequest(user.role) ? (
              <>
                Scegli l&apos;incaricato (operatore o fornitore) e scrivi la richiesta: verrà aperta una conversazione
                dedicata, senza legame a una pratica specifica.
              </>
            ) : user.role === 'struttura' ? (
              <>
                Scegli la pratica: il messaggio sarà inviato automaticamente all&apos;incaricato assegnato.
              </>
            ) : user.role === 'operatore' ? (
              <>
                Scegli una pratica a te assegnata: il messaggio sarà inviato alla struttura titolare.
              </>
            ) : (
              <>
                Scegli una pratica qualsiasi: il messaggio sarà notificato all&apos;incaricato assegnato e alla struttura
                titolare.
              </>
            )}
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Tipo</label>
            <select
              value={newKind}
              onChange={(e) => {
                const v = e.target.value as NewConversationKind;
                setNewKind(v);
                setPracticeId('');
                setPracticeSearch('');
                setPracticePickerOpen(false);
                setInfoAssigneeId('');
              }}
              className="input-field"
            >
              <option value="quote">Preventivo</option>
              <option value="policy">Polizza</option>
              {canStartInfoRequest(user.role) ? <option value="info">Richiesta informazioni</option> : null}
            </select>
          </div>
          {newKind === 'info' && canStartInfoRequest(user.role) ? (
            <div>
              <label htmlFor="info-assignee" className="mb-1 block text-sm font-medium text-gray-700">
                Incaricato
              </label>
              <select
                id="info-assignee"
                value={infoAssigneeId}
                onChange={(e) => setInfoAssigneeId(e.target.value)}
                className="input-field"
              >
                <option value="">— Seleziona operatore o fornitore —</option>
                {infoAssignees.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {assigneeLabel(a)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="relative">
              <label htmlFor="practice-combobox" className="mb-1 block text-sm font-medium text-gray-700">
                Pratica
              </label>
              <input
                id="practice-combobox"
                type="search"
                autoComplete="off"
                placeholder="Cerca per numero pratica, assistito o ID…"
                value={practiceSearch}
                onChange={(e) => {
                  const v = e.target.value;
                  setPracticeSearch(v);
                  setPracticeId('');
                  setPracticePickerOpen(true);
                }}
                onFocus={() => setPracticePickerOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setPracticePickerOpen(false), 180);
                }}
                className="input-field"
                aria-expanded={practicePickerOpen}
                aria-controls="practice-combobox-list"
                aria-autocomplete="list"
              />
              {practicePickerOpen && (
                <ul
                  id="practice-combobox-list"
                  role="listbox"
                  className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                >
                  {filteredPractices.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-gray-500">Nessuna pratica corrisponde alla ricerca.</li>
                  ) : (
                    filteredPractices.map((p) => (
                      <li key={p.id} role="option">
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-blue-50"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectPractice(p)}
                        >
                          {practiceOptionLine(p)}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Digita per filtrare l&apos;elenco, poi scegli una riga. Oppure apri il campo e scorri tutte le pratiche.
              </p>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Messaggio</label>
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              rows={4}
              className="input-field"
              placeholder={
                newKind === 'info'
                  ? 'Descrivi la richiesta di informazioni…'
                  : 'Testo del primo messaggio…'
              }
            />
          </div>
          {newError && <p className="text-sm text-red-600">{newError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setShowNew(false);
                setPracticeSearch('');
                setPracticePickerOpen(false);
                setInfoAssigneeId('');
              }}
              disabled={newSubmitting}
            >
              Annulla
            </button>
            <button type="button" className="btn-primary" onClick={handleCreateConversation} disabled={newSubmitting}>
              {newSubmitting ? 'Invio…' : 'Invia'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
