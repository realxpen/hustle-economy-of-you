/**
 * Hustle Offline Demo — zero API calls, Supabase sessions, database writes,
 * checkout, payments, or live media. Every creator and offer is fictional.
 *
 * This experience is opt-in ONLY for the dedicated Expo "demo" build profile.
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert, FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, Share, StatusBar, StyleSheet, Text, TextInput,
  useWindowDimensions, View
} from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radii, layout } from "../ux004/theme";
import { AppIcon, type AppIconName } from "../ux004/components/AppIcon";
import { HybridScreenSurface } from "../ux004/components/HybridScreenSurface";
import { TactilePressable } from "../ux004/components/TactilePressable";
import { DemoDisclosure } from "../ux004/components/DemoDisclosure";
import { FloatingTabBar } from "../ux004/components/FloatingTabBar";
import { useDemoNavigation } from "../ux004/navigation/useDemoNavigation";
import { useDemoAndroidBack } from "../ux004/navigation/useDemoAndroidBack";
import type { RootTab } from "../ux004/navigation/types";
import { orderDemoComments, replyRootId, selectSavedPosts } from "../ux004/feed/demoSocial";
import type { DemoComment, DemoCollection } from "../ux004/feed/demoSocial";
import { FeedOfferAttachment } from "../ux004/feed/FeedOfferAttachment";
import { findDemoWorkIndex } from "../ux004/discovery/demoWorkRoute";
import { filterDemoExplorePosts } from "../ux004/discovery/demoExploreSearch";

// Legacy local names map to approved UX004 semantic tokens. The full feed
// layout/navigation upgrade happens in separate A1.2/A2 review slices.
const C = {
  ink: colors.ink, lime: colors.lime, cream: colors.paper,
  white: colors.surface, muted: colors.textSecondaryLight,
  charcoal: colors.charcoal,
};
type IconName = AppIconName;
type Sheet = "comments" | "save" | "share" | "creator" | "offer" | "booking" | null;
type Collection = DemoCollection;
type Offer = { kind: "service" | "product"; title: string; price: string; detail: string };
type Post = {
  id: string; handle: string; name: string; profession: string; place: string;
  category: string; caption: string; headline: string; slogan: string; icon: string;
  bg: string; accent: string; likes: number; offer: Offer;
};
type Comment = DemoComment;

const POSTS: Post[] = [
  { id: "p1", handle: "mira.stitches", name: "Mira Styles", profession: "Fashion designer",
    place: "Lekki, Lagos", category: "Fashion", caption: "A custom two-piece outfit, from sketch to finishing touches. Which colour would you pick?",
    headline: "MADE TO", slogan: "fit your story.", icon: "🧵", bg: "#685A59", accent: "#E8C6B1",
    likes: 284, offer: { kind: "service", title: "Custom outfit & fitting", price: "From ₦18,000", detail: "Bespoke outfit consultation and fitting · Sample listing" } },
  { id: "p2", handle: "tunde.cuts", name: "Tunde Cuts", profession: "Barber",
    place: "Yaba, Lagos", category: "Beauty", caption: "Nothing like a sharp fade before the weekend. Here's the transformation.",
    headline: "FRESH", slogan: "every angle.", icon: "💈", bg: "#31483F", accent: "#D2E4A6",
    likes: 629, offer: { kind: "service", title: "Premium haircut", price: "From ₦5,000", detail: "Haircut, wash and styling · Sample listing" } },
  { id: "p3", handle: "chef.amara", name: "Chef Amara", profession: "Private chef",
    place: "Ikeja, Lagos", category: "Food", caption: "A celebration deserves food everyone remembers. Behind the scenes of a small-event menu.",
    headline: "GOOD FOOD.", slogan: "Great company.", icon: "🍲", bg: "#8B563A", accent: "#EBC49A",
    likes: 187, offer: { kind: "product", title: "Signature spice set", price: "₦8,500", detail: "Curated spice kit for home cooks · Sample listing" } },
  { id: "p4", handle: "kemi.frames", name: "Kemi Frames", profession: "Photographer",
    place: "Surulere, Lagos", category: "Media", caption: "A portrait session is more than a camera and a pose. Let's make memories.",
    headline: "FRAME", slogan: "the feeling.", icon: "📸", bg: "#49516B", accent: "#D0CEEA",
    likes: 403, offer: { kind: "service", title: "Portrait photoshoot", price: "From ₦25,000", detail: "Portrait session, edits and delivery · Sample listing" } }
];
const INITIAL_COMMENTS: Record<string, Comment[]> = {
  p1: [{ id: "c1", handle: "ayo_designs", body: "The finishing is so clean! 👏" },
    { id: "c2", handle: "mira.stitches", body: "Thank you! ✨", parentId: "c1" }],
  p2: [{ id: "c3", handle: "jimi", body: "That fade is crisp!" }],
  p3: [{ id: "c4", handle: "nene", body: "This looks delicious 😍" }],
  p4: []
};
const DEMO_BANNER = "INTERACTIVE DEMO · FICTIONAL CONTENT";
function I({ name, color = "#fff", size = 24 }: { name: IconName; color?: string; size?: number }) {
  return <AppIcon name={name} color={color} size={size} />;
}
function Button({ title, onPress, outline = false }: { title: string; onPress: () => void; outline?: boolean }) {
  return <TactilePressable accessibilityLabel={title} onPress={onPress}
    style={[styles.button, outline && { backgroundColor: "#E8EDE4" }]}>
    <Text style={[styles.buttonText, outline && { color: C.ink }]}>{title}</Text>
  </TactilePressable>;
}
function Experience() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { activeTab: screen, selectTab: setScreen } = useDemoNavigation();
  const [feed, setFeed] = useState<"For You" | "Nearby">("For You");
  const [index, setIndex] = useState(0);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [chosenPost, setChosenPost] = useState(POSTS[0].id);
  const [likes, setLikes] = useState<string[]>([]);
  const [expandedCaptions, setExpandedCaptions] = useState<string[]>([]);
  const lastArtworkTap = useRef<{ postId: string; timestamp: number } | null>(null);
  const [follows, setFollows] = useState<string[]>([]);
  const [saves, setSaves] = useState<Record<string, Collection[]>>({});
  const [comments, setComments] = useState<Record<string, Comment[]>>(INITIAL_COMMENTS);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [exploreSavedOnly, setExploreSavedOnly] = useState(false);
  const [exploreSavedCollection, setExploreSavedCollection] = useState<Collection | null>(null);
  const [selectedTime, setSelectedTime] = useState("11:00 AM");
  const [savedOnly, setSavedOnly] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  // The true FlatList viewport can differ from useWindowDimensions height,
  // especially in landscape letterboxing / Android edge-to-edge mode.
  const [feedViewportHeight, setFeedViewportHeight] = useState(0);
  const regularFeedIndex = useRef(0);
  const bottomReserve = layout.navVisualHeight +
    Math.max(insets.bottom, layout.navBottomGap) + layout.navContentGap;
  const pageHeight = feedViewportHeight || height;

  // Only explicit tab navigation leaves the saved-feed view. Switching tabs
  // keeps the normal Feed position, Explorer query, category and engagement.
  const selectRootTab = useCallback((destination: RootTab) => {
    if (destination === screen) return;
    setSheet(null);
    if (savedOnly) {
      setSavedOnly(false);
      setSelectedCollection(null);
      setIndex(regularFeedIndex.current);
    }
    setScreen(destination);
  }, [screen, savedOnly, setScreen]);
  const goHome = useCallback(() => selectRootTab("Home"), [selectRootTab]);
  const { keyboardVisible } = useDemoAndroidBack({
    activeTab: screen,
    sheetOpen: sheet !== null,
    onNavigateHome: goHome,
  });
  const openSavedCollection = (collection: Collection) => {
    if (!savedOnly) regularFeedIndex.current = index;
    setSelectedCollection(collection);
    setSavedOnly(true);
    setIndex(0);
    setSheet(null);
    setScreen("Home");
  };
  const returnToForYou = () => {
    setSavedOnly(false);
    setSelectedCollection(null);
    setIndex(regularFeedIndex.current);
  };
  const current = POSTS.find(p => p.id === chosenPost) || POSTS[0];
  const visibleFeed = savedOnly ? selectSavedPosts(POSTS, saves, selectedCollection) : POSTS;
  const currentComments = comments[current.id] || [];
  const orderedComments = orderDemoComments(currentComments);
  const replyTarget = currentComments.find(note => note.id === replyTo);
  const savedCollectionsForPost = saves[current.id] || [];
  const explore = useMemo(() => filterDemoExplorePosts(POSTS, search, category), [category, search]);
  // Saved-only mode intersects the existing category/text search; both use
  // the same in-memory per-post collections as Feed and the You tab.
  const visibleExplore = useMemo(() => exploreSavedOnly
    ? selectSavedPosts(explore, saves, exploreSavedCollection) : explore,
    [explore, saves, exploreSavedOnly, exploreSavedCollection]);
  const exploreSavedCount = useMemo(() => selectSavedPosts(POSTS, saves, null).length, [saves]);
  const hasExploreFilters = Boolean(search.trim()) || category !== "All" || exploreSavedOnly;
  function resetExploreFilters() {
    setSearch("");
    setCategory("All");
    setExploreSavedOnly(false);
    setExploreSavedCollection(null);
  }

  function open(type: Sheet, post: Post) {
    setChosenPost(post.id); setSheet(type);
    if (type === "comments") { setCommentText(""); setReplyTo(null); }
  }
  // The Explore result opens its matching fictional proof-of-work post.
  // Home is unmounted while Explore is shown, so initialScrollIndex
  // selects the target without an imperative scroll or a new Feed key.
  function openWorkInFeed(postId: string) {
    const target = findDemoWorkIndex(POSTS, postId);
    if (target === null) return;
    regularFeedIndex.current = target;
    setIndex(target);
    setSavedOnly(false);
    setSelectedCollection(null);
    setSheet(null);
    setFeed("For You");
    setScreen("Home");
  }
  function toggleLike(id: string) {
    setLikes(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id]);
  }
  // The fictional artwork has no video playback. Single tap stays inert; a
  // second tap on the SAME post within 300 ms only ADDS a like (never unlikes).
  // No timer, player, backend, permission request or global gesture handler.
  function onArtworkTap(postId: string) {
    const timestamp = Date.now();
    const previous = lastArtworkTap.current;
    if (previous?.postId === postId && timestamp - previous.timestamp > 0 &&
        timestamp - previous.timestamp <= 300) {
      setLikes(previousLikes => previousLikes.includes(postId) ? previousLikes : [...previousLikes, postId]);
      lastArtworkTap.current = null;
      return;
    }
    lastArtworkTap.current = { postId, timestamp };
  }
  function toggleCaption(id: string) {
    setExpandedCaptions(old => old.includes(id) ? old.filter(value => value !== id) : [...old, id]);
  }
  function toggleSave(id: string, collection: Collection) {
    setSaves(old => {
      const current = old[id] || [];
      const next = current.includes(collection) ? current.filter(x => x !== collection) : [...current, collection];
      return { ...old, [id]: next };
    });
  }
  function addComment() {
    const text = commentText.trim();
    if (!text) return;
    const note: Comment = { id: "demo-" + Date.now().toString(), handle: "you.demo",
      body: text, ...(replyTo ? { parentId: replyTo } : {}) };
    setComments(old => ({ ...old, [current.id]: [...(old[current.id] || []), note] }));
    setCommentText(""); setReplyTo(null);
  }
  const share = async () => {
    try { await Share.share({ message:
      "Hustle interactive demo · " + current.name + " · " + current.offer.title +
      "\nSample content only. No real booking or purchase is available." }); }
    catch { Alert.alert("Sharing unavailable", "Try again later."); }
  };
  const heart = (post: Post) => likes.includes(post.id);
  function rail(name: IconName, label: string, press: () => void, enabled = false, accessibleLabel = label) {
    return <Pressable accessibilityRole="button" accessibilityLabel={accessibleLabel}
      onPress={press} style={styles.railItem}>
      <I name={name} size={29} color={enabled ? C.lime : C.white} />
      <Text style={styles.railCaption}>{label}</Text>
    </Pressable>;
  }
  function feedCard(post: Post, cardIndex: number) {
    const spotlight = cardIndex === index;
    return <View style={[styles.feedCard, { height: pageHeight }]} key={post.id}>
      <View style={[styles.poster, { backgroundColor: post.bg }]}>
        <View style={[styles.halo, { backgroundColor: post.accent }]} />
        <View style={[styles.haloSmall, { backgroundColor: post.accent }]} />
        <Text style={styles.posterSymbol}>{post.icon}</Text>
        <View style={[styles.posterType, { top: insets.top + 164 }]}>
          <Text style={styles.posterHeadline}>{post.headline}</Text>
          <Text style={styles.posterSlogan}>{post.slogan}</Text>
          <Text style={styles.posterFoot}>ILLUSTRATED DEMO · {post.category.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.posterShade} pointerEvents="none" />
      <Pressable style={styles.artworkTapTarget} onPress={() => onArtworkTap(post.id)}
        accessible={false} importantForAccessibility="no"
        testID={"demo-artwork-" + post.id} />
      <View style={[styles.topRow, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.wordmark}>hustle<Text style={{ color: C.lime }}>.</Text></Text>
        <Pressable onPress={() => selectRootTab("Explore")} accessibilityLabel="Explore skills">
          <I name="search-outline" size={27} />
        </Pressable>
      </View>
      <View style={[styles.feedTabs, { top: insets.top + 65 }]}>
        <Pressable onPress={() => Alert.alert("Live demo", "Livestreaming is not enabled in this offline preview.")}>
          <Text style={styles.feedTabMuted}>LIVE</Text>
        </Pressable>
        {(["For You", "Nearby"] as const).map(label =>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: feed === label }} key={label}
            onPress={() => setFeed(label)} style={[styles.feedTab, feed === label && styles.feedTabActive]}>
            <Text style={[styles.feedTabText, feed === label && { color: C.white }]}>{label}</Text>
          </Pressable>
        )}
      </View>
      <DemoDisclosure compact label={DEMO_BANNER}
        style={[styles.demoChip, { top: insets.top + 113 }]} />
      <View style={[styles.rail, { bottom: bottomReserve + 120 }]}>
        {rail("person-circle-outline", "Creator", () => open("creator", post))}
        {rail(heart(post) ? "heart" : "heart-outline", String(post.likes + (heart(post) ? 1 : 0)),
          () => toggleLike(post.id), heart(post),
          (heart(post) ? "Unlike " : "Like ") + post.name + " work")}
        {rail("chatbubble-outline", String((comments[post.id] || []).length),
          () => open("comments", post), false, "Read comments on " + post.name + " work")}
        {rail((saves[post.id] || []).length ? "bookmark" : "bookmark-outline", "Save",
          () => open("save", post), (saves[post.id] || []).length > 0,
          "Manage collections for " + post.name + " work")}
        {rail("arrow-redo-outline", "Share", () => open("share", post), false,
          "Share fictional work from " + post.name)}
      </View>
      <View style={[styles.feedBottom, { bottom: bottomReserve }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={"Open " + post.name + " fictional creator"}
          onPress={() => open("creator", post)}>
          <Text style={styles.creatorName}>@{post.handle} <Text style={{ color: C.lime }}>↗</Text></Text>
        </Pressable>
        <Pressable accessibilityRole="button"
          accessibilityLabel={(expandedCaptions.includes(post.id) ? "Collapse" : "Expand") + " caption by " + post.name}
          onPress={() => toggleCaption(post.id)} style={styles.captionTapTarget}>
          <Text style={styles.caption} numberOfLines={expandedCaptions.includes(post.id) ? undefined : 2}>{post.caption}</Text>
          <Text style={styles.captionMore}>{expandedCaptions.includes(post.id) ? "Show less" : "Read more"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={"View skill and sample location for " + post.name}
          onPress={() => open("creator", post)}>
          <Text style={styles.specialty}>{post.profession} · {post.place}</Text>
        </Pressable>
        <FeedOfferAttachment kind={post.offer.kind} title={post.offer.title}
          price={post.offer.price} creatorName={post.name}
          onPress={() => open("offer", post)} />
        <Text style={styles.mediaDisclosure}>{spotlight ? "Swipe up to discover more · " : ""}Illustrated sample, not real video</Text>
      </View>
    </View>;
  }

  const close = () => setSheet(null);
  // RN Modal owns Android Back while visible. A first Back hides the keyboard;
  // a second closes the sheet, preserving the comment draft and current post.
  const requestDismissSheet = () => {
    if (Keyboard.isVisible() || keyboardVisible) {
      Keyboard.dismiss();
      return;
    }
    close();
  };
  return <HybridScreenSurface mode={screen === "Home" ? "darkFeed" : "lightUtility"} style={styles.root}>
    <StatusBar barStyle={screen === "Home" ? "light-content" : "dark-content"} />
    {screen === "Home" ? <FlatList
      style={styles.feedList}
      onLayout={event => {
        const nextHeight = Math.round(event.nativeEvent.layout.height);
        if (nextHeight > 0) setFeedViewportHeight(prev => prev === nextHeight ? prev : nextHeight);
      }}
      key={`${savedOnly ? "saved-" + selectedCollection : feed}:${Math.round(pageHeight)}`}
      data={visibleFeed} keyExtractor={p => p.id}
      initialScrollIndex={Math.min(index, Math.max(0, visibleFeed.length - 1))}
      renderItem={({ item, index: i }) => feedCard(item, i)}
      pagingEnabled decelerationRate="fast" showsVerticalScrollIndicator={false}
      getItemLayout={(_, i) => ({ length: pageHeight, offset: pageHeight * i, index: i })}
      onMomentumScrollEnd={event => {
        const next = Math.max(0, Math.round(event.nativeEvent.contentOffset.y / pageHeight));
        setIndex(next);
        if (!savedOnly) regularFeedIndex.current = next;
      }}
      ListEmptyComponent={<View style={styles.emptyDark}>
        <I name="bookmark-outline" size={40}/>
        <Text style={styles.whiteTitle}>
          {selectedCollection ? "No posts in " + selectedCollection + " yet" : "Your saved feed is empty"}
        </Text>
        <Button title="Return to For You" onPress={returnToForYou} />
      </View>} />
    : screen === "Explore" ? <View style={[styles.lightPage, { paddingTop: insets.top + 18 }]}>
      <Text style={styles.pageTitle}>Explore</Text>
      <Text style={styles.subtitle}>Find great work, not just listings.</Text>
      <View style={styles.searchBar}><I name="search-outline" color={C.ink} size={21}/>
        <TextInput value={search} onChangeText={setSearch}
          placeholder="Search skills, work, people..." placeholderTextColor="#89948A"
          style={styles.searchField} accessibilityLabel="Search fictional work and professionals"
          returnKeyType="search" />
        {Boolean(search) && <Pressable accessibilityRole="button" accessibilityLabel="Clear Explore search"
          onPress={() => setSearch("")} style={styles.searchClearTarget}>
          <Text style={styles.searchClearText}>Clear</Text>
        </Pressable>}
      </View>
      <Text style={styles.sectionHeading}>Discover by skill</Text>
      <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false}>
        {["All","Fashion","Beauty","Food","Media"].map(cat =>
          <Pressable key={cat} onPress={() => setCategory(cat)}
            style={[styles.category, category === cat && { backgroundColor: C.ink }]}>
            <Text style={[styles.categoryText, category === cat && { color: C.white }]}>{cat}</Text>
          </Pressable>)}
      </ScrollView>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: exploreSavedOnly }}
        accessibilityLabel="Show only locally saved sample work"
        accessibilityHint="Combines with search and skill filters. Saves last only this session."
        onPress={() => setExploreSavedOnly(old => !old)}
        style={[styles.exploreSavedFilter, exploreSavedOnly && styles.exploreSavedFilterActive]}>
        <I name={exploreSavedOnly ? "checkbox" : "square-outline"} color={C.ink} size={20}/>
        <Text style={styles.exploreSavedFilterText}>Saved work only</Text>
        <Text style={styles.exploreSavedFilterCount}>{exploreSavedCount} saved</Text>
      </Pressable>
      {exploreSavedOnly && <ScrollView horizontal style={styles.exploreCollectionStrip}
        showsHorizontalScrollIndicator={false}
        accessibilityLabel="Filter locally saved work by collection">
        {([null, "Inspiration", "Outfit ideas"] as const).map(collection => {
          const active = exploreSavedCollection === collection;
          const count = selectSavedPosts(POSTS, saves, collection).length;
          const label = collection ?? "All saved";
          return <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: active }}
            accessibilityLabel={label + " collection, " + count + " locally saved sample posts"}
            onPress={() => setExploreSavedCollection(collection)}
            style={[styles.exploreCollectionTab, active && styles.exploreCollectionTabActive]}>
            <Text style={[styles.exploreCollectionTabText, active && styles.exploreCollectionTabTextActive]}>
              {label} · {count}
            </Text>
          </Pressable>;
        })}
      </ScrollView>}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomReserve }}>
        <Text style={styles.sectionHeading}>Featured Hustlers <Text style={styles.sampleLabel}>· Demo</Text></Text>
        <Text style={styles.exploreResultsCount} accessibilityLiveRegion="polite">
          {visibleExplore.length} fictional {visibleExplore.length === 1 ? "result" : "results"} · Local sample work
        </Text>
        {visibleExplore.length === 0 ? <View style={styles.exploreEmpty}>
          <Text style={styles.mutedText}>
            {exploreSavedOnly
              ? exploreSavedCollection
                ? "No locally saved sample work in " + exploreSavedCollection + " matches these filters. Try All saved or clear filters."
                : "No locally saved sample work matches these filters. Save work in Explore or clear filters."
              : "No fictional work matches your search and skill filter."}
          </Text>
          {hasExploreFilters && <Pressable accessibilityRole="button"
            accessibilityLabel="Clear Explore search and filters"
            onPress={resetExploreFilters} style={styles.exploreResetTarget}>
            <Text style={styles.exploreResetText}>Clear search and filters</Text>
          </Pressable>}
        </View> :
          visibleExplore.map(post => <View key={post.id} style={styles.exploreCard}>
            <Pressable accessibilityRole="button" accessibilityLabel={"Open sample profile for " + post.name}
              onPress={() => open("creator", post)} style={styles.exploreIdentity}>
              <View style={[styles.exploreImage, { backgroundColor: post.bg }]}>
                <Text style={{ fontSize: 39 }}>{post.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.exploreTitle}>{post.name}</Text>
                <Text style={styles.exploreMeta}>{post.profession} · {post.place}</Text>
                <Text style={styles.explorePrice}>{post.offer.price}</Text>
                <Text style={styles.exploreWorkPreview} numberOfLines={2}>{post.caption}</Text>
              </View>
              <I name="chevron-forward" color={C.ink} size={20}/>
            </Pressable>
            <View style={styles.exploreActions}>
              <Pressable accessibilityRole="button"
                accessibilityLabel={"See fictional work by " + post.name + " in Feed"}
                accessibilityHint="Opens the matching illustrated sample post in For You"
                onPress={() => openWorkInFeed(post.id)} style={styles.exploreWorkTarget}>
                <Text style={styles.exploreWorkText}>See work ↗</Text>
              </Pressable>
              <Pressable accessibilityRole="button"
                accessibilityLabel={"Manage local saved collections for " + post.name}
                accessibilityState={{ selected: (saves[post.id] || []).length > 0 }}
                accessibilityHint={(saves[post.id] || []).length
                  ? "Saved locally to " + saves[post.id].join(" and ") + ". Opens collections."
                  : "Choose Inspiration or Outfit ideas. Nothing saved to a server."}
                onPress={() => open("save", post)} style={styles.exploreSaveTarget}>
                <I name={(saves[post.id] || []).length ? "bookmark" : "bookmark-outline"} color={C.ink} size={17}/>
                <Text style={styles.exploreWorkText}>
                  {(saves[post.id] || []).length ? "Saved ✓" : "Save work"}
                </Text>
              </Pressable>
            </View>
          </View>)}
        <View style={styles.demoNotice}><I name="information-circle-outline" color={C.ink}/><Text style={styles.demoNoticeText}>These are fictional examples. Map locations and real availability are not connected.</Text></View>
      </ScrollView>
    </View>
    : screen === "Inbox" ? <View style={[styles.lightPage, styles.centerPage,
      { paddingTop: insets.top + spacing.md, paddingBottom: bottomReserve }]}>
      <I name="chatbubbles-outline" color={C.ink} size={58}/>
      <Text style={styles.pageTitle}>Inbox</Text>
      <Text style={[styles.subtitle, { textAlign: "center" }]}>Messages appear here when Hustle is connected. No messages are sent in this demo.</Text>
      <Button title="Explore Hustlers" onPress={() => selectRootTab("Explore")} />
    </View>
    : <ScrollView style={styles.lightPage}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: insets.top + 27, paddingBottom: bottomReserve }}>
      <Text style={styles.pageTitle}>Your Hustle</Text><Text style={styles.subtitle}>One account. Your economy.</Text>
      <View style={styles.youCard}><View style={styles.youAvatar}><I name="person-outline" color={C.ink} size={39}/></View>
        <View style={{ flex: 1 }}><Text style={styles.youTitle}>Demo guest</Text><Text style={styles.youMeta}>Offline preview · Not signed in</Text></View></View>
      <Text style={styles.sectionHeading}>Your collections</Text>
      {(["Inspiration","Outfit ideas"] as const).map(collection =>
        <Pressable key={collection} onPress={() => openSavedCollection(collection)}
          accessibilityRole="button" accessibilityLabel={"Open " + collection + " saved posts"}
          style={styles.collectionRow}>
          <I name="bookmark-outline" color={C.ink}/>
          <Text style={styles.collectionName}>{collection}</Text>
          <Text style={styles.mutedText}>{POSTS.filter(p => (saves[p.id]||[]).includes(collection)).length} saved</Text>
        </Pressable>)}
      <View style={styles.demoNotice}><I name="shield-checkmark-outline" color={C.ink}/>
        <Text style={styles.demoNoticeText}>This demo uses only temporary sample data. Nothing is saved to a server.</Text></View>
    </ScrollView>}
    {!keyboardVisible && <FloatingTabBar activeTab={screen} onSelectTab={selectRootTab}
      onPressCreate={() => Alert.alert("Create · Demo", "Publishing is disabled in the offline preview.")}
      bottomInset={insets.bottom} />}
    <Modal visible={sheet !== null} transparent animationType="slide"
      onRequestClose={requestDismissSheet} statusBarTranslucent={false}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.scrim} accessibilityRole="button"
          onPress={requestDismissSheet} accessibilityLabel="Dismiss sheet"/>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalKeyboardArea}>
          <ScrollView style={styles.sheetScroll} nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) + 14 }]}>
            <View style={styles.grabber}/>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{sheet === "comments" ? "Comments" : sheet === "save" ? "Save to collection" :
                sheet === "share" ? "Share this work" : sheet === "creator" ? "Creator" :
                sheet === "offer" ? current.offer.kind === "service" ? "Attached service" : "Attached product" : "Booking preview"}</Text>
              <Pressable onPress={requestDismissSheet} accessibilityRole="button"
                style={styles.sheetCloseTarget} accessibilityLabel="Close sheet"><I name="close" color={C.ink}/></Pressable>
            </View>
            {sheet === "comments" && <>
              <Text style={styles.commentsSummary}>
                {currentComments.length} demo {currentComments.length === 1 ? "comment" : "comments"} · Only saved in this session
              </Text>
              <ScrollView style={{ maxHeight: 325 }} keyboardShouldPersistTaps="handled">
                {orderedComments.length === 0 ? <Text style={styles.mutedText}>Be the first to comment.</Text> :
                  orderedComments.map(note => <View key={note.id} style={[styles.commentRow, note.parentId ? styles.commentReplyRow : null]}>
                    <View style={styles.commentAvatar}><I name="person" size={17} color={C.ink}/></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.commentName}>@{note.handle}{note.parentId ? " · reply" : ""}</Text>
                      <Text style={styles.commentBody}>{note.body}</Text>
                      <Pressable accessibilityRole="button" accessibilityLabel={"Reply to @" + note.handle}
                        style={styles.replyTarget} onPress={() => setReplyTo(replyRootId(currentComments, note.id))}>
                        <Text style={styles.reply}>Reply</Text>
                      </Pressable>
                    </View>
                  </View>)}
              </ScrollView>
              {replyTarget ? <View style={styles.replyContext}>
                <Text style={styles.replyContextText}>Replying to @{replyTarget.handle} · demo only</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Cancel demo reply" style={styles.cancelReplyTarget}
                  onPress={() => setReplyTo(null)}><Text style={styles.reply}>Cancel</Text></Pressable>
              </View> : null}
              <View style={styles.composer}><TextInput value={commentText} onChangeText={setCommentText}
                placeholder={replyTarget ? "Reply to @" + replyTarget.handle + "..." : "Write a comment..."}
                placeholderTextColor={C.muted} maxLength={500}
                returnKeyType="send" onSubmitEditing={addComment}
                style={styles.commentInput} accessibilityLabel="Demo comment"/>
                <Pressable onPress={addComment} accessibilityRole="button"
                  style={styles.sendTarget} accessibilityLabel="Post demo comment"><I name="send" color={C.ink}/></Pressable></View>
            </>}
            {sheet === "save" && <><Text style={styles.mutedText}>Organize your saved inspiration. Saved only on this screen until the app closes.</Text>
              {(["Inspiration","Outfit ideas"] as const).map(collection => {
                const enabled = (saves[current.id] || []).includes(collection);
                return <Pressable key={collection} onPress={() => toggleSave(current.id, collection)}
                  accessibilityRole="checkbox" accessibilityState={{ checked: enabled }}
                  accessibilityLabel={collection + (enabled ? " · saved locally" : " · add to local collection")}
                  style={[styles.sheetChoice, enabled && styles.sheetChoiceSelected]}>
                  <I name={enabled ? "checkbox" : "square-outline"} color={C.ink}/>
                  <Text style={styles.choiceText}>{collection}</Text>
                  <Text style={styles.mutedText}>{enabled ? "Saved ✓" : "Add"}</Text>
                </Pressable>;
              })}
              <Text style={styles.saveFeedback}>
                {savedCollectionsForPost.length
                  ? "Saved locally to " + savedCollectionsForPost.join(" and ") + "."
                  : "Not saved to any collection."}
              </Text>
              <Button title="Done" onPress={close}/>
            </>}
            {sheet === "share" && <><Text style={styles.mutedText}>Share the idea, not a live booking link. This is fictional content.</Text>
              <Button title="Open phone share menu ↗" onPress={() => { void share(); }}/>
            </>}
            {sheet === "creator" && <>
              <View style={styles.creatorPanel}>
                <View style={[styles.creatorAvatar, { backgroundColor: current.accent }]}><Text style={{ fontSize: 40 }}>{current.icon}</Text></View>
                <View style={{ flex: 1 }}><Text style={styles.creatorPanelName}>{current.name}</Text>
                  <Text style={styles.exploreMeta}>@{current.handle} · {current.place}</Text>
                  <Text style={styles.explorePrice}>{current.profession}</Text></View>
              </View>
              <Text style={styles.mutedText}>Demo profile • No verification, reviews, or completed jobs implied.</Text>
              <Button title={follows.includes(current.id) ? "Following ✓" : "Follow creator"} onPress={() => setFollows(old => old.includes(current.id) ? old.filter(id=>id!==current.id) : [...old,current.id])}/>
              {screen === "Explore" && <Button title="See sample work in Feed ↗" outline
                onPress={() => openWorkInFeed(current.id)} />}
              <Button title={"View " + (current.offer.kind === "service" ? "service" : "product")} outline onPress={() => setSheet("offer")}/>
            </>}
            {sheet === "offer" && <>
              <Text style={styles.offerDetailTitle}>{current.offer.title}</Text><Text style={styles.offerDetailPrice}>{current.offer.price}</Text>
              <Text style={styles.mutedText}>{current.offer.detail}</Text>
              <View style={styles.demoNotice}><I name="information-circle-outline" color={C.ink}/>
                <Text style={styles.demoNoticeText}>Sample offer only. No real provider, inventory, checkout, payment or escrow.</Text></View>
              <Button title={current.offer.kind === "service" ? "See sample booking ↗" : "View sample product options ↗"}
                onPress={() => current.offer.kind === "service" ? setSheet("booking") :
                  Alert.alert("Product preview", "Shopping and checkout are disabled in this demo.")}/>
            </>}
            {sheet === "booking" && <>
              <Text style={styles.offerDetailTitle}>{current.offer.title}</Text>
              <Text style={styles.mutedText}>Choose an illustrative time. No real availability is checked and no booking will be created.</Text>
              <View style={styles.slotRow}>{["11:00 AM","2:00 PM","4:30 PM"].map(time =>
                <Pressable key={time} style={[styles.slot, selectedTime === time && { backgroundColor: C.ink }]} onPress={() => setSelectedTime(time)}>
                  <Text style={[styles.slotText, selectedTime === time && { color: C.white }]}>{time}</Text>
                </Pressable>)}</View>
              <Button title="Preview request (not sent)" onPress={() => Alert.alert("Demo request only", "Your sample " + selectedTime + " booking was not sent or saved. No payment was collected.")}/>
            </>}
            <Text style={styles.sheetDisclaimer}>OFFLINE DEMO · NO BACKEND · NO TRANSACTIONS</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  </HybridScreenSurface>;
}
export default function DemoExperience() {
  return <SafeAreaProvider><Experience/></SafeAreaProvider>;
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  feedList: { flex: 1 },
  feedCard: { width: "100%", backgroundColor: C.charcoal },
  poster: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  halo: { width: 325, height: 325, position: "absolute", borderRadius: 160, top: "22%", right: -80, opacity: .62 },
  haloSmall: { width: 240, height: 240, position: "absolute", borderRadius: 125, top: "50%", left: -115, opacity: .2 },
  posterSymbol: { fontSize: 148, textAlign: "center", position: "absolute", top: "29%", left: 30, right: 30 },
  posterType: { position: "absolute", left: 20, right: 18 },
  posterHeadline: { color: "#FFFFFF", fontWeight: "900", fontSize: 49, letterSpacing: -2.5 },
  posterSlogan: { fontSize: 25, color: "#FFFFFF", fontWeight: "500", marginTop: -7 },
  posterFoot: { color: "#FFFFFF", fontSize: 12, lineHeight: 17, marginTop: 12, letterSpacing: 1, fontWeight: "700" },
  posterShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(4,8,6,.24)" },
  artworkTapTarget: { ...StyleSheet.absoluteFillObject },
  topRow: { position: "absolute", left: 20, right: 21, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wordmark: { color: "#FFFFFF", fontWeight: "900", fontSize: 26 },
  feedTabs: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 16 },
  feedTabMuted: { color: "#E7EDE7", fontSize: 13, fontWeight: "800", marginRight: 3 },
  feedTab: { paddingVertical: 9 }, feedTabActive: { borderBottomWidth: 2, borderBottomColor: C.lime },
  feedTabText: { color: "#B5C3B5", fontSize: 14, fontWeight: "700" },
  demoChip: { position: "absolute", left: 19 },
  rail: { position: "absolute", right: 10, gap: 10 },
  railItem: { alignItems: "center", width: 60, paddingVertical: 4 },
  railCaption: { color: C.white, fontSize: 11, marginTop: 4, fontWeight: "800", textAlign: "center" },
  feedBottom: { position: "absolute", left: 18, right: 83 },
  creatorName: { color: C.white, fontSize: 17, fontWeight: "900" },
  caption: { color: C.white, fontSize: 13, marginTop: 7, lineHeight: 19 },
  captionTapTarget: { minHeight: layout.minTapTarget, justifyContent: "center" },
  captionMore: { color: C.lime, fontSize: 12, fontWeight: "800", marginTop: 3 },
  specialty: { color: "#E2E9E1", fontSize: 11, marginTop: 7 },
  mediaDisclosure: { fontSize: 12, lineHeight: 17, color: "#E1E8DE", marginTop: 8 },
  lightPage: { flex: 1, backgroundColor: C.cream, paddingHorizontal: spacing.gutter },
  centerPage: { alignItems: "center", justifyContent: "center", gap: 17 },
  pageTitle: { color: C.ink, fontWeight: "900", fontSize: 30 },
  subtitle: { color: C.muted, fontSize: 14, marginTop: 7, marginBottom: 20, lineHeight: 22 },
  searchBar: { backgroundColor: C.white, borderRadius: 17, height: 51, flexDirection: "row", alignItems: "center", paddingHorizontal: 13 },
  searchField: { flex: 1, paddingLeft: 10, fontSize: 13, color: C.ink },
  searchClearTarget: { minWidth: layout.minTapTarget, minHeight: layout.minTapTarget,
    alignItems: "center", justifyContent: "center" },
  searchClearText: { color: C.ink, fontSize: 12, fontWeight: "800" },
  sectionHeading: { color: C.ink, fontWeight: "800", fontSize: 18, marginTop: 23, marginBottom: 14 },
  sampleLabel: { color: C.muted, fontWeight: "500", fontSize: 12 },
  category: { marginRight: 9, backgroundColor: "#DCECCF", borderRadius: 17, paddingVertical: 10, paddingHorizontal: 15, alignItems: "center", height: 39 },
  categoryText: { fontWeight: "800", color: C.ink, fontSize: 13 },
  exploreCard: { backgroundColor: C.white, borderRadius: 18, marginBottom: 11, padding: 11, gap: 7 },
  exploreIdentity: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 83 },
  exploreActions: { flexDirection: "row", alignItems: "stretch",
    borderTopWidth: 1, borderTopColor: "#E8EDE4" },
  exploreWorkTarget: { flex: 1, alignItems: "center", justifyContent: "center",
    minHeight: layout.minTapTarget },
  exploreSaveTarget: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center",
    justifyContent: "center", minHeight: layout.minTapTarget,
    borderLeftWidth: 1, borderLeftColor: "#E8EDE4" },
  exploreWorkText: { color: C.ink, fontSize: 13, fontWeight: "800" },
  exploreImage: { width: 75, height: 83, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  exploreTitle: { color: C.ink, fontWeight: "900", fontSize: 15 },
  exploreMeta: { color: C.muted, fontSize: 11, marginTop: 5 },
  explorePrice: { color: C.ink, fontSize: 13, fontWeight: "800", marginTop: 7 },
  exploreWorkPreview: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  exploreResultsCount: { color: C.muted, fontSize: 12, marginBottom: 12 },
  exploreSavedFilter: { minHeight: layout.minTapTarget, flexDirection: "row", alignItems: "center",
    gap: 9, paddingHorizontal: 14, backgroundColor: C.white, borderRadius: 15, marginTop: 12 },
  exploreSavedFilterActive: { backgroundColor: "#DCECCF" },
  exploreSavedFilterText: { flex: 1, color: C.ink, fontSize: 13, fontWeight: "800" },
  exploreSavedFilterCount: { color: C.muted, fontSize: 12, fontWeight: "700" },
  exploreCollectionStrip: { flexGrow: 0, marginTop: 8 },
  exploreCollectionTab: { minHeight: layout.minTapTarget, justifyContent: "center",
    backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 13, marginRight: 9 },
  exploreCollectionTabActive: { backgroundColor: C.ink },
  exploreCollectionTabText: { color: C.ink, fontSize: 12, fontWeight: "800" },
  exploreCollectionTabTextActive: { color: C.white },
  exploreEmpty: { gap: 11, paddingBottom: 20 },
  exploreResetTarget: { minHeight: layout.minTapTarget, backgroundColor: C.white,
    borderRadius: 14, alignItems: "center", justifyContent: "center" },
  exploreResetText: { color: C.ink, fontSize: 13, fontWeight: "800" },
  mutedText: { color: C.muted, fontSize: 13, lineHeight: 20 },
  demoNotice: { marginTop: 20, backgroundColor: "#E8EDDE", borderRadius: 17, padding: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  demoNoticeText: { color: C.ink, fontSize: 13, flex: 1, lineHeight: 19 },
  youCard: { backgroundColor: C.white, borderRadius: 19, flexDirection: "row", alignItems: "center", marginTop: 17, padding: 16, gap: 14 },
  youAvatar: { backgroundColor: "#D9EABF", width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  youTitle: { color: C.ink, fontWeight: "900", fontSize: 18 },
  youMeta: { fontSize: 12, color: C.muted, marginTop: 4 },
  collectionRow: { padding: 17, marginTop: 10, borderRadius: 15, backgroundColor: C.white, flexDirection: "row", alignItems: "center", gap: 11 },
  collectionName: { color: C.ink, fontSize: 14, fontWeight: "800", flex: 1 },
  emptyDark: { flex: 1, alignItems: "center", justifyContent: "center", gap: 15, paddingHorizontal: 25 },
  whiteTitle: { color: C.white, fontSize: 22, fontWeight: "800", textAlign: "center" },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(3,8,5,.63)" },
  modalKeyboardArea: { width: "100%", maxHeight: "100%", flexShrink: 1 },
  sheetScroll: { backgroundColor: C.cream, borderTopLeftRadius: 27, borderTopRightRadius: 27, maxHeight: "90%" },
  sheet: { paddingHorizontal: 22, paddingTop: 12 },
  grabber: { width: 65, height: 5, borderRadius: 3, backgroundColor: "#CAD5C5", alignSelf: "center", marginBottom: 21 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  sheetCloseTarget: { minWidth: layout.minTapTarget, minHeight: layout.minTapTarget, alignItems: "center", justifyContent: "center" },
  sheetTitle: { color: C.ink, fontSize: 22, fontWeight: "900" },
  button: { backgroundColor: C.lime, marginTop: 13, borderRadius: radii.button, paddingVertical: 16, paddingHorizontal: 16, alignItems: "center" },
  buttonText: { fontWeight: "900", fontSize: 14, color: C.ink, textAlign: "center" },
  commentRow: { flexDirection: "row", gap: 11, marginBottom: 18 },
  commentReplyRow: { marginLeft: 25, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: C.muted },
  commentsSummary: { color: C.muted, fontSize: 12, marginBottom: 13, lineHeight: 18 },
  replyTarget: { minHeight: layout.minTapTarget, alignSelf: "flex-start", justifyContent: "center" },
  replyContext: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingHorizontal: 10, backgroundColor: "#E8EDE2", borderRadius: 12 },
  replyContextText: { color: C.ink, flex: 1, fontSize: 12, fontWeight: "700" },
  cancelReplyTarget: { minHeight: layout.minTapTarget, justifyContent: "center", paddingHorizontal: 10 },
  commentAvatar: { backgroundColor: "#DCEACF", width: 37, height: 37, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  commentName: { fontSize: 13, color: C.ink, fontWeight: "800" },
  commentBody: { marginTop: 5, fontSize: 13, color: C.ink },
  reply: { marginTop: 8, color: C.muted, fontSize: 12, fontWeight: "800" },
  composer: { flexDirection: "row", backgroundColor: "#E8EDE2", borderRadius: 25, paddingLeft: 15, paddingRight: 4, alignItems: "center", minHeight: 49, marginTop: 11 },
  commentInput: { flex: 1, minHeight: layout.minTapTarget, color: C.ink, fontSize: 15 },
  sendTarget: { minHeight: layout.minTapTarget, minWidth: layout.minTapTarget, alignItems: "center", justifyContent: "center" },
  sheetChoice: { flexDirection: "row", gap: 14, backgroundColor: C.white, padding: 17, borderRadius: 14, marginTop: 12, alignItems: "center" },
  sheetChoiceSelected: { borderWidth: 2, borderColor: C.ink, padding: 15 },
  saveFeedback: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 12 },
  choiceText: { color: C.ink, fontWeight: "800", fontSize: 14, flex: 1 },
  creatorPanel: { flexDirection: "row", gap: 15, alignItems: "center", marginTop: 8, marginBottom: 20 },
  creatorAvatar: { width: 78, height: 78, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  creatorPanelName: { fontSize: 21, fontWeight: "900", color: C.ink },
  offerDetailTitle: { color: C.ink, fontSize: 19, fontWeight: "900", marginTop: 10 },
  offerDetailPrice: { color: C.ink, fontSize: 22, fontWeight: "900", marginTop: 12, marginBottom: 15 },
  slotRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 19 },
  slot: { backgroundColor: "#E2EADC", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 14 },
  slotText: { color: C.ink, fontWeight: "800", fontSize: 12 },
  sheetDisclaimer: { color: C.muted, fontSize: 12, lineHeight: 18, letterSpacing: 0.4, fontWeight: "800", textAlign: "center", marginTop: 18 }
});
