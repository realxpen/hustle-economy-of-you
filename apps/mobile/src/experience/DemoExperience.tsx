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

// Legacy local names map to approved UX004 semantic tokens. The full feed
// layout/navigation upgrade happens in separate A1.2/A2 review slices.
const C = {
  ink: colors.ink, lime: colors.lime, cream: colors.paper,
  white: colors.surface, muted: colors.textSecondaryLight,
  charcoal: colors.charcoal,
};
type IconName = AppIconName;
type Sheet = "comments" | "save" | "share" | "creator" | "offer" | "booking" | null;
type Collection = "Inspiration" | "Outfit ideas";
type Offer = { kind: "service" | "product"; title: string; price: string; detail: string };
type Post = {
  id: string; handle: string; name: string; profession: string; place: string;
  category: string; caption: string; headline: string; slogan: string; icon: string;
  bg: string; accent: string; likes: number; offer: Offer;
};
type Comment = { id: string; handle: string; body: string; parentId?: string };

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
  const [selectedTime, setSelectedTime] = useState("11:00 AM");
  const [savedOnly, setSavedOnly] = useState(false);
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
  const openSavedCollection = () => {
    if (!savedOnly) regularFeedIndex.current = index;
    setSavedOnly(true);
    setIndex(0);
    setSheet(null);
    setScreen("Home");
  };
  const current = POSTS.find(p => p.id === chosenPost) || POSTS[0];
  const visibleFeed = savedOnly ? POSTS.filter(p => (saves[p.id] || []).length > 0) : POSTS;
  const explore = useMemo(() => POSTS.filter(p =>
    (category === "All" || p.category === category) &&
    (p.name + " " + p.profession + " " + p.offer.title + " " + p.place).toLowerCase().includes(search.toLowerCase())
  ), [category, search]);

  function open(type: Sheet, post: Post) {
    setChosenPost(post.id); setSheet(type);
    if (type === "comments") { setCommentText(""); setReplyTo(null); }
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
          <Text style={styles.posterFoot}>CREATIVE WORK · {post.category.toUpperCase()}</Text>
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
        <Pressable accessibilityRole="button" onPress={() => open("offer", post)} style={styles.offerPill}>
          <View style={{ flex: 1 }}>
            <Text style={styles.offerName} numberOfLines={1}>{post.offer.kind === "service" ? "✦ Book" : "✦ Shop"} · {post.offer.title}</Text>
            <Text style={styles.offerAmount}>{post.offer.price}</Text>
          </View>
          <Text style={styles.offerLink}>View ↗</Text>
        </Pressable>
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
      key={`${savedOnly ? "saved" : feed}:${Math.round(pageHeight)}`}
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
        <I name="bookmark-outline" size={40}/><Text style={styles.whiteTitle}>Your saved feed is empty</Text>
        <Button title="Return to For You" onPress={() => setSavedOnly(false)} />
      </View>} />
    : screen === "Explore" ? <View style={[styles.lightPage, { paddingTop: insets.top + 18 }]}>
      <Text style={styles.pageTitle}>Explore</Text>
      <Text style={styles.subtitle}>Find great work, not just listings.</Text>
      <View style={styles.searchBar}><I name="search-outline" color={C.ink} size={21}/>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search skills, people, services..." placeholderTextColor="#89948A" style={styles.searchField} accessibilityLabel="Search demo professionals"/>
      </View>
      <Text style={styles.sectionHeading}>Discover by skill</Text>
      <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false}>
        {["All","Fashion","Beauty","Food","Media"].map(cat =>
          <Pressable key={cat} onPress={() => setCategory(cat)}
            style={[styles.category, category === cat && { backgroundColor: C.ink }]}>
            <Text style={[styles.categoryText, category === cat && { color: C.white }]}>{cat}</Text>
          </Pressable>)}
      </ScrollView>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomReserve }}>
        <Text style={styles.sectionHeading}>Featured Hustlers <Text style={styles.sampleLabel}>· Demo</Text></Text>
        {explore.length === 0 ? <Text style={styles.mutedText}>No matching sample. Try another skill.</Text> :
          explore.map(post => <Pressable key={post.id} onPress={() => open("creator", post)} style={styles.exploreCard}>
            <View style={[styles.exploreImage, { backgroundColor: post.bg }]}>
              <Text style={{ fontSize: 39 }}>{post.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exploreTitle}>{post.name}</Text>
              <Text style={styles.exploreMeta}>{post.profession} · {post.place}</Text>
              <Text style={styles.explorePrice}>{post.offer.price}</Text>
            </View>
            <I name="chevron-forward" color={C.ink} size={20}/>
          </Pressable>)}
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
        <Pressable key={collection} onPress={openSavedCollection}
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
              <ScrollView style={{ maxHeight: 325 }} keyboardShouldPersistTaps="handled">
                {(comments[current.id]||[]).length === 0 ? <Text style={styles.mutedText}>Be the first to comment.</Text> :
                  (comments[current.id]||[]).map(note => <View key={note.id} style={[styles.commentRow, note.parentId ? { marginLeft: 27 } : null]}>
                    <View style={styles.commentAvatar}><I name="person" size={17} color={C.ink}/></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.commentName}>@{note.handle}</Text>
                      <Text style={styles.commentBody}>{note.body}</Text>
                      <Pressable onPress={() => setReplyTo(note.id)}><Text style={styles.reply}>Reply</Text></Pressable>
                    </View>
                  </View>)}
              </ScrollView>
              {replyTo ? <Pressable onPress={() => setReplyTo(null)}><Text style={styles.reply}>Replying to comment · Cancel</Text></Pressable> : null}
              <View style={styles.composer}><TextInput value={commentText} onChangeText={setCommentText}
                placeholder="Write a comment..." placeholderTextColor={C.muted}
                returnKeyType="send" onSubmitEditing={addComment}
                style={styles.commentInput} accessibilityLabel="Demo comment"/>
                <Pressable onPress={addComment} accessibilityRole="button"
                  style={styles.sendTarget} accessibilityLabel="Post demo comment"><I name="send" color={C.ink}/></Pressable></View>
            </>}
            {sheet === "save" && <><Text style={styles.mutedText}>Organize your saved inspiration. Saved only on this screen until the app closes.</Text>
              {(["Inspiration","Outfit ideas"] as const).map(collection => {
                const enabled = (saves[current.id] || []).includes(collection);
                return <Pressable key={collection} onPress={() => toggleSave(current.id, collection)} style={styles.sheetChoice}>
                  <I name={enabled ? "checkbox" : "square-outline"} color={C.ink}/>
                  <Text style={styles.choiceText}>{collection}</Text>
                  <Text style={styles.mutedText}>{enabled ? "Saved" : "Add"}</Text>
                </Pressable>;
              })}
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
  posterFoot: { color: "#FFFFFF", fontSize: 10, marginTop: 12, letterSpacing: 2, fontWeight: "700" },
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
  offerPill: { marginTop: 13, padding: 13, borderRadius: 17, flexDirection: "row", alignItems: "center", backgroundColor: "#293C30" },
  offerName: { color: "#FFFFFF", fontWeight: "800", fontSize: 12 },
  offerAmount: { color: C.lime, marginTop: 5, fontSize: 12 },
  offerLink: { color: C.lime, fontWeight: "800", fontSize: 12, marginLeft: 7 },
  mediaDisclosure: { fontSize: 12, lineHeight: 17, color: "#E1E8DE", marginTop: 8 },
  lightPage: { flex: 1, backgroundColor: C.cream, paddingHorizontal: spacing.gutter },
  centerPage: { alignItems: "center", justifyContent: "center", gap: 17 },
  pageTitle: { color: C.ink, fontWeight: "900", fontSize: 30 },
  subtitle: { color: C.muted, fontSize: 14, marginTop: 7, marginBottom: 20, lineHeight: 22 },
  searchBar: { backgroundColor: C.white, borderRadius: 17, height: 51, flexDirection: "row", alignItems: "center", paddingHorizontal: 13 },
  searchField: { flex: 1, paddingLeft: 10, fontSize: 13, color: C.ink },
  sectionHeading: { color: C.ink, fontWeight: "800", fontSize: 18, marginTop: 23, marginBottom: 14 },
  sampleLabel: { color: C.muted, fontWeight: "500", fontSize: 12 },
  category: { marginRight: 9, backgroundColor: "#DCECCF", borderRadius: 17, paddingVertical: 10, paddingHorizontal: 15, alignItems: "center", height: 39 },
  categoryText: { fontWeight: "800", color: C.ink, fontSize: 13 },
  exploreCard: { backgroundColor: C.white, borderRadius: 18, marginBottom: 11, padding: 11, flexDirection: "row", alignItems: "center", gap: 12 },
  exploreImage: { width: 75, height: 83, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  exploreTitle: { color: C.ink, fontWeight: "900", fontSize: 15 },
  exploreMeta: { color: C.muted, fontSize: 11, marginTop: 5 },
  explorePrice: { color: C.ink, fontSize: 13, fontWeight: "800", marginTop: 7 },
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
  commentAvatar: { backgroundColor: "#DCEACF", width: 37, height: 37, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  commentName: { fontSize: 13, color: C.ink, fontWeight: "800" },
  commentBody: { marginTop: 5, fontSize: 13, color: C.ink },
  reply: { marginTop: 8, color: C.muted, fontSize: 12, fontWeight: "800" },
  composer: { flexDirection: "row", backgroundColor: "#E8EDE2", borderRadius: 25, paddingLeft: 15, paddingRight: 4, alignItems: "center", minHeight: 49, marginTop: 11 },
  commentInput: { flex: 1, minHeight: layout.minTapTarget, color: C.ink, fontSize: 15 },
  sendTarget: { minHeight: layout.minTapTarget, minWidth: layout.minTapTarget, alignItems: "center", justifyContent: "center" },
  sheetChoice: { flexDirection: "row", gap: 14, backgroundColor: C.white, padding: 17, borderRadius: 14, marginTop: 12, alignItems: "center" },
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
