import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, FlatList, KeyboardAvoidingView, Linking, Platform,
  Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { inboxApi } from './inbox-api';
import { messageContextUrl } from './inbox-links';
import { createInboxStore, type Message } from './inbox-store';

function Button({ label, onPress, disabled = false }: { label: string; onPress(): void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
    style={[s.button, disabled && s.disabled]} onPress={onPress}><Text style={s.buttonText}>{label}</Text></Pressable>;
}
// Keep delivery locks across tabs; a token change replaces all private state.
export function NativeInbox({ token, active, target }: {
  token: string; active: boolean; target: { id: string; nonce: number } | null;
}) {
  const store = useMemo(() => createInboxStore(inboxApi(token)), [token]);
  const state = useSyncExternalStore(store.subscribe, store.snapshot);
  const insets = useSafeAreaInsets();
  const visible = useRef(active); visible.current = active;
  const marked = useRef(''), latestVisible = useRef(true), earlierHistory = useRef(false);
  function open(id: string | null) {
    marked.current = ''; earlierHistory.current = false; latestVisible.current = true;
    store.select(id);
  }
  useEffect(() => {
    if (target) {
      marked.current = ''; earlierHistory.current = false; latestVisible.current = true;
      store.select(target.id);
    }
  }, [store, target]);
  useEffect(() => {
    if (!active) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!store.snapshot().selected) return false;
      store.select(null); return true;
    });
    return () => back.remove();
  }, [active, store]);
  useEffect(() => {
    if (!active) return;
    const refresh = () => {
      if (AppState.currentState !== 'active') return;
      if (store.snapshot().selected) {
        if (latestVisible.current && !earlierHistory.current) void store.load();
      } else void store.list();
    };
    refresh();
    const interval = setInterval(refresh, 10_000);
    const listener = AppState.addEventListener('change', status => { if (status === 'active') refresh(); });
    return () => { clearInterval(interval); listener.remove(); };
  }, [active, store]);
  const onVisible = useMemo(() => ({ viewableItems }: { viewableItems: Array<{ item: Message }> }) => {
    if (!visible.current || AppState.currentState !== 'active') return;
    const latest = store.snapshot().messages.at(-1);
    latestVisible.current = !latest || viewableItems.some(v => v.item.id === latest.id);
    if (latest && marked.current !== latest.id && latestVisible.current) {
      marked.current = latest.id; void store.markVisible();
    }
  }, [store]);
  const draft = (state.selected && state.drafts[state.selected]) || { text: '', status: 'idle', checked: false };
  const person = state.conversation?.otherParticipant;
  const name = person?.displayName || person?.username || 'Hustle member';
  return <KeyboardAvoidingView style={[s.page, { paddingTop: insets.top + 16, display: active ? 'flex' : 'none' }]}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={s.header}><Text style={s.title}>{state.selected ? name : 'Inbox'}</Text>
      {state.selected ? <Button label="All conversations" onPress={() => open(null)}/> : null}</View>
    <Text style={s.meta}>Private conversations · Updates near latest messages</Text>
    {state.selected ? <>
      <View style={s.row}><Button label="Refresh messages" disabled={state.busy} onPress={() => {
        marked.current = ''; earlierHistory.current = false; latestVisible.current = true; void store.load();
      }}/>{state.busy ? <ActivityIndicator accessibilityLabel="Loading conversation"/> : null}</View>
      {state.error ? <Text accessibilityRole="alert" style={s.error}>Could not load this conversation: {state.error}</Text> : null}
      {state.readError ? <View><Text style={s.error}>{state.readError}</Text><Button label="Retry read status" onPress={() => void store.markVisible()}/></View> : null}
      <FlatList data={[...state.messages].reverse()} inverted keyExtractor={m => m.id}
        onViewableItemsChanged={onVisible} viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        keyboardShouldPersistTaps="handled" contentContainerStyle={s.history}
        ListEmptyComponent={!state.busy && !state.error ? <Text style={s.meta}>No messages yet. Start the conversation below.</Text> : null}
        ListFooterComponent={state.cursor ? <Button label="Load earlier messages" disabled={state.busy} onPress={() => {
          earlierHistory.current = true; void store.load(true);
        }}/> : null}
        renderItem={({ item }) => <View style={[s.message, item.senderId === state.conversation?.viewer.userId && s.mine]}>
          <Text style={s.sender}>{item.senderId === state.conversation?.viewer.userId ? 'You' : name}</Text>
          {item.text ? <Text selectable style={s.body}>{item.text}</Text> : null}
          {item.attachment ? <Text style={s.meta}>Attachment: {item.attachment.fileName || item.attachment.type}. Open on Hustle web to view.</Text> : null}
          {item.context ? <View><Text style={s.meta}>{item.context.type === 'SERVICE' ? 'Service enquiry' : 'Shared ' + item.context.type.toLowerCase()} · Current details may change</Text>
            {messageContextUrl(item.context) ? <Button label="View current public details ↗" onPress={() => {
              const url = messageContextUrl(item.context);
              if (url) void Linking.openURL(url).catch(() => Alert.alert('Public details unavailable', 'Could not open the current Hustle page. Try again.'));
            }}/> : <Text style={s.meta}>Public details unavailable in this build.</Text>}</View> : null}
          <Text style={s.meta}>{new Date(item.createdAt).toLocaleString('en-NG')}</Text>
        </View>}/>
      {draft.status === 'uncertain' ? <View accessibilityLiveRegion="polite"><Text style={s.error}>
        Delivery uncertain. Your reply may have arrived. Refresh and check the history before writing another message. This reply will not be resent automatically.
      </Text>{draft.checked ? <Button label="I checked the history · discard this draft" onPress={store.discardCheckedDraft}/> : null}</View> : null}
      <TextInput accessibilityLabel="Reply to conversation" placeholder="Write a reply…" placeholderTextColor="#727A70"
        multiline maxLength={4000} style={s.input} value={draft.text} onChangeText={store.edit}
        editable={draft.status === 'idle' && Boolean(state.conversation) && !state.error}/>
      <Button label={draft.status === 'sending' ? 'Sending…' : 'Send reply'}
        disabled={draft.status !== 'idle' || !draft.text.trim() || !state.conversation || state.busy || Boolean(state.error)} onPress={() => void store.send()}/>
    </> : <>
      <Button label="Refresh inbox" disabled={state.listBusy} onPress={() => void store.list()}/>
      {state.listBusy ? <ActivityIndicator accessibilityLabel="Loading conversations"/> : null}
      {state.listError ? <Text accessibilityRole="alert" style={s.error}>{state.listError}</Text> : null}
      <FlatList data={state.conversations} keyExtractor={c => c.id}
        ListEmptyComponent={!state.listBusy && !state.listError ? <Text style={s.meta}>No conversations yet. Discover a service and send an enquiry to start one.</Text> : null}
        ListFooterComponent={state.listCursor ? <Button label="Load more conversations" disabled={state.listBusy} onPress={() => void store.list(true)}/> : null}
        renderItem={({ item }) => <Pressable accessibilityRole="button" style={s.conversation} onPress={() => open(item.id)}>
          <Text style={s.sender}>{item.otherParticipant?.displayName || item.otherParticipant?.username || 'Hustle member'}</Text>
          <Text numberOfLines={2} style={s.body}>{item.lastMessage?.text || (item.lastMessage?.attachment ? 'Attachment' : 'No messages yet')}</Text>
          <Text style={s.meta}>{item.viewer.unreadCount ? item.viewer.unreadCount + ' unread' : 'Up to date'}</Text>
        </Pressable>}/>
    </>}
  </KeyboardAvoidingView>;
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F7F6F2', paddingHorizontal: 18, paddingBottom: 100 },
  header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  title: { fontSize: 27, fontWeight: '800', color: '#121714', flexShrink: 1 },
  meta: { color: '#586052', fontSize: 12, marginVertical: 5 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: { backgroundColor: '#C9F26B', padding: 12, borderRadius: 16, marginVertical: 5, minHeight: 44 },
  buttonText: { color: '#121714', fontWeight: '700' }, disabled: { opacity: 0.45 },
  conversation: { backgroundColor: '#E9EEE4', padding: 16, borderRadius: 18, marginVertical: 6 },
  history: { paddingVertical: 10 }, message: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 16, marginVertical: 6, marginRight: 28 },
  mine: { backgroundColor: '#E1EDCD', marginRight: 0, marginLeft: 28 }, sender: { color: '#121714', fontWeight: '800' },
  body: { fontSize: 16, color: '#121714', marginTop: 5 }, error: { color: '#9B2D20', marginVertical: 6 },
  input: { borderWidth: 1, borderColor: '#89917E', borderRadius: 16, padding: 12, color: '#121714', maxHeight: 120, minHeight: 48 }
});
