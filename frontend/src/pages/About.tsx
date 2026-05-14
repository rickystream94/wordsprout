import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useTheme } from '../store/ThemeContext';
import UserMenu from '../components/layout/UserMenu';
import styles from './About.module.css';

export default function About() {
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className={styles.page}>
      {/* ── Sticky top bar ─────────────────────────────────────── */}
      <div className={styles.topBar}>
        <Link to={isAuthenticated ? '/' : '/login'} className={styles.topBarLogo}>
          <img src="/favicon.svg" alt="" aria-hidden="true" className={styles.topBarLogoIcon} />
          WordSprout
        </Link>
        {isAuthenticated ? (
          <nav className={styles.topBarNav}>
            <NavLink to="/" end className={({ isActive }) => isActive ? styles.navLinkActive : styles.navLink}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1.5 14.25V7.5l6.5-5.5 6.5 5.5v6.75a.75.75 0 0 1-.75.75H10v-4.5H6v4.5H2.25a.75.75 0 0 1-.75-.75Z"/></svg>
              Phrasebooks
            </NavLink>
            <NavLink to="/search" className={({ isActive }) => isActive ? styles.navLinkActive : styles.navLink}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"/></svg>
              Search
            </NavLink>
            <NavLink to="/review" className={({ isActive }) => isActive ? styles.navLinkActive : styles.navLink}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M0 1.75A.75.75 0 0 1 .75 1h4.253c1.227 0 2.317.59 3 1.501A3.743 3.743 0 0 1 11.006 1h4.245a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-4.507a2.25 2.25 0 0 0-1.591.659l-.622.621a.75.75 0 0 1-1.06 0l-.622-.621A2.25 2.25 0 0 0 5.258 13H.75a.75.75 0 0 1-.75-.75Zm7.251 10.324.004-5.073-.002-2.253A2.25 2.25 0 0 0 5.003 2.5H1.5v9h3.757a3.75 3.75 0 0 1 1.994.574ZM8.755 4.75l-.004 7.322a3.752 3.752 0 0 1 1.992-.572H14.5v-9h-3.495a2.25 2.25 0 0 0-2.25 2.25Z"/></svg>
              Review
            </NavLink>
            <NavLink to="/about" className={({ isActive }) => isActive ? styles.navLinkActive : styles.navLink}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>
              About
            </NavLink>
          </nav>
        ) : null}
        <div className={styles.topBarActions}>
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            className={styles.themeToggle}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          {isAuthenticated && <UserMenu />}
          {!isAuthenticated && (
            <Link to="/login" className={styles.topBarSignIn}>Sign in</Link>
          )}
        </div>
      </div>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroEmojis} aria-hidden="true">
          <span>📖</span>
          <span>🌱</span>
          <span>✨</span>
        </div>
        <h1 className={styles.heroTitle}>
          Your personal{' '}
          <span className={styles.heroTitleAccent}>vocabulary&nbsp;garden</span>
        </h1>
        <p className={styles.heroTagline}>
          Looking up a word is easy. <em>Remembering it next week</em> is the hard part.
          WordSprout bridges that gap — capture, review, and truly own every word you learn.
        </p>
      </section>

      <div className={styles.content}>
        {/* ── What is WordSprout? ─────────────────────────────── */}
        <section className={styles.section}>
          <p className={styles.sectionLabel}>The idea</p>
          <h2 className={styles.sectionTitle}>What is WordSprout?</h2>
          <div className={styles.callout}>
            <span className={styles.calloutIcon} aria-hidden="true">💡</span>
            <p className={styles.calloutText}>
              You hear an interesting word, open a dictionary, find the translation — and then
              close the tab and forget it forever. Sound familiar? Looking something up in the
              moment gives you a flash of understanding, but <strong>without writing it down
              and coming back to it, the word simply doesn't stick</strong>.
            </p>
          </div>
          <p className={styles.sectionBody} style={{ marginTop: 'var(--space-5)' }}>
            WordSprout is built around one simple truth: <strong>long-term vocabulary retention
            requires active review</strong>. It's not enough to glance at a translation once.
            You need to encounter the word again — in context, more than once, spaced out over
            time. That's exactly what WordSprout helps you do.
          </p>
          <p className={styles.sectionBody} style={{ marginTop: 'var(--space-4)' }}>
            Think of it as a personal vocabulary notebook that actually fights back against
            forgetting. You capture a word the moment you meet it, enrich it with context, and
            then WordSprout brings it back to you at the right moment — until it's truly yours.
          </p>
        </section>

        {/* ── Who is it for? ──────────────────────────────────── */}
        <section className={styles.section}>
          <p className={styles.sectionLabel}>Who it's for</p>
          <h2 className={styles.sectionTitle}>Made for curious minds</h2>
          <p className={styles.sectionBody}>
            If you love learning languages — or simply love words — WordSprout is for you.
          </p>
          <div className={styles.audienceGrid} role="list">
            <div className={styles.audienceCard} role="listitem">
              <span className={styles.audienceEmoji} aria-hidden="true">🎓</span>
              <h3 className={styles.audienceCardTitle}>Language students</h3>
              <p className={styles.audienceCardDesc}>
                Building vocabulary is one of the hardest parts of learning a new language.
                WordSprout makes it structured and fun.
              </p>
            </div>
            <div className={styles.audienceCard} role="listitem">
              <span className={styles.audienceEmoji} aria-hidden="true">✈️</span>
              <h3 className={styles.audienceCardTitle}>Travellers &amp; expats</h3>
              <p className={styles.audienceCardDesc}>
                Living abroad or travelling? Jot down words you hear on the street and review them
                later at your own pace.
              </p>
            </div>
            <div className={styles.audienceCard} role="listitem">
              <span className={styles.audienceEmoji} aria-hidden="true">📚</span>
              <h3 className={styles.audienceCardTitle}>Avid readers</h3>
              <p className={styles.audienceCardDesc}>
                Stumble across a great word in a book or article? Save it immediately and revisit it
                before it slips away.
              </p>
            </div>
            <div className={styles.audienceCard} role="listitem">
              <span className={styles.audienceEmoji} aria-hidden="true">💡</span>
              <h3 className={styles.audienceCardTitle}>Lifelong learners</h3>
              <p className={styles.audienceCardDesc}>
                Curious people who simply enjoy expanding their vocabulary in any language, at any
                level.
              </p>
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────── */}
        <section className={styles.section}>
          <p className={styles.sectionLabel}>How it works</p>
          <h2 className={styles.sectionTitle}>Four simple steps</h2>
          <p className={styles.sectionBody}>
            WordSprout follows a natural learning cycle — from first encounter to full mastery.
          </p>
          <ol className={styles.steps} aria-label="How WordSprout works">
            <li className={styles.step}>
              <div className={styles.stepBadge} aria-hidden="true">1</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>Capture a word</h3>
                <p className={styles.stepDesc}>
                  Spotted a new word? Add it to a phrasebook in seconds. Write the translation,
                  add a personal note, or simply drop in the sentence where you found it. Done.
                </p>
              </div>
            </li>
            <li className={styles.step}>
              <div className={styles.stepBadge} aria-hidden="true">2</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>Enrich it with AI</h3>
                <p className={styles.stepDesc}>
                  Let WordSprout fill in the gaps automatically. With one tap, get example
                  sentences, synonyms, and usage notes — powered by AI, so you understand the
                  word in real-life context.
                </p>
              </div>
            </li>
            <li className={styles.step}>
              <div className={styles.stepBadge} aria-hidden="true">3</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>Organise your phrasebooks</h3>
                <p className={styles.stepDesc}>
                  Group your vocabulary any way you like — by language, topic, book, or trip.
                  Each phrasebook is its own collection, making it easy to focus on what matters
                  right now.
                </p>
              </div>
            </li>
            <li className={styles.step}>
              <div className={styles.stepBadge} aria-hidden="true">4</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>Review &amp; master</h3>
                <p className={styles.stepDesc}>
                  When you're ready, flip through flashcards tailored to your current knowledge.
                  WordSprout tracks how well you know each word and serves up the ones you need
                  to practise most — so every review session counts.
                </p>
              </div>
            </li>
          </ol>
        </section>

        {/* ── Why WordSprout ───────────────────────────────────── */}
        <section className={styles.section}>
          <p className={styles.sectionLabel}>Why WordSprout</p>
          <h2 className={styles.sectionTitle}>Built for real learning</h2>
          <p className={styles.sectionBody}>
            WordSprout is designed around the way people actually learn — a little bit, every day.
          </p>
          <div className={styles.featuresGrid} role="list">
            <div className={styles.featureCard} role="listitem">
              <div className={`${styles.featureIcon} ${styles.featureIconBrand}`} aria-hidden="true">
                📱
              </div>
              <h3 className={styles.featureTitle}>Works offline</h3>
              <p className={styles.featureDesc}>
                Your vocabulary travels with you. WordSprout works fully without an internet
                connection and syncs quietly in the background when you're back online.
              </p>
            </div>
            <div className={styles.featureCard} role="listitem">
              <div className={`${styles.featureIcon} ${styles.featureIconAccent}`} aria-hidden="true">
                🤖
              </div>
              <h3 className={styles.featureTitle}>AI-powered context</h3>
              <p className={styles.featureDesc}>
                Understanding a word in isolation is hard. WordSprout's AI enrichment adds rich
                context — examples, synonyms, notes — so the word actually sticks.
              </p>
            </div>
            <div className={styles.featureCard} role="listitem">
              <div className={`${styles.featureIcon} ${styles.featureIconSuccess}`} aria-hidden="true">
                🧠
              </div>
              <h3 className={styles.featureTitle}>Adaptive flashcards</h3>
              <p className={styles.featureDesc}>
                The review engine adapts to you. Words you struggle with come back more often;
                words you know well step aside. Efficient, focused practice every time.
              </p>
            </div>
            <div className={styles.featureCard} role="listitem">
              <div className={`${styles.featureIcon} ${styles.featureIconWarning}`} aria-hidden="true">
                🔒
              </div>
              <h3 className={styles.featureTitle}>Private by design</h3>
              <p className={styles.featureDesc}>
                Your vocabulary is yours. WordSprout stores your data securely in the EU and never
                shares or sells it. No ads, no tracking.
              </p>
            </div>
          </div>
        </section>
        {/* ── About the maker ────────────────────────────────── */}
        <section className={styles.section}>
          <p className={styles.sectionLabel}>The maker</p>
          <h2 className={styles.sectionTitle}>Made with ❤️, completely free</h2>
          <p className={styles.sectionBody}>
            WordSprout is a passion project built by{' '}
            <a
              href="https://richmondweb.it"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.inlineLink}
            >
              Riccardo
            </a>
            {' '}(
            <a
              href="https://github.com/rickystream94"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.inlineLink}
            >
              @rickystream94
            </a>
            ), a software engineer and lifelong language enthusiast. As someone who has spent years
            learning languages and scribbling vocabulary into notebooks, he wanted a smarter, more
            delightful way to do it — so he built one.
          </p>
          <p className={styles.sectionBody} style={{ marginTop: 'var(--space-4)' }}>
            WordSprout is <strong>100% free</strong> to use. There are no subscriptions,
            no premium tiers, no ads — just a clean tool built for people who love words.
          </p>

          {/* BuyMeACoffee support banner */}
          <a
            href="https://buymeacoffee.com/rickystream94"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.bmacBanner}
            aria-label="Support WordSprout on Buy Me a Coffee"
          >
            <div className={styles.bmacText}>
              <span className={styles.bmacTitle}>☕ Enjoying WordSprout?</span>
              <span className={styles.bmacDesc}>
                If WordSprout has helped you learn even one new word, consider buying Riccardo a
                coffee. It keeps the project alive and caffeinated.
              </span>
            </div>
            <img
              src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
              alt="Buy Me A Coffee"
              className={styles.bmacBtn}
            />
          </a>
        </section>

        {/* ── Found a problem? ───────────────────────────────── */}
        <div className={styles.issuesBanner} role="complementary" aria-label="Report a problem">
          <span className={styles.issuesIcon} aria-hidden="true">🐛</span>
          <div className={styles.issuesBody}>
            <h2 className={styles.issuesTitle}>Found a problem?</h2>
            <p className={styles.issuesDesc}>
              Something not working as expected, or have a suggestion? Open an issue on GitHub
              and let us know — we read every report.
            </p>
          </div>
          <a
            href="https://github.com/rickystream94/wordsprout/issues"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.issuesLink}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>
            Open an issue
          </a>
        </div>
        {/* ── CTA ──────────────────────────────────────────────── */}
        <div className={styles.cta} role="complementary" aria-label="Get started">
          <div className={styles.ctaEmoji} aria-hidden="true">🌱</div>
          <h2 className={styles.ctaTitle}>
            {isAuthenticated ? 'Welcome back!' : 'Ready to grow your vocabulary?'}
          </h2>
          <p className={styles.ctaBody}>
            {isAuthenticated
              ? "Head back to your phrasebooks and keep building your vocabulary."
              : "WordSprout is free to try. Sign in with your Microsoft or Google account and start your first phrasebook in minutes."}
          </p>
          <Link
            to={isAuthenticated ? '/' : '/login'}
            className={styles.ctaBtn}
          >
            {isAuthenticated ? '← Back to my phrasebooks' : 'Get started — it\'s free'}
          </Link>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <Link to="/privacy" className={styles.footerLink}>Privacy Policy</Link>
        <span aria-hidden="true" className={styles.footerSep}>·</span>
        <Link to="/terms" className={styles.footerLink}>Terms &amp; Conditions</Link>
      </footer>
    </div>
  );
}
