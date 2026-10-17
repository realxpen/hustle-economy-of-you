import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal,
  Platform, Pressable, ScrollView, Share, StatusBar, StyleSheet, Text,
  TextInput, useWindowDimensions, View
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { syncMobileAccount } from '../lib/account';
import { mobileApi, type FeedItem, type FeedTab, type Offer, type PostComment, type SearchResult, type BookingSlot } from './feed-api';

const C = { dark: '#121714', lime: '#C9F26B', paper: '#F7F6F2', white: '#FFFFFF', muted: '#727A70', card: '#E9EEE4' };
type Screen = 'Home' | 'Explore' | 'Inbox' | 'You';
type Sheet = 'comments' | 'save' | 'share' | 'creator' | 'service' | 'product' | 'booking' | null;
type FeedSelection = FeedTab | 'live';
type IconName = React.ComponentProps<typeof Ionicons>['name'];
function Icon({ name, color = '#fff', size = 25 }: { name: IconName; color?: string; size?: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}
function formatPrice(offer: Offer) {
  if (offer.priceMinor == null) return 'Price on request';
  return (offer.currency || 'NGN') === 'NGN'
    ? '₦' + (offer.priceMinor / 100).toLocaleString('en-NG')
    : (offer.currency || '') + ' ' + (offer.priceMinor / 100).toFixed(2);
}
function count(n: number) { return n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'k' : String(n); }
function firstMedia(item: FeedItem) { return item.post.media.find(m => m.mediaUrl) || null; }

function VideoSurface({ item, active }: { item: FeedItem; active: boolean }) {
  const media = firstMedia(item);
  const videoUrl = media?.type === 'VIDEO' ? media.mediaUrl : null;
  const imageUrl = media?.type === 'IMAGE' ? media.mediaUrl : null;
  const player = useVideoPlayer(videoUrl, p => { p.loop = true; });
  useEffect(() => {
    if (!videoUrl) return;
    if (active) player.play(); else player.pause();
  }, [active, videoUrl, player]);
  return <View style={StyleSheet.absoluteFillObject}>
    {videoUrl ? <VideoView player={player} style={StyleSheet.absoluteFillObject} contentFit="cover" nativeControls={false} />
      : imageUrl ? <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      : <View style={styles.mediaUnavailable}><Icon name="images-outline" size={48} color="#C9D5C4" /><Text style={styles.mediaUnavailableText}>No playable media on this post</Text></View>}
    <View style={styles.mediaShade} pointerEvents="none" />
  </View>;
}
function RailButton({ icon, label, onPress, active = false }: { icon: IconName; label?: string; onPress: () => void; active?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label || icon} onPress={onPress} style={styles.railButton}>
    <Icon name={icon} color={active ? C.lime : '#fff'} size={29} />
    {label ? <Text style={styles.railCount}>{label}</Text> : null}
  </Pressable>;
}
function Action({ children, onPress, secondary = false, disabled = false }: { children: React.ReactNode; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.action, secondary && styles.secondaryAction, disabled && { opacity: .45 }]}>
    <Text style={[styles.actionText, secondary && { color: C.dark }]}>{children}</Text>
  </Pressable>;
}
function SheetTitle({ title, onClose }: { title: string; onClose: () => void }) {
  return <View style={styles.sheetTop}><Text style={styles.sheetTitle}>{title}</Text><Pressable accessibilityLabel="Close" onPress={onClose}><Icon name="close" color={C.dark} /></Pressable></View>;
}

function Experience({ session, onSignOut }: { session: Session; onSignOut: () => Promise<void> }) {
  const token = session.access_token;
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [screen, setScreen] = useState<Screen>('Home');
  const [feedTab, setFeedTab] = useState<FeedSelection>('for-you');
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedError, setFeedError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [discussionLoading, setDiscussionLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [bookingDate, setBookingDate] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [slotMode, setSlotMode] = useState('');
  const [slotTimezone, setSlotTimezone] = useState('UTC');
  const [slotLoading, setSlotLoading] = useState(false);
  const [chosenSlot, setChosenSlot] = useState<BookingSlot | null>(null);
  const [requirements, setRequirements] = useState('');
  const pageHeight = Math.max(400, height);
  const loadSeq = useRef(0);
  const paginationPending = useRef(false);
  const seen = useRef(new Set<string>());
  const active = posts.find(p => p.post.id === selectedId) || posts[activeIndex] || null;
  const currentOffer = active ? ([...active.services, ...active.products].find(o => o.id === offerId) || null) : null;

  const reload = useCallback(async () => {
    if (feedTab === 'live') return;
    const seq = ++loadSeq.current;
    setLoadingFeed(true); setFeedError(''); setActiveIndex(0); seen.current.clear();
    try {
      const page = await mobileApi.feed(token, feedTab);
      if (seq !== loadSeq.current) return;
      setPosts(page.items); setCursor(page.nextCursor); setMore(page.hasMore);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setPosts([]); setMore(false); setCursor(null);
      setFeedError(err instanceof Error ? err.message : 'Could not load the feed.');
    } finally { if (seq === loadSeq.current) setLoadingFeed(false); }
  }, [token, feedTab]);

  useEffect(() => { void reload(); return () => { loadSeq.current += 1; }; }, [reload]);
  useEffect(() => {
    if (screen !== 'Home' || sheet || feedTab === 'live') return;
    const post = posts[activeIndex];
    if (!post || seen.current.has(post.post.id)) return;
    seen.current.add(post.post.id);
    void mobileApi.event(token, 'feed.view', post.post.id, feedTab, { position: activeIndex }).catch(() => {});
  }, [posts, activeIndex, screen, sheet, feedTab, token]);

  const fetchMore = useCallback(async () => {
    if (feedTab === 'live' || !more || !cursor || loadingFeed || paginationPending.current) return;
    paginationPending.current = true; setLoadingMore(true);
    const seq = loadSeq.current;
    try {
      const page = await mobileApi.feed(token, feedTab, cursor);
      if (seq !== loadSeq.current) return;
      setPosts(old => {
        const known = new Set(old.map(p => p.post.id));
        return old.concat(page.items.filter(item => !known.has(item.post.id)));
      });
      setCursor(page.nextCursor); setMore(page.hasMore);
    } catch (err) {
      if (seq === loadSeq.current) setFeedError(err instanceof Error ? err.message : 'Could not load more posts.');
    } finally { paginationPending.current = false; setLoadingMore(false); }
  }, [token, feedTab, cursor, more, loadingFeed]);

  function show(type: Sheet, item: FeedItem, selectedOffer?: Offer) {
    setSelectedId(item.post.id); setOfferId(selectedOffer?.id || null); setSheet(type);
  }
  async function mutate(kind: 'like' | 'save' | 'follow', item: FeedItem) {
    if (working) return;
    setWorking(true);
    try {
      const next = !item.viewer[kind === 'follow' ? 'following' : kind === 'like' ? 'liked' : 'saved'];
      if (kind === 'like') await mobileApi.like(token, item.post.id, next);
      else if (kind === 'save') await mobileApi.save(token, item.post.id, next);
      else await mobileApi.follow(token, item.creator.id, next);
      setPosts(current => current.map(p => p.post.id !== item.post.id ? p : {
        ...p, viewer: { ...p.viewer, [kind === 'follow' ? 'following' : kind === 'like' ? 'liked' : 'saved']: next },
        engagement: {
          ...p.engagement,
          ...(kind === 'like' ? { likes: Math.max(0, p.engagement.likes + (next ? 1 : -1)) } : {}),
          ...(kind === 'save' ? { saves: Math.max(0, p.engagement.saves + (next ? 1 : -1)) } : {})
        }
      }));
      if (kind === 'save') setSheet(null);
    } catch (err) { Alert.alert('Unable to update', err instanceof Error ? err.message : 'Try again.'); }
    finally { setWorking(false); }
  }
  useEffect(() => {
    if (sheet !== 'comments' || !active) return;
    let mounted = true;
    setDiscussionLoading(true); setComments([]); setReplyTo(null);
    mobileApi.discussion(token, active.post.id).then(result => {
      if (mounted) setComments(result.comments);
    }).catch(e => { if (mounted) Alert.alert('Comments unavailable', String(e.message || e)); })
      .finally(() => { if (mounted) setDiscussionLoading(false); });
    return () => { mounted = false; };
  }, [sheet, selectedId, token]);

  async function submitComment() {
    if (!active || !draft.trim() || working) return;
    setWorking(true);
    try {
      const next = await mobileApi.comment(token, active.post.id, draft.trim(), replyTo || undefined);
      setComments(previous => previous.concat(next)); setDraft(''); setReplyTo(null);
      setPosts(prev => prev.map(item => item.post.id === active.post.id
        ? { ...item, engagement: { ...item.engagement, comments: item.engagement.comments + 1 } } : item));
    } catch (err) { Alert.alert('Comment not sent', err instanceof Error ? err.message : 'Try again.'); }
    finally { setWorking(false); }
  }
  async function performSearch() {
    if (!searchText.trim()) { setSearchResults([]); return; }
    setSearchError(''); setSearchLoading(true);
    try { const result = await mobileApi.search(token, searchText.trim()); setSearchResults(result.items); }
    catch (err) { setSearchResults([]); setSearchError(err instanceof Error ? err.message : 'Search failed.'); }
    finally { setSearchLoading(false); }
  }
  const offerService = active?.services.find(s => s.id === offerId) || null;
  useEffect(() => {
    if (sheet !== 'booking' || !offerService) return;
    let mounted = true;
    setSlots([]); setChosenSlot(null); setSlotLoading(true);
    mobileApi.slots(token, offerService.id, bookingDate).then(result => {
      if (mounted) { setSlots(result.slots.filter(s => s.available)); setSlotMode(result.mode); setSlotTimezone(result.timezone || 'UTC'); }
    }).catch(err => { if (mounted) { setSlotMode('Unavailable: ' + (err instanceof Error ? err.message : 'try again')); } })
      .finally(() => { if (mounted) setSlotLoading(false); });
    return () => { mounted = false; };
  }, [sheet, offerService?.id, bookingDate, token]);

  function bookingRequest() {
    if (!offerService || !chosenSlot || !requirements.trim()) {
      Alert.alert('Booking details', 'Select an available slot and describe the work required.'); return;
    }
    if (process.env.EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS !== 'true') {
      Alert.alert('Booking preview only', 'Booking writes are disabled until the nonproduction acceptance gate is approved.'); return;
    }
    Alert.alert('Send booking request?', 'This creates a genuine REQUESTED booking. No payment is collected.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send request', onPress: async () => {
        setWorking(true);
        try {
          const result = await mobileApi.requestBooking(token, offerService.id, chosenSlot.startAt, chosenSlot.endAt, requirements.trim());
          Alert.alert('Request sent', 'Booking ' + result.id + ' · ' + result.status);
          setSheet(null); setRequirements('');
        } catch (err) { Alert.alert('Request failed', err instanceof Error ? err.message : 'Try again.'); }
        finally { setWorking(false); }
      } }
    ]);
  }
  async function sharePost(item: FeedItem) {
    const publicWeb = process.env.EXPO_PUBLIC_PUBLIC_WEB_URL?.replace(/\/$/, '');
    const link = publicWeb ? '\n' + publicWeb + '/posts/' + encodeURIComponent(item.post.id) : '';
    try { await Share.share({ message: 'See ' + (item.creator.displayName || 'this Hustler') + ' on Hustle.' + link }); }
    catch { Alert.alert('Sharing unavailable', 'Could not open the share menu.'); }
  }

  function FeedCard({ item, index }: { item: FeedItem; index: number }) {
    const mainOffer = item.services[0] || item.products[0];
    const isService = Boolean(item.services[0]);
    return <View style={[styles.post, { height: pageHeight }]}>
      <VideoSurface item={item} active={screen === 'Home' && !sheet && index === activeIndex && feedTab !== 'live'} />
      <View style={[styles.topBar, { top: insets.top + 14 }]}>
        <Text style={styles.brand}>hustle.</Text>
        <Pressable accessibilityLabel="Explore" onPress={() => setScreen('Explore')}><Icon name="search" /></Pressable>
      </View>
      <View style={[styles.feedTabs, { top: insets.top + 65 }]}>
        {([['live', 'LIVE'], ['for-you', 'For You'], ['nearby', 'Nearby'], ['connections', 'Following']] as const).map(([key, label]) =>
          <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: feedTab === key }} onPress={() => key === 'live' ? Alert.alert('Live beta', 'Live streaming is not enabled yet.') : setFeedTab(key)} style={[styles.feedTab, feedTab === key && styles.feedTabActive]}>
            <Text style={[styles.feedTabText, feedTab === key && { color: C.white }]}>{label}</Text>
          </Pressable>)}
      </View>
      <View style={[styles.sideRail, { bottom: insets.bottom + 173 }]}>
        <RailButton icon="person-circle-outline" onPress={() => show('creator', item)} />
        <RailButton icon={item.viewer.liked ? 'heart' : 'heart-outline'} label={count(item.engagement.likes)} active={item.viewer.liked} onPress={() => void mutate('like', item)} />
        <RailButton icon="chatbubble-outline" label={count(item.engagement.comments)} onPress={() => show('comments', item)} />
        <RailButton icon={item.viewer.saved ? 'bookmark' : 'bookmark-outline'} active={item.viewer.saved} onPress={() => show('save', item)} />
        <RailButton icon="arrow-redo-outline" onPress={() => show('share', item)} />
      </View>
      <View style={[styles.postBottom, { bottom: insets.bottom + 75 }]}>
        <Pressable onPress={() => show('creator', item)}>
          <Text style={styles.creator}>@{item.creator.username || item.creator.displayName || 'hustler'}  ·  <Text style={{ color: C.lime }}>{item.viewer.following ? 'Following' : 'Follow'}</Text></Text>
          <Text numberOfLines={3} style={styles.caption}>{item.post.caption || 'See the work behind the skill.'}</Text>
          <Text style={styles.audio}>{item.creator.professionalProfile?.primarySkill || item.post.category || 'Skills in action'} · {item.post.location || item.creator.location || 'Hustle'}</Text>
        </Pressable>
        {mainOffer ? <Pressable onPress={() => show(isService ? 'service' : 'product', item, mainOffer)} style={styles.attached}>
          <View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.offer}>✦ {mainOffer.title}</Text><Text style={styles.offerPrice}>{formatPrice(mainOffer)}</Text></View>
          <Text style={{ color: C.lime, fontWeight: '800' }}>{isService ? 'Book ↗' : 'View ↗'}</Text>
        </Pressable> : null}
      </View>
    </View>;
  }

  const renderPost = ({ item, index }: { item: FeedItem; index: number }) => FeedCard({ item, index });
  return <View style={{ flex: 1, backgroundColor: C.dark }}>
    <StatusBar barStyle={screen === 'Home' ? 'light-content' : 'dark-content'} />
    {screen === 'Home' ? feedTab === 'live' ? <View style={styles.emptyDark}><Icon name="radio-outline" size={50} /><Text style={styles.emptyHeading}>Live is coming to Hustle</Text><Text style={styles.emptyBody}>Live discovery will appear here when the Live API and media infrastructure are active.</Text></View>
      : loadingFeed ? <View style={styles.emptyDark}><ActivityIndicator color={C.lime} /><Text style={styles.emptyBody}>Finding great work…</Text></View>
      : feedError && !posts.length ? <View style={styles.emptyDark}><Text style={styles.emptyHeading}>Couldn't load Hustle</Text><Text style={styles.emptyBody}>{feedError}</Text><Action onPress={() => void reload()}>Retry</Action></View>
      : <FlatList data={posts} key={feedTab} keyExtractor={item => item.post.id} renderItem={renderPost} pagingEnabled decelerationRate="fast" showsVerticalScrollIndicator={false}
          onMomentumScrollEnd={e => setActiveIndex(Math.max(0, Math.min(posts.length - 1, Math.round(e.nativeEvent.contentOffset.y / pageHeight))))}
          getItemLayout={(_, i) => ({ length: pageHeight, offset: pageHeight * i, index: i })} onEndReached={() => void fetchMore()} onEndReachedThreshold={0.7}
          ListEmptyComponent={<View style={styles.emptyDark}><Text style={styles.emptyHeading}>No posts yet</Text><Text style={styles.emptyBody}>Follow Hustlers or check the Nearby feed as people publish their work.</Text></View>}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={C.lime} /> : feedError ? <Pressable onPress={() => void fetchMore()}><Text style={styles.errorSmall}>{feedError} · Retry</Text></Pressable> : null} /> : null}
    {screen === 'Explore' && <View style={[styles.lightPage, { paddingTop: insets.top + 18 }]}>
      <Text style={styles.pageTitle}>Explore</Text><Text style={styles.subline}>Find skills, people, services and products.</Text>
      <View style={styles.searchRow}><Icon name="search" color={C.dark} size={20} /><TextInput accessibilityLabel="Search Hustle" placeholder="Try 'tailor in Lagos'" placeholderTextColor={C.muted} style={styles.searchInput} value={searchText} onChangeText={setSearchText} onSubmitEditing={() => void performSearch()} returnKeyType="search"/><Pressable onPress={() => void performSearch()}><Icon name="arrow-forward" color={C.dark} size={20}/></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled"><Text style={styles.sectionTitle}>Browse by skill</Text><View style={styles.chips}>{['Beauty','Fashion','Home','Media','Digital'].map(category => <Pressable key={category} style={styles.chip} onPress={() => { setSearchText(category); setSearchLoading(true); mobileApi.search(token, category).then(p => setSearchResults(p.items)).catch(e => setSearchError(String(e.message || e))).finally(() => setSearchLoading(false)); }}><Text style={styles.chipText}>{category}</Text></Pressable>)}</View>
        <Text style={styles.sectionTitle}>Nearby discovery</Text><View style={styles.mapPlaceholder}><Icon name="map-outline" color="#354C38" size={34}/><Text style={styles.mapText}>Live map not connected</Text><Text style={styles.meta}>Search works now. Map pins require a location provider and verified coordinates.</Text></View>
        <Text style={styles.sectionTitle}>Search results</Text>{searchLoading ? <ActivityIndicator /> : searchError ? <Text style={styles.meta}>{searchError}</Text> : searchResults.length ? searchResults.map(result => {
          const record = result.value as { service?: Offer; product?: Offer; owner?: { displayName?: string }; post?: { caption?: string } };
          const title = record.service?.title || record.product?.title || record.owner?.displayName || record.post?.caption || result.kind;
          return <View style={styles.resultCard} key={result.kind + result.id}><Icon name="sparkles-outline" color={C.dark}/><View style={{ flex: 1 }}><Text style={styles.resultTitle}>{title}</Text><Text style={styles.meta}>{result.kind} · Hustle</Text></View></View>;
        }) : <Text style={styles.meta}>Search for a skill or select a category to find published Hustlers.</Text>}</ScrollView>
    </View>}
    {(screen === 'Inbox' || screen === 'You') && <View style={[styles.lightPage, { paddingTop: insets.top + 18 }]}><Text style={styles.pageTitle}>{screen}</Text><Text style={styles.subline}>{screen === 'You' ? session.user.email || 'Your Hustle identity' : 'Messages'}</Text><Text style={styles.meta}>{screen === 'Inbox' ? 'Messaging UI will use the authenticated Hustle messaging API in a later mobile milestone.' : 'One account. Client capability first. Hustler and Agent capabilities unlock on the same account.'}</Text>{screen === 'You' ? <Action onPress={() => void onSignOut()}>Sign out</Action> : null}</View>}
    <View style={[styles.nav, { bottom: Math.max(10, insets.bottom) }]}>
      {([['Home','home'],['Explore','search'],['Create','add-circle'],['Inbox','chatbubbles'],['You','person']] as const).map(([label, icon]) => <Pressable key={label} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: label === screen }} onPress={() => {
        if (label === 'Create') Alert.alert('Create content', 'The mobile publishing workflow is being connected to Hustler permissions.');
        else setScreen(label);
      }} style={[styles.navItem, screen === label && styles.navSelected]}><Icon name={icon} color={screen === label ? C.dark : C.white} size={23}/></Pressable>)}
    </View>
    <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
      <View style={styles.modalRoot}><Pressable style={styles.scrim} onPress={() => setSheet(null)} accessibilityLabel="Dismiss sheet" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.handle} />
            <SheetTitle title={sheet === 'comments' ? 'Comments' : sheet === 'save' ? 'Save this post' : sheet === 'share' ? 'Share this work' : sheet === 'creator' ? 'Creator' : sheet === 'service' ? 'Attached service' : sheet === 'product' ? 'Attached product' : 'Request booking'} onClose={() => setSheet(null)} />
            {active && sheet === 'comments' && <><ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled">{discussionLoading ? <ActivityIndicator /> : comments.length ? comments.map(comment => <View key={comment.id} style={[styles.comment, comment.parentId && { marginLeft: 28 }]}><View style={styles.avatar}><Icon name="person-outline" color={C.dark} /></View><View style={{ flex: 1 }}><Text style={styles.resultTitle}>@{comment.user.username || comment.user.displayName || 'member'}</Text><Text style={styles.commentBody}>{comment.body}</Text><Pressable onPress={() => setReplyTo(comment.id)}><Text style={styles.meta}>Reply</Text></Pressable></View></View>) : <Text style={styles.meta}>Start the conversation.</Text>}</ScrollView>{replyTo && <Pressable onPress={() => setReplyTo(null)}><Text style={styles.meta}>Replying to a comment · Cancel</Text></Pressable>}<View style={styles.composer}><TextInput accessibilityLabel="Write a comment" placeholder="Write a comment…" style={{ flex: 1, color: C.dark }} value={draft} onChangeText={setDraft}/><Pressable disabled={working} onPress={() => void submitComment()}><Icon name="send" color={C.dark} /></Pressable></View></>}
            {active && sheet === 'save' && <><Text style={styles.meta}>Saved posts are tied to your Hustle account. Named collections are not supported by the current API yet.</Text><Action disabled={working} onPress={() => void mutate('save', active)}>{active.viewer.saved ? 'Remove saved post' : 'Save to Hustle'}</Action></>}
            {active && sheet === 'share' && <><Text style={styles.meta}>Share demonstrated work with someone who needs it.</Text><Action onPress={() => void sharePost(active)}>Open share menu</Action></>}
            {active && sheet === 'creator' && <><Text style={styles.resultTitle}>{active.creator.displayName || active.creator.username || 'Hustler'}</Text><Text style={styles.meta}>{active.creator.professionalProfile?.primarySkill || 'Professional'} · {active.creator.location || 'Location not supplied'}</Text><Text style={styles.meta}>{active.creator.verified ? 'Contact verification recorded' : 'Contact verification unavailable'}</Text><Action disabled={working} onPress={() => void mutate('follow', active)}>{active.viewer.following ? 'Following · Unfollow' : 'Follow creator'}</Action>{active.services.map(service => <Pressable key={service.id} style={styles.resultCard} onPress={() => { setOfferId(service.id); setSheet('service'); }}><Text style={styles.resultTitle}>{service.title}</Text><Text style={styles.meta}>{formatPrice(service)}</Text></Pressable>)}</>}
            {active && (sheet === 'service' || sheet === 'product') && <><Text style={styles.resultTitle}>{currentOffer?.title || 'Offer unavailable'}</Text><Text style={styles.meta}>By {active.creator.displayName || 'Hustler'}</Text><Text style={styles.price}>{currentOffer ? formatPrice(currentOffer) : ''}</Text><Text style={styles.meta}>{currentOffer?.description || 'Review the details before proceeding.'}</Text><Action disabled={!currentOffer} onPress={() => {
              if (sheet === 'service') setSheet('booking');
              else Alert.alert('Product checkout', 'Product variants and orders are not enabled in this mobile build.');
            }}>{sheet === 'service' ? 'Check availability ↗' : 'View product options'}</Action></>}
            {active && sheet === 'booking' && <><Text style={styles.resultTitle}>{offerService?.title || 'Service unavailable'}</Text><Text style={styles.meta}>Choose a day (up to 90 days ahead). Availability comes from Hustle, not demo slots.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: 16 }}>{[1,2,3,4,5,6,7].map(offset => {
              const day = new Date(Date.now() + offset * 86_400_000).toISOString().slice(0,10);
              return <Pressable key={day} onPress={() => setBookingDate(day)} style={[styles.dateChoice, day === bookingDate && styles.selectedDate]}><Text style={[styles.chipText, day === bookingDate && { color: C.white }]}>{day.slice(5)}</Text></Pressable>;
            })}</ScrollView>{slotLoading ? <ActivityIndicator /> : <Text style={styles.meta}>{slotMode === 'APPOINTMENT' ? 'Available appointment starts' : slotMode || 'Availability unavailable'}</Text>}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginVertical: 12 }}>{slots.map(slot => <Pressable key={slot.startAt} style={[styles.dateChoice, slot.startAt === chosenSlot?.startAt && styles.selectedDate]} onPress={() => setChosenSlot(slot)}><Text style={[styles.chipText, slot.startAt === chosenSlot?.startAt && { color: C.white }]}>{new Intl.DateTimeFormat('en-NG',{hour:'numeric',minute:'2-digit',timeZone: slotTimezone}).format(new Date(slot.startAt))}</Text></Pressable>)}</ScrollView>
            {slotMode === 'APPOINTMENT' && !slotLoading && slots.length === 0 ? <Text style={styles.meta}>No available slots for this day.</Text> : null}
            <TextInput accessibilityLabel="Project requirements" style={styles.requirements} multiline placeholder="Describe the work you need..." value={requirements} onChangeText={setRequirements}/>
            <Action disabled={working || !chosenSlot || !requirements.trim()} onPress={bookingRequest}>Request booking</Action><Text style={styles.meta}>Booking submission is disabled by default. No payment or escrow action occurs here.</Text></>}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  </View>;
}
export function MobileExperience(props: { session: Session; onSignOut: () => Promise<void> }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let mounted = true;
    setReady(false); setError('');
    syncMobileAccount(props.session.access_token)
      .then(() => { if (mounted) setReady(true); })
      .catch(reason => { if (mounted) setError(reason instanceof Error ? reason.message : 'Account sync failed'); });
    return () => { mounted = false; };
  }, [props.session.access_token, retry]);
  return <SafeAreaProvider>
    {ready ? <Experience {...props} /> : <View style={styles.emptyDark}>
      {error ? <><Text style={styles.emptyHeading}>Unable to prepare your Hustle account</Text>
        <Text style={styles.emptyBody}>{error}</Text>
        <Action onPress={() => setRetry(n => n + 1)}>Try again</Action>
        <Action secondary onPress={() => void props.onSignOut()}>Sign out</Action></>
        : <><ActivityIndicator color={C.lime} /><Text style={styles.emptyBody}>Preparing your Hustle identity…</Text></>}
    </View>}
  </SafeAreaProvider>;
}
const styles = StyleSheet.create({
  post: { backgroundColor: C.dark, width: '100%' }, mediaUnavailable: { flex: 1, backgroundColor: '#344A3C', justifyContent: 'center', alignItems: 'center', gap: 16 },
  mediaUnavailableText: { color: C.white, fontSize: 12 }, mediaShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,10,5,.23)' },
  topBar: { position: 'absolute', left: 22, right: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: C.white, fontWeight: '900', fontSize: 24 }, feedTabs: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', justifyContent: 'center' },
  feedTab: { paddingHorizontal: 9, paddingBottom: 8 }, feedTabActive: { borderBottomWidth: 2, borderBottomColor: C.lime },
  feedTabText: { fontSize: 14, fontWeight: '700', color: '#B8C1B8' }, sideRail: { position: 'absolute', right: 12, gap: 14 },
  railButton: { width: 55, alignItems: 'center' }, railCount: { color: C.white, fontSize: 11, fontWeight: '800' },
  postBottom: { position: 'absolute', left: 20, right: 85 }, creator: { fontSize: 16, fontWeight: '800', color: C.white },
  caption: { color: C.white, fontSize: 14, marginTop: 9, lineHeight: 20 }, audio: { color: '#E5ECE4', fontSize: 11, marginTop: 8 },
  attached: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#293D31', marginTop: 16, padding: 12, borderRadius: 16 },
  offer: { fontWeight: '800', color: C.white, fontSize: 13 }, offerPrice: { fontSize: 11, color: '#D4E7D0', marginTop: 4 },
  nav: { position: 'absolute', left: 18, right: 18, height: 58, backgroundColor: C.dark, borderRadius: 30, paddingHorizontal: 8, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  navItem: { width: 52, height: 43, borderRadius: 23, alignItems: 'center', justifyContent: 'center' }, navSelected: { backgroundColor: C.lime },
  lightPage: { flex: 1, backgroundColor: C.paper, paddingHorizontal: 23 }, pageTitle: { fontSize: 29, fontWeight: '900', color: C.dark },
  subline: { color: C.muted, marginTop: 8, marginBottom: 18 }, searchRow: { height: 50, backgroundColor: C.white, paddingHorizontal: 15, borderRadius: 16, flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, marginLeft: 8, color: C.dark }, sectionTitle: { fontSize: 19, fontWeight: '800', marginVertical: 20, color: C.dark },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, chip: { backgroundColor: '#DFECCF', padding: 14, borderRadius: 16 },
  chipText: { fontSize: 13, fontWeight: '800', color: C.dark }, mapPlaceholder: { height: 160, backgroundColor: '#E6EDDE', borderRadius: 18, justifyContent: 'center', alignItems: 'center', gap: 6, padding: 16 },
  mapText: { fontWeight: '800', color: '#354C38' }, meta: { fontSize: 12, color: C.muted, lineHeight: 18, marginTop: 9 },
  resultCard: { backgroundColor: C.white, borderRadius: 16, padding: 16, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  resultTitle: { fontWeight: '800', color: C.dark, fontSize: 15, flexShrink: 1 }, emptyDark: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 35, backgroundColor: C.dark },
  emptyHeading: { fontSize: 23, fontWeight: '800', color: C.white, textAlign: 'center', marginTop: 12 },
  emptyBody: { color: '#DCE4D8', textAlign: 'center', marginTop: 12, lineHeight: 22 }, errorSmall: { color: C.white, textAlign: 'center', margin: 20 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' }, scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,.55)' },
  sheet: { backgroundColor: C.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 22, paddingTop: 15, minHeight: 260, maxHeight: '90%' },
  handle: { width: 65, height: 5, backgroundColor: '#C9D1C5', borderRadius: 3, alignSelf: 'center', marginBottom: 19 },
  sheetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 17 }, sheetTitle: { fontSize: 21, fontWeight: '800', color: C.dark },
  action: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.lime, padding: 17, marginTop: 19, borderRadius: 20 },
  actionText: { fontWeight: '800', fontSize: 15, color: C.dark }, secondaryAction: { backgroundColor: C.card }, avatar: { backgroundColor: '#E0EBD3', width: 37, height: 37, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  comment: { flexDirection: 'row', gap: 12, paddingVertical: 9 }, commentBody: { color: C.dark, fontSize: 14, marginTop: 4 },
  composer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E9EEE5', borderRadius: 25, paddingHorizontal: 16, marginTop: 14 },
  price: { fontSize: 22, fontWeight: '900', marginVertical: 12, color: C.dark }, dateChoice: { padding: 13, borderRadius: 13, backgroundColor: '#E7ECE5', marginRight: 9 },
  selectedDate: { backgroundColor: C.dark }, requirements: { backgroundColor: C.white, minHeight: 74, marginTop: 8, padding: 13, borderRadius: 14, color: C.dark, textAlignVertical: 'top' }
});
