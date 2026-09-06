export default function HomePage() {
  return <main className="phasePreview">
    <header className="topLine"><a className="brandMark" href="/">HUSTLE<span>↗</span></a><a className="textButton" href="/auth">Enter Hustle</a></header>
    <section className="phaseHero"><p className="kicker">PHASE 2 / UNIFIED IDENTITY</p><h1>The economy starts with <em>you.</em></h1><p className="heroCopy">One account becomes the home of your discovery, transactions, reputation and future capabilities.</p><div className="heroActions"><a className="primaryLink" href="/auth">Create your identity <b>↗</b></a><span>Client is enabled automatically.</span></div></section>
    <section className="principleGrid"><article><small>01</small><h2>One identity</h2><p>No duplicate buyer/seller accounts.</p></article><article className="darkCard"><small>02</small><h2>Progressive capability</h2><p>Client today. Hustler or Agent when approved.</p></article><article><small>03</small><h2>Compounding trust</h2><p>Every future interaction strengthens the same reputation.</p></article></section>
    <footer className="previewFooter"><span>Hustle — The Economy of You</span><span>Authentication + Unified Account</span></footer>
  </main>;
}
