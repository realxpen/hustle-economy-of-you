import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createCreatorPostStore, ownerPostApi, type PostInput, type OwnerPost } from './mobile-post-publishing';

const blank: PostInput = { caption: '', category: '', location: '', imageUrl: '' };
function Action({ text, press, disabled = false }: { text: string; press(): void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled}
    accessibilityState={{ disabled }} style={[styles.button, disabled && styles.disabled]} onPress={press}>
    <Text style={styles.buttonText}>{text}</Text>
  </Pressable>;
}
export function NativeCreate({ token, active, onPublished }: {
  token: string; active: boolean; onPublished(): void;
}) {
  const store = useMemo(() => createCreatorPostStore(ownerPostApi(token)), [token]);
  const state = useSyncExternalStore(store.subscribe, store.snapshot);
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState<PostInput>(blank);
  const [showMine, setShowMine] = useState(false);
  const reported = useRef<string | null>(null);
  useEffect(() => { if (active) void store.list(); }, [active, store]);
  useEffect(() => {
    if (state.phase !== 'published' || !state.postId || reported.current === state.postId) return;
    reported.current = state.postId;
    onPublished();
  }, [state.phase, state.postId, onPublished]);
  function select(post: OwnerPost) {
    if (post.status !== 'DRAFT') return;
    store.resume(post);
    setInput({ caption: post.caption || '', category: post.category || '',
      location: post.location || '',
      imageUrl: post.media.find(m => m.type === 'IMAGE')?.mediaUrl || '' });
    setShowMine(false);
  }
  const update = (key: keyof PostInput) => (value: string) =>
    setInput(previous => ({ ...previous, [key]: value }));
  return <KeyboardAvoidingView
    style={[styles.page, { paddingTop: insets.top + 14, display: active ? 'flex' : 'none' }]}
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>YOUR WORK / REAL PREVIEW</Text>
      <Text style={styles.title}>Show what you can do.</Text>
      <Text style={styles.body}>Publish a real skill demonstration. This creates an owner-authorized post, attaches one public image and asks Hustle to publish it. No invented posts.</Text>
      <View style={styles.notice}>
        <Text style={styles.info}>First release accepts an image you already host via HTTPS. Photo uploads, video uploads, payments and booking are not enabled in this test.</Text>
      </View>
      {state.phase === 'review' ? <View style={styles.warning}><Text style={styles.error}>{state.notice}</Text>
        <Action text="Review My posts before continuing" press={() => { setShowMine(true); void store.list(); }}/>
      </View> : null}
      {state.phase === 'published' ? <View style={styles.notice}>
        <Text style={styles.info}>{state.notice}</Text>
        <Action text="Create another post" press={() => { store.newPost(); setInput(blank); }}/>
      </View> : <View>
        <Text style={styles.label}>Skill / category</Text>
        <TextInput accessibilityLabel="Post skill category" placeholder="e.g. Barbering"
          placeholderTextColor="#667065" maxLength={100} style={styles.field}
          value={input.category} onChangeText={update('category')} editable={state.phase !== 'sending'}/>
        <Text style={styles.label}>Show your work</Text>
        <TextInput accessibilityLabel="Post caption" placeholder="What did you make or do?"
          placeholderTextColor="#667065" maxLength={4000} style={[styles.field, styles.multiline]}
          multiline value={input.caption} onChangeText={update('caption')} editable={state.phase !== 'sending'}/>
        <Text style={styles.label}>Location (optional)</Text>
        <TextInput accessibilityLabel="Post location" placeholder="e.g. Lagos"
          placeholderTextColor="#667065" maxLength={160} style={styles.field}
          value={input.location} onChangeText={update('location')} editable={state.phase !== 'sending'}/>
        <Text style={styles.label}>Public HTTPS image URL</Text>
        <TextInput accessibilityLabel="Post image URL" placeholder="https://example.com/my-work.jpg"
          placeholderTextColor="#667065" autoCapitalize="none" keyboardType="url" maxLength={1200}
          style={styles.field} value={input.imageUrl} onChangeText={update('imageUrl')}
          editable={state.phase !== 'sending'}/>
        {input.imageUrl.trim().startsWith('https://') ?
          <Image accessibilityLabel="Image link preview" resizeMode="contain"
            source={{ uri: input.imageUrl.trim() }} style={styles.preview}/> : null}
        {state.notice && state.phase !== 'review' ? <Text accessibilityRole="alert" style={styles.error}>{state.notice}</Text> : null}
        {state.postId ? <Text style={styles.meta}>Working with your saved draft. ID: {state.postId.slice(0, 8)}…</Text> : null}
        {state.phase === 'sending' ? <ActivityIndicator color="#314122"/> : null}
        <Action text={state.phase === 'sending' ? 'Publishing…' : 'Publish on Hustle'}
          disabled={state.phase === 'sending' || state.phase === 'review'}
          press={() => void store.publish(input)}/>
      </View>}
      <Action text={showMine ? 'Hide My posts' : 'My posts / Review drafts'}
        press={() => { setShowMine(!showMine); if (!showMine) void store.list(); }}/>
      {showMine ? <View>
        {state.listError ? <Text accessibilityRole="alert" style={styles.error}>{state.listError}</Text> : null}
        {state.listing ? <ActivityIndicator color="#314122"/> : null}
        {!state.mine.length && !state.listing && !state.listError ? <Text style={styles.info}>No saved posts yet.</Text> : null}
        {state.mine.map(post => <View key={post.id} style={styles.saved}>
          <Text style={styles.savedTitle}>{post.category || 'Uncategorized'} · {post.status}</Text>
          <Text numberOfLines={3} style={styles.body}>{post.caption || 'No caption yet'}</Text>
          {post.status === 'DRAFT' ? <Action text="Review and resume this draft" press={() => select(post)}/> : null}
        </View>)}
        <Action text="Refresh My posts" press={() => void store.list()} disabled={state.listing}/>
      </View> : null}
    </ScrollView>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F7F6F2', paddingBottom: 82 },
  content: { paddingHorizontal: 22, paddingBottom: 48 },
  eyebrow: { color: '#53634B', letterSpacing: 1.3, fontWeight: '700', fontSize: 11 },
  title: { fontSize: 28, fontWeight: '900', color: '#151D19', marginTop: 10 },
  body: { color: '#364036', lineHeight: 21, fontSize: 14, marginVertical: 9 },
  notice: { backgroundColor: '#E5EDE0', padding: 14, borderRadius: 16, marginVertical: 15 },
  warning: { backgroundColor: '#FFF0D0', padding: 12, borderRadius: 15 },
  info: { color: '#294028', fontSize: 13, lineHeight: 19 },
  error: { color: '#872D18', fontSize: 13, marginVertical: 12 },
  label: { color: '#151D19', fontWeight: '700', marginTop: 13, marginBottom: 7, fontSize: 14 },
  field: { backgroundColor: '#FFFFFF', minHeight: 50, borderColor: '#A7AE9F',
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    color: '#151D19', fontSize: 15 },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  button: { backgroundColor: '#C9F26B', borderRadius: 17, minHeight: 49,
    paddingHorizontal: 17, paddingVertical: 13, marginTop: 12, justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  buttonText: { textAlign: 'center', fontWeight: '800', color: '#151D19' },
  preview: { height: 170, width: '100%', marginTop: 10, backgroundColor: '#E5EDE0',
    borderRadius: 12 },
  meta: { color: '#53634B', marginTop: 10 },
  saved: { backgroundColor: 'white', borderRadius: 16, padding: 13, marginTop: 12 },
  savedTitle: { color: '#151D19', fontWeight: '800' }
});
