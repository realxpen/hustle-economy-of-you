import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Linking, Modal,
  Platform, Pressable, ScrollView, Share, StatusBar, StyleSheet, Text,
  TextInput, useWindowDimensions, View
} from 'react-native';
import type { MobileSession as Session } from '../lib/mobile-session';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radii, spacing } from '../ux004/theme';
import { SheetChrome } from '../ux004/components/SheetChrome';
import { SkillChip } from '../ux004/components/SkillChip';
import { ScreenHeader } from '../ux004/components/ScreenHeader';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { syncMobileAccount } from '../lib/account';
import { mobileApi, type FeedItem, type FeedTab, type Offer, type PostComment, type SearchResult, type SearchTab, type BookingSlot, type SlotPage } from './feed-api';
import { connectedSearchWebLink, describeMobileSearchResult } from '../ux004/discovery/connectedSearchResult';
import { appendUniqueSearchResults } from '../ux004/discovery/connectedSearchPagination';
import { currentSearchOffer, getSearchHustler, matchedPublishedOffers, searchHustlerPublicLink }
  from '../ux004/discovery/connectedOpportunity';
import { currentEnquirySlots, enquiryNextDays, enquiryServiceId, enquirySlotLabel }
  from '../ux004/discovery/connectedOpportunityAvailability';
import { consultationWebLink, createEnquiryDelivery, prepareEnquiryMessage, type Delivery }
  from '../ux004/discovery/enquiryConsultation';

const C = { dark: colors.darkBase, lime: colors.lime, paper: colors.paper, white: colors.surface,
  muted: colors.textSecondaryLight, card: colors.raised };
const SEARCH_TABS: ReadonlyArray<{ id: SearchTab; label: string }> = [
  { id: 'top', label: 'Top' }, { id: 'people', label: 'People' },
  { id: 'posts', label: 'Posts' }, { id: 'services', label: 'Services' },
  { id: 'products', label: 'Products' }
];
type Screen = 'Home' | 'Explore' | 'Inbox' | 'You';
type Sheet = 'comments' | 'save' | 'share' | 'creator' | 'service' | 'product' | 'booking' | null;
type OpportunityStage = 'profile' | 'offer' | 'enquiry' | null;
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
  return <SheetChrome title={title} onClose={onClose}/>;
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
  const [opportunityStage, setOpportunityStage] = useState<OpportunityStage>(null);
  const [opportunitySource, setOpportunitySource] = useState<SearchResult | null>(null);
  const [opportunitySelectedOffer, setOpportunitySelectedOffer] = useState<SearchResult | null>(null);
  const [opportunityMatches, setOpportunityMatches] = useState<SearchResult[]>([]);
  const [enquiryDraft, setEnquiryDraft] = useState('');
  const [enquiryReviewed, setEnquiryReviewed] = useState(false);
  const [enquiryDate, setEnquiryDate] = useState(() => enquiryNextDays()[0]);
  const [enquirySlotPage, setEnquirySlotPage] = useState<SlotPage | null>(null);
  const [enquirySelectedSlot, setEnquirySelectedSlot] = useState<BookingSlot | null>(null);
  const [enquirySlotLoading, setEnquirySlotLoading] = useState(false);
  const [enquirySlotError, setEnquirySlotError] = useState('');
  const enquirySlotsSeq = useRef(0);
  const enquiryDelivery = useRef(createEnquiryDelivery(mobileApi));
  const [enquiryDeliveryState, setEnquiryDeliveryState] = useState<Delivery>({ status: 'idle' });
  const [searchText, setSearchText] = useState('');
  const [searchTab, setSearchTab] = useState<SearchTab>('top');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchCursor, setSearchCursor] = useState<string | null>(null);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchMoreLoading, setSearchMoreLoading] = useState(false);
  const [searchMoreError, setSearchMoreError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const searchSeq = useRef(0);
  const searchMorePending = useRef(false);
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
  // Invalidate pending responses whenever the query changes, so a slower
  // previous request cannot overwrite the user's latest results or errors.
  useEffect(() => () => { searchSeq.current += 1; }, [token]);
  function editSearch(next: string) {
    searchSeq.current += 1;
    searchMorePending.current = false;
    setSearchText(next);
    setSearchResults([]);
    setSearchCursor(null);
    setSearchHasMore(false);
    setSearchMoreError('');
    setSearchMoreLoading(false);
    setSearchError('');
    setHasSearched(false);
    setSearchLoading(false);
  }
  async function runSearch(input: string, tab: SearchTab = searchTab) {
    const query = input.trim();
    const seq = ++searchSeq.current;
    searchMorePending.current = false;
    setSearchText(input);
    setSearchTab(tab);
    setSearchResults([]);
    setSearchCursor(null);
    setSearchHasMore(false);
    setSearchMoreError('');
    setSearchMoreLoading(false);
    setSearchError('');
    setHasSearched(Boolean(query));
    if (!query) { setSearchLoading(false); return; }
    setSearchLoading(true);
    try {
      const result = await mobileApi.searchTab(token, tab, query);
      if (seq === searchSeq.current) setSearchResults(result.items);
      if (seq === searchSeq.current) {
        setSearchCursor(result.nextCursor);
        setSearchHasMore(result.hasMore);
      }
    } catch (err) {
      if (seq === searchSeq.current) setSearchError(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      if (seq === searchSeq.current) setSearchLoading(false);
    }
  }
  function chooseSearchTab(tab: SearchTab) {
    if (searchTab === tab) return;
    // Changing tabs replaces the request with one sent to the backend's
    // authoritative /search/:tab endpoint, even if the prior tab is loading.
    void runSearch(searchText, tab);
  }
  async function loadSearchMore() {
    if (searchLoading || searchMoreLoading || searchMorePending.current || !searchHasMore || !searchCursor) return;
    const query = searchText.trim();
    if (!query) return;
    const seq = searchSeq.current;
    const cursor = searchCursor;
    const tab = searchTab;
    searchMorePending.current = true;
    setSearchMoreLoading(true);
    setSearchMoreError('');
    try {
      const page = await mobileApi.searchTab(token, tab, query, cursor);
      if (seq !== searchSeq.current) return;
      setSearchResults(old => appendUniqueSearchResults(old, page.items));
      setSearchCursor(page.nextCursor);
      setSearchHasMore(page.hasMore);
    } catch (err) {
      if (seq === searchSeq.current) setSearchMoreError(err instanceof Error ? err.message : 'More results could not be loaded.');
    } finally {
      if (seq === searchSeq.current) {
        searchMorePending.current = false;
        setSearchMoreLoading(false);
      }
    }
  }
  // A read-only GET may return after the user changes service/date or dismisses
  // the sheet. Clear its prior information before any new provider/day lookup.
  useEffect(() => () => {
    enquirySlotsSeq.current += 1;
    enquiryDelivery.current.invalidate();
  }, [token]);
  function resetEnquiryDelivery() {
    enquiryDelivery.current.invalidate();
    enquiryDelivery.current = createEnquiryDelivery(mobileApi);
    setEnquiryDeliveryState({ status: 'idle' });
  }
  function clearEnquirySlots() {
    enquirySlotsSeq.current += 1;
    setEnquirySlotPage(null);
    setEnquirySelectedSlot(null);
    setEnquirySlotError('');
    setEnquirySlotLoading(false);
    setEnquiryReviewed(false);
  }
  function startEnquiryPreview() {
    resetEnquiryDelivery();
    clearEnquirySlots();
    setEnquiryDate(enquiryNextDays()[0]);
    setEnquiryDraft('');
    setOpportunityStage('enquiry');
  }
  function chooseEnquiryDate(date: string) {
    if (enquiryDate === date) return;
    clearEnquirySlots();
    setEnquiryDate(date);
  }
  async function checkEnquiryAvailability() {
    const serviceId = enquiryServiceId(opportunitySelectedOffer);
    if (!serviceId || opportunityStage !== 'enquiry') return;
    const date = enquiryDate;
    const seq = ++enquirySlotsSeq.current;
    setEnquirySlotPage(null);
    setEnquirySelectedSlot(null);
    setEnquirySlotError('');
    setEnquirySlotLoading(true);
    setEnquiryReviewed(false);
    try {
      // Existing authenticated, read-only GET /bookings/slots. No hold or write.
      const page = await mobileApi.slots(token, serviceId, date);
      if (seq !== enquirySlotsSeq.current) return;
      if (page.date !== date) throw new Error('Availability response did not match the requested day.');
      setEnquirySlotPage(page);
    } catch (err) {
      if (seq === enquirySlotsSeq.current) setEnquirySlotError(
        err instanceof Error ? err.message : 'Availability is temporarily unavailable.'
      );
    } finally {
      if (seq === enquirySlotsSeq.current) setEnquirySlotLoading(false);
    }
  }
  function openOpportunity(item: SearchResult) {
    resetEnquiryDelivery();
    setOpportunitySource(item);
    setOpportunitySelectedOffer(item.kind === 'service' || item.kind === 'product' ? item : null);
    // This is just the currently returned published-result slice; it is NOT
    // represented as the provider's full catalogue or proof of post attachment.
    setOpportunityMatches(matchedPublishedOffers(searchResults, item));
    setEnquiryDraft('');
    clearEnquirySlots();
    setOpportunityStage('profile');
  }
  function closeOpportunity() {
    const status = enquiryDelivery.current.snapshot().status;
    if (['opening', 'sending', 'uncertain'].includes(status)) {
      Alert.alert('Leave this enquiry?', 'A message attempt may still arrive. Check the conversation before sending another enquiry.',
        [{ text: 'Stay', style: 'cancel' }, { text: 'Leave', onPress: dismissOpportunity }]);
      return;
    }
    dismissOpportunity();
  }
  function dismissOpportunity() {
    resetEnquiryDelivery();
    setOpportunityStage(null);
    setOpportunitySource(null);
    setOpportunitySelectedOffer(null);
    setOpportunityMatches([]);
    setEnquiryDraft('');
    clearEnquirySlots();
  }
  function confirmEnquiryMessage() {
    if (process.env.EXPO_PUBLIC_HUSTLE_ENABLE_ENQUIRY_MESSAGES !== 'true' || !enquiryReviewed) return;
    const message = prepareEnquiryMessage(opportunitySelectedOffer, enquiryDraft, enquirySlotPage, enquirySelectedSlot);
    if (!message) return;
    const attempt = enquiryDelivery.current;
    Alert.alert('Send enquiry as message?',
      'To ' + (opportunitySelectedOffer?.owner?.displayName || 'this service provider') + '\n\n' + message.text,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Send message', onPress: () => {
        if (attempt !== enquiryDelivery.current) return;
        // deliver locks synchronously before its first await, so double taps do
        // not create multiple POSTs. Never retry a message after uncertain delivery.
        const result = attempt.deliver(token, message);
        setEnquiryDeliveryState(attempt.snapshot());
        void result.then(state => {
          if (attempt === enquiryDelivery.current) setEnquiryDeliveryState(state);
        });
      } }]);
  }
  async function openEnquiryConversation() {
    const id = enquiryDeliveryState.conversationId;
    const serviceId = enquiryServiceId(opportunitySelectedOffer);
    const url = id && serviceId ? consultationWebLink(id, serviceId, process.env.EXPO_PUBLIC_PUBLIC_WEB_URL) : null;
    if (!url) return;
    try { await Linking.openURL(url); }
    catch { Alert.alert('Conversation unavailable', 'Could not open the conversation. Your enquiry has not been resent.'); }
  }
  async function openSearchResult(item: SearchResult) {
    const url = connectedSearchWebLink(item, process.env.EXPO_PUBLIC_PUBLIC_WEB_URL);
    if (!url) return;
    try { await Linking.openURL(url); }
    catch { Alert.alert('Public page unavailable', 'Could not open this Hustle page in your browser.'); }
  }
  async function openHustlerProfile(item: SearchResult) {
    const url = searchHustlerPublicLink(item, process.env.EXPO_PUBLIC_PUBLIC_WEB_URL);
    if (!url) return;
    try { await Linking.openURL(url); }
    catch { Alert.alert('Public profile unavailable', 'Could not open this Hustler profile in your browser.'); }
  }
  const opportunityHustler = opportunitySource ? getSearchHustler(opportunitySource) : null;
  const opportunityOffer = opportunitySelectedOffer ? currentSearchOffer(opportunitySelectedOffer) : null;
  const opportunityPublicProfile = opportunitySource
    ? searchHustlerPublicLink(opportunitySource, process.env.EXPO_PUBLIC_PUBLIC_WEB_URL) : null;
  const opportunityPublicOffer = opportunitySelectedOffer
    ? connectedSearchWebLink(opportunitySelectedOffer, process.env.EXPO_PUBLIC_PUBLIC_WEB_URL) : null;
  const enquiryAvailableSlots = currentEnquirySlots(enquirySlotPage);
  const enquirySlotTime = enquirySelectedSlot && enquirySlotPage
    ? enquirySlotLabel(enquirySelectedSlot.startAt, enquirySlotPage.timezone) : null;
  const enquiryCanSend = process.env.EXPO_PUBLIC_HUSTLE_ENABLE_ENQUIRY_MESSAGES === 'true';
  const enquiryAttemptStarted = !['idle', 'failed'].includes(enquiryDeliveryState.status);
  const enquiryConversationUrl = enquiryDeliveryState.conversationId && enquiryServiceId(opportunitySelectedOffer)
    ? consultationWebLink(enquiryDeliveryState.conversationId, enquiryServiceId(opportunitySelectedOffer)!, process.env.EXPO_PUBLIC_PUBLIC_WEB_URL) : null;
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
      <ScreenHeader title="Explore" subtitle="Find skills, people, services and products." eyebrow="DISCOVER WORK"/>
      <View style={styles.searchRow}><Icon name="search" color={C.dark} size={20} /><TextInput accessibilityLabel="Search Hustle" placeholder="Try 'tailor in Lagos'" placeholderTextColor={C.muted} style={styles.searchInput} value={searchText} onChangeText={editSearch} onSubmitEditing={() => void runSearch(searchText)} returnKeyType="search"/><Pressable accessibilityRole="button" accessibilityLabel="Search published Hustle records"
          onPress={() => void runSearch(searchText)} style={styles.searchSubmit}>
          <Icon name="arrow-forward" color={C.dark} size={20}/>
        </Pressable></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.searchTabStrip}
        contentContainerStyle={styles.searchTabContent}
        accessibilityLabel="Published search result types">
        {SEARCH_TABS.map(tab => <SkillChip key={tab.id} role="tab" label={tab.label + " search results"}
          active={searchTab === tab.id} onPress={() => chooseSearchTab(tab.id)} />)}
      </ScrollView>
      <ScrollView keyboardShouldPersistTaps="handled"><Text style={styles.sectionTitle}>Browse by skill</Text><View style={styles.chips}>{['Beauty','Fashion','Home','Media','Digital'].map(category => <SkillChip key={category} label={"Search skill " + category}
             onPress={() => void runSearch(category)}/>)}</View>
        <Text style={styles.sectionTitle}>Nearby discovery</Text><View style={styles.mapPlaceholder}><Icon name="map-outline" color="#354C38" size={34}/><Text style={styles.mapText}>Live map not connected</Text><Text style={styles.meta}>Search works now. Map pins require a location provider and verified coordinates.</Text></View>
        <Text style={styles.sectionTitle}>Search results</Text>
        {hasSearched && !searchLoading && !searchError && searchResults.length > 0 &&
          <Text style={styles.meta} accessibilityLiveRegion="polite">
            Showing {searchResults.length} published {searchTab === 'top' ? 'results' : searchTab}
            {searchHasMore ? ' · More available' : ''}
          </Text>}
        {searchLoading ? <ActivityIndicator accessibilityLabel="Searching published Hustle records" /> :
          searchError ? <View><Text style={styles.meta}>{searchError}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Retry Hustle search"
              onPress={() => void runSearch(searchText)} style={styles.searchRetry}>
              <Text style={styles.searchRetryText}>Retry search</Text>
            </Pressable></View> :
          searchResults.length ? searchResults.map(result => {
            const view = describeMobileSearchResult(result);
            const url = connectedSearchWebLink(result, process.env.EXPO_PUBLIC_PUBLIC_WEB_URL);
            return <Pressable key={result.kind + result.id} style={styles.resultCard}
              accessibilityRole="button" accessibilityLabel={"Review " + view.kindLabel + ": " + view.title}
              accessibilityHint="Opens the Hustler profile and published work preview inside Hustle"
              onPress={() => openOpportunity(result)}>
              <Icon name="sparkles-outline" color={C.dark}/>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultTitle} numberOfLines={2}>{view.title}</Text>
                <Text style={styles.meta} numberOfLines={2}>{view.kindLabel} · {view.detail}</Text>
                <Text style={styles.meta}>{url ? "Review · Public page available" : "Review in Hustle"}</Text>
              </View>
              <Icon name="chevron-forward" color={C.dark} size={20}/>
            </Pressable>;
          }) : <Text style={styles.meta}>
            {hasSearched ? "No published matches for this search. Try a different skill or name."
              : "Search for a skill or select a category to find published Hustlers."}
          </Text>}
        {Boolean(searchMoreError) && <Text style={styles.meta} accessibilityLiveRegion="polite">
          {searchMoreError}
        </Text>}
        {!searchLoading && !searchError && searchHasMore && searchResults.length > 0 &&
          <Pressable accessibilityRole="button" accessibilityLabel={searchMoreError ? "Retry loading more search results" : "Load more search results"}
            disabled={searchMoreLoading}
            onPress={() => void loadSearchMore()} style={styles.searchLoadMore}>
            {searchMoreLoading ? <ActivityIndicator color={C.dark}/> :
              <Text style={styles.searchLoadMoreText}>{searchMoreError ? "Retry more results" : "Load more results"}</Text>}
          </Pressable>}
        </ScrollView>
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
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetKeyboard}>
          <ScrollView style={styles.sheet} nestedScrollEnabled keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
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
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
    <Modal visible={opportunityStage !== null} transparent animationType="slide"
      onRequestClose={closeOpportunity}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.scrim} accessibilityRole="button"
          accessibilityLabel="Dismiss Hustler preview" onPress={closeOpportunity}/>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <SheetTitle title={opportunityStage === 'profile' ? 'Hustler profile'
              : opportunityStage === 'offer' ? 'Published offer' : 'Service enquiry'}
              onClose={closeOpportunity}/>
            {opportunitySource && opportunityHustler && <ScrollView
              style={{ maxHeight: 430 }} keyboardShouldPersistTaps="handled">
              {opportunityStage === 'profile' && <>
                <Text style={styles.resultTitle}>{opportunityHustler.name}</Text>
                {opportunityHustler.username && <Text style={styles.meta}>@{opportunityHustler.username}</Text>}
                <Text style={styles.meta}>{[
                  opportunityHustler.skill, opportunityHustler.headline, opportunityHustler.location
                ].filter(Boolean).join(' · ') || 'Published Hustler profile'}</Text>
                {opportunityHustler.summary && <Text style={styles.opportunityDescription}>{opportunityHustler.summary}</Text>}
                {opportunityHustler.contactVerified !== null && <Text style={styles.meta}>
                  {opportunityHustler.contactVerified ? 'Contact verification recorded'
                    : 'Contact verification not recorded'}
                </Text>}
                {opportunitySource.kind === 'post' && <View style={styles.opportunitySection}>
                  <Text style={styles.resultTitle}>Work that brought you here</Text>
                  <Text style={styles.opportunityDescription}>{opportunitySource.post?.caption || 'Published work'}</Text>
                </View>}
                <Text style={styles.opportunitySectionTitle}>Published offers in these search results</Text>
                {opportunityMatches.length ? opportunityMatches.map(offerResult => {
                  const offer = currentSearchOffer(offerResult);
                  return <Pressable key={offerResult.kind + ':' + offerResult.id}
                    accessibilityRole="button" accessibilityLabel={"Review " + offerResult.kind + ": " + (offer?.title || 'Published offer')}
                    onPress={() => { setOpportunitySelectedOffer(offerResult); setOpportunityStage('offer'); }}
                    style={styles.opportunityItem}>
                    <Text style={styles.resultTitle}>{offer?.title || 'Published offer'}</Text>
                    <Text style={styles.meta}>
                      {offerResult.kind === 'service' ? 'Service' : 'Product'} · {offer ? formatPrice(offer) : 'Price unavailable'}
                    </Text>
                  </Pressable>;
                }) : <Text style={styles.meta}>
                  No offers were included in these search results. This does not mean the Hustler has none.
                </Text>}
                <Action secondary disabled={!opportunityPublicProfile}
                  onPress={() => void openHustlerProfile(opportunitySource)}>
                  {opportunityPublicProfile ? 'View full public profile ↗' : 'Public profile link unavailable'}
                </Action>
              </>}
              {opportunityStage === 'offer' && <>
                <Text style={styles.resultTitle}>{opportunityOffer?.title || 'Published offer unavailable'}</Text>
                <Text style={styles.meta}>By {opportunityHustler.name}</Text>
                {opportunityOffer && <Text style={styles.price}>{formatPrice(opportunityOffer)}</Text>}
                {opportunityOffer?.description && <Text style={styles.opportunityDescription}>
                  {opportunityOffer.description}
                </Text>}
                <Text style={styles.meta}>
                  {opportunitySelectedOffer?.kind === 'service'
                    ? 'Published service information. Availability and final booking terms are not confirmed.'
                    : 'Product stock, variants and checkout are not confirmed in this mobile preview.'}
                </Text>
                <Action secondary onPress={() => setOpportunityStage('profile')}>Back to Hustler profile</Action>
                {opportunitySelectedOffer?.kind === 'service' && opportunityOffer && <Action
                  onPress={startEnquiryPreview}>
                  Prepare a booking enquiry
                </Action>}
                <Action secondary disabled={!opportunityPublicOffer} onPress={() => {
                  if (opportunitySelectedOffer) void openSearchResult(opportunitySelectedOffer);
                }}>{opportunityPublicOffer ? 'View full public offer ↗' : 'Public offer link unavailable'}</Action>
              </>}
              {opportunityStage === 'enquiry' && opportunitySelectedOffer?.kind === 'service' && <>
                <Text style={styles.resultTitle}>{opportunityOffer?.title || 'Service enquiry'}</Text>
                <Text style={styles.meta}>For {opportunityHustler.name}</Text>
                <Text style={styles.opportunityDescription}>
                  Describe what you need. Review first; nothing is sent until you confirm Send message.
                  This enquiry does not book, reserve or charge anything.
                </Text>
                <Text style={styles.opportunitySectionTitle}>Check published service availability</Text>
                <Text style={styles.meta}>
                  Times come from Hustle's authenticated schedule service when checked.
                  Displayed times can change and are not reserved.
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  style={{ flexGrow: 0, marginTop: 8 }}>
                  {enquiryNextDays().map(date => <Pressable key={date}
                    disabled={enquiryAttemptStarted}
                    accessibilityRole="button" accessibilityState={{ selected: enquiryDate === date }}
                    accessibilityLabel={"Choose calendar day " + date}
                    onPress={() => chooseEnquiryDate(date)}
                    style={[styles.dateChoice, enquiryDate === date && styles.selectedDate]}>
                    <Text style={[styles.chipText, enquiryDate === date && { color: C.white }]}>
                      {date.slice(5)}
                    </Text>
                  </Pressable>)}
                </ScrollView>
                <Action secondary disabled={enquiryAttemptStarted || enquirySlotLoading || !enquiryServiceId(opportunitySelectedOffer)}
                  onPress={() => void checkEnquiryAvailability()}>
                  {enquirySlotLoading ? 'Checking schedule…' : enquirySlotPage ? 'Refresh available times' : 'Check available times'}
                </Action>
                {!enquiryServiceId(opportunitySelectedOffer) && <Text style={styles.meta}>
                  This service record has no matching canonical ID, so its schedule cannot be checked.
                </Text>}
                {enquirySlotLoading && <ActivityIndicator accessibilityLabel="Checking service appointment times"/>}
                {Boolean(enquirySlotError) && <Text style={styles.meta} accessibilityLiveRegion="polite">
                  Could not check available times: {enquirySlotError}. Try again.
                </Text>}
                {enquirySlotPage?.mode === 'APPOINTMENT' && <>
                  <Text style={styles.meta}>
                    {enquiryAvailableSlots.length
                      ? "Listed appointment starts · " + enquirySlotPage.timezone + " · not reserved"
                      : "No available appointment starts were returned for this day."}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    style={{ flexGrow: 0, marginTop: 8 }}>
                    {enquiryAvailableSlots.map(slot => {
                      const label = enquirySlotLabel(slot.startAt, enquirySlotPage.timezone);
                      return label ? <Pressable key={slot.startAt}
                        disabled={enquiryAttemptStarted}
                        accessibilityRole="button"
                        accessibilityState={{ selected: enquirySelectedSlot?.startAt === slot.startAt }}
                        accessibilityLabel={"Prefer " + label + ", not reserved"}
                        onPress={() => { setEnquirySelectedSlot(slot); setEnquiryReviewed(false); }}
                        style={[styles.dateChoice, enquirySelectedSlot?.startAt === slot.startAt && styles.selectedDate]}>
                        <Text style={[styles.chipText, enquirySelectedSlot?.startAt === slot.startAt && { color: C.white }]}>
                          {label}
                        </Text>
                      </Pressable> : null;
                    })}
                  </ScrollView>
                </>}
                {enquirySlotPage && enquirySlotPage.mode !== 'APPOINTMENT' && <Text style={styles.meta}>
                  {enquirySlotPage.mode === 'WORK_QUEUE'
                    ? 'This service uses a work queue, not appointment slots.'
                    : enquirySlotPage.mode === 'CONSULTATION'
                      ? 'This service uses consultation scheduling, not public appointment slots.'
                      : 'This service does not publish appointment slots through this endpoint.'}
                </Text>}
                <TextInput accessibilityLabel="Describe your booking enquiry"
                  editable={!enquiryAttemptStarted}
                  multiline maxLength={1200} style={styles.requirements}
                  placeholder="What service do you need, and when would you prefer?"
                  value={enquiryDraft} onChangeText={value => {
                    setEnquiryDraft(value); setEnquiryReviewed(false);
                  }}/>
                <Action disabled={!enquiryDraft.trim()} onPress={() => setEnquiryReviewed(true)}>
                  Review enquiry draft
                </Action>
                {enquiryReviewed && <View style={styles.opportunitySection}
                  accessibilityLiveRegion="polite">
                  <Text style={styles.resultTitle}>{enquiryAttemptStarted ? 'Enquiry message review' : 'Enquiry prepared — not sent'}</Text>
                  <Text style={styles.opportunityDescription}>{enquiryDraft.trim()}</Text>
                  <Text style={styles.meta}>
                    {enquirySlotTime
                      ? 'Preferred appointment: ' + enquiryDate + ', ' + enquirySlotTime + ' (not reserved)'
                      : 'No confirmed appointment time selected; scheduling must be agreed with the provider.'}
                  </Text>
                  <Text style={styles.meta}>
                    {enquiryAttemptStarted ? 'See delivery status below. Do not send another copy until you check the conversation.'
                      : 'No provider has received this enquiry. Sending a message is separate from requesting a booking.'}
                  </Text>
                  {!enquiryAttemptStarted && <Action disabled={!enquiryCanSend || !prepareEnquiryMessage(
                    opportunitySelectedOffer, enquiryDraft, enquirySlotPage, enquirySelectedSlot)}
                    onPress={confirmEnquiryMessage}>Send enquiry as message</Action>}
                  {!enquiryCanSend && <Text style={styles.meta}>Message sending is disabled in this build. Your draft stays on this screen.</Text>}
                </View>}
                {enquiryDeliveryState.status !== 'idle' && <View style={styles.opportunitySection} accessibilityLiveRegion="polite">
                  <Text style={styles.resultTitle}>{enquiryDeliveryState.status === 'sent'
                    ? 'Enquiry sent as a message — not booked'
                    : enquiryDeliveryState.status === 'uncertain' ? 'Delivery uncertain — check the conversation'
                      : enquiryDeliveryState.status === 'failed' ? 'Conversation could not open — no message attempted'
                        : 'Sending enquiry…'}</Text>
                  <Text style={styles.meta}>{enquiryDeliveryState.status === 'sent'
                    ? 'Hustle acknowledged your message. This does not mean the provider has read or accepted it. No appointment is reserved.'
                    : enquiryDeliveryState.status === 'uncertain'
                      ? 'The message may have arrived. It will not be resent automatically. Check the conversation before preparing another enquiry.'
                      : 'Your draft stays here. No booking or payment is created.'}</Text>
                  {enquiryConversationUrl && <Action secondary onPress={() => void openEnquiryConversation()}>
                    Open conversation in browser ↗
                  </Action>}
                  {enquiryConversationUrl && <Text style={styles.meta}>Browser sign-in is separate. Continue the consultation there; booking remains a separate request.</Text>}
                </View>}
                <Action secondary disabled={enquiryAttemptStarted}
                  onPress={() => { clearEnquirySlots(); setOpportunityStage('offer'); }}>Back to service</Action>
              </>}
            </ScrollView>}
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
    {ready ? <Experience key={props.session.user.id} {...props} /> : <View style={styles.emptyDark}>
      {error ? <><Text style={styles.emptyHeading}>Unable to prepare your Hustle account</Text>
        <Text style={styles.emptyBody}>{error}</Text>
        <Action onPress={() => setRetry(n => n + 1)}>Try again</Action>
        <Action secondary onPress={() => void props.onSignOut()}>Sign out</Action></>
        : <><ActivityIndicator color={C.lime} /><Text style={styles.emptyBody}>Preparing your Hustle identity…</Text></>}
    </View>}
  </SafeAreaProvider>;
}
const styles = StyleSheet.create({
  post: { backgroundColor: C.dark, width: '100%' }, mediaUnavailable: { flex: 1, backgroundColor: colors.darkCard, justifyContent: 'center', alignItems: 'center', gap: 16 },
  mediaUnavailableText: { color: C.white, fontSize: 12 }, mediaShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,10,5,.23)' },
  topBar: { position: 'absolute', left: 22, right: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: C.white, fontWeight: '900', fontSize: 24 }, feedTabs: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', justifyContent: 'center' },
  feedTab: { paddingHorizontal: 9, paddingBottom: 8 }, feedTabActive: { borderBottomWidth: 2, borderBottomColor: C.lime },
  feedTabText: { fontSize: 14, fontWeight: '700', color: colors.textSecondaryDark }, sideRail: { position: 'absolute', right: 12, gap: 14 },
  railButton: { width: 55, alignItems: 'center' }, railCount: { color: C.white, fontSize: 11, fontWeight: '800' },
  postBottom: { position: 'absolute', left: 20, right: 85 }, creator: { fontSize: 16, fontWeight: '800', color: C.white },
  caption: { color: C.white, fontSize: 14, marginTop: 9, lineHeight: 20 }, audio: { color: '#E5ECE4', fontSize: 11, marginTop: 8 },
  attached: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.darkCard, marginTop: 16, padding: 12, borderRadius: 16 },
  offer: { fontWeight: '800', color: C.white, fontSize: 13 }, offerPrice: { fontSize: 11, color: colors.textSecondaryDark, marginTop: 4 },
  nav: { position: 'absolute', left: 18, right: 18, height: layout.navVisualHeight, backgroundColor: C.dark, borderRadius: radii.pill, paddingHorizontal: 8, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  navItem: { width: 52, minHeight: layout.minTapTarget, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' }, navSelected: { backgroundColor: C.lime },
  lightPage: { flex: 1, backgroundColor: C.paper, paddingHorizontal: spacing.lg }, pageTitle: { fontSize: 29, fontWeight: '900', color: C.dark },
  subline: { color: C.muted, marginTop: 8, marginBottom: 18 }, searchRow: { minHeight: 51, backgroundColor: C.white, paddingHorizontal: spacing.md, borderRadius: 16, flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, marginLeft: 8, color: C.dark },
  searchSubmit: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  searchRetry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  searchRetryText: { fontWeight: '800', color: C.dark },
  searchTabStrip: { flexGrow: 0, marginTop: 10 },
  searchTabContent: { paddingRight: 8, alignItems: 'center', gap: 8 },
  searchTabChoice: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 15,
    backgroundColor: C.white, borderRadius: 14 },
  searchTabChoiceActive: { backgroundColor: C.dark },
  searchTabLabel: { fontSize: 13, fontWeight: '800', color: C.dark },
  searchTabLabelActive: { color: C.white },
  searchLoadMore: { minHeight: 48, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.raised, borderRadius: 14, marginTop: 12 },
  searchLoadMoreText: { color: C.dark, fontSize: 14, fontWeight: '800' },
  sectionTitle: { fontSize: 19, fontWeight: '800', marginVertical: 20, color: C.dark },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, chip: { backgroundColor: colors.raised, padding: 14, borderRadius: 16 },
  chipText: { fontSize: 13, fontWeight: '800', color: C.dark }, mapPlaceholder: { height: 160, backgroundColor: colors.raised, borderRadius: 18, justifyContent: 'center', alignItems: 'center', gap: 6, padding: 16 },
  mapText: { fontWeight: '800', color: colors.ink }, meta: { fontSize: 12, color: C.muted, lineHeight: 18, marginTop: 9 },
  resultCard: { backgroundColor: C.white, borderRadius: radii.card, padding: spacing.md, marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  resultTitle: { fontWeight: '800', color: C.dark, fontSize: 15, flexShrink: 1 }, emptyDark: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 35, backgroundColor: C.dark },
  emptyHeading: { fontSize: 23, fontWeight: '800', color: C.white, textAlign: 'center', marginTop: 12 },
  emptyBody: { color: '#DCE4D8', textAlign: 'center', marginTop: 12, lineHeight: 22 }, errorSmall: { color: C.white, textAlign: 'center', margin: 20 },
  sheetKeyboard: { width: '100%', maxHeight: '90%', flexShrink: 1 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' }, scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,.55)' },
  sheet: { backgroundColor: C.paper, borderTopLeftRadius: radii.large, borderTopRightRadius: radii.large,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, maxHeight: '100%' },
  handle: { width: 65, height: 5, backgroundColor: colors.line, borderRadius: 3, alignSelf: 'center', marginBottom: 19 },
  sheetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 17 }, sheetTitle: { fontSize: 21, fontWeight: '800', color: C.dark },
  action: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.lime, padding: 17, marginTop: 19, borderRadius: 20 },
  actionText: { fontWeight: '800', fontSize: 15, color: C.dark }, secondaryAction: { backgroundColor: C.card }, avatar: { backgroundColor: colors.raised, width: 37, height: 37, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  comment: { flexDirection: 'row', gap: 12, paddingVertical: 9 }, commentBody: { color: C.dark, fontSize: 14, marginTop: 4 },
  composer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.raised, borderRadius: 25, paddingHorizontal: 16, marginTop: 14 },
  price: { fontSize: 22, fontWeight: '900', marginVertical: 12, color: C.dark }, dateChoice: { padding: 13, borderRadius: 13, backgroundColor: colors.raised, marginRight: 9 },
  selectedDate: { backgroundColor: C.dark },
  opportunitySection: { padding: 14, backgroundColor: C.white, borderRadius: 16, marginTop: 12 },
  opportunitySectionTitle: { color: C.dark, fontWeight: '800', fontSize: 15, marginTop: 16 },
  opportunityItem: { minHeight: 48, backgroundColor: C.white, borderRadius: 14,
    padding: 14, marginTop: 9, justifyContent: 'center' },
  opportunityDescription: { color: C.dark, fontSize: 14, lineHeight: 21, marginTop: 12 },
  requirements: { backgroundColor: C.white, minHeight: 74, marginTop: 8, padding: 13, borderRadius: 14, color: C.dark, textAlignVertical: 'top' }
});
