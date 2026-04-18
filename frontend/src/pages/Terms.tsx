import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import styles from './Terms.module.css';

export default function Terms() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  function handleBack(e: React.MouseEvent) {
    e.preventDefault();
    if (isAuthenticated) {
      navigate(-1);
    } else {
      navigate('/login');
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <a href="#" className={styles.backLink} onClick={handleBack}>
          ← Back
        </a>

        <header className={styles.header}>
          <h1 className={styles.title}>Terms and Conditions</h1>
          <p className={styles.lastUpdated}>Last updated: April 2026</p>
        </header>

        <section className={styles.section}>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By using WordSprout you agree to these Terms and Conditions ("Terms"). If you do not
            agree, please do not use the app.
          </p>
        </section>

        <section className={styles.section}>
          <h2>2. Description of Service</h2>
          <p>
            WordSprout is a personal vocabulary phrasebook application that allows you to capture,
            organise, and review foreign language vocabulary. The service includes optional
            AI-powered features to enrich vocabulary entries. WordSprout is provided primarily for
            personal, non-commercial use.
          </p>
        </section>

        <section className={styles.section}>
          <h2>3. Eligibility</h2>
          <p>
            You must be at least 16 years old to use WordSprout. By signing in you confirm that you
            meet this requirement. If you are under 16, you are not permitted to use the service.
          </p>
        </section>

        <section className={styles.section}>
          <h2>4. Access</h2>
          <p>
            WordSprout is an invite-only service. Access is granted at the discretion of the
            service operator. The operator reserves the right to grant, suspend, or revoke access
            at any time, with or without notice.
          </p>
        </section>

        <section className={styles.section}>
          <h2>5. Your Content</h2>
          <p>
            All vocabulary data you create in WordSprout — including phrasebooks, entries,
            translations, notes, and tags — remains your property. We do not claim any ownership
            over your content. You are solely responsible for the content you add to the app,
            including ensuring it does not violate any applicable laws.
          </p>
        </section>

        <section className={styles.section}>
          <h2>6. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>
              Use WordSprout for any unlawful purpose or in violation of any applicable regulations.
            </li>
            <li>
              Attempt to reverse-engineer, decompile, or disrupt the service or its underlying
              infrastructure.
            </li>
            <li>
              Introduce malicious code, automated scripts, or bots that abuse the service or its
              AI features.
            </li>
            <li>Attempt to access another user's account or data.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>7. AI Features</h2>
          <p>
            WordSprout provides optional AI-powered features (e.g., example sentences, synonyms)
            to enrich vocabulary entries. AI-generated content is provided for informational and
            educational purposes only. It may not always be accurate, complete, or appropriate. You
            are responsible for verifying AI-generated suggestions before relying on them.
          </p>
          <p>
            Use of AI features is subject to fair-use limits. Exceeding daily limits will
            temporarily restrict AI feature access.
          </p>
        </section>

        <section className={styles.section}>
          <h2>8. Service Availability</h2>
          <p>
            WordSprout is provided on a best-efforts basis. We do not guarantee uninterrupted
            availability, error-free operation, or that the service will meet your specific
            requirements. We may modify, suspend, or discontinue any part of the service at any
            time without prior notice.
          </p>
        </section>

        <section className={styles.section}>
          <h2>9. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by applicable law, the operator of WordSprout is not
            liable for any direct, indirect, incidental, or consequential loss or damage arising
            from:
          </p>
          <ul>
            <li>Your use of, or inability to use, the service.</li>
            <li>Loss or corruption of vocabulary data.</li>
            <li>Reliance on AI-generated content.</li>
            <li>Unauthorised access to your data.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>10. Termination</h2>
          <p>
            You may stop using WordSprout and delete your account at any time via the account
            settings in the app. The operator may terminate your access at any time if you violate
            these Terms.
          </p>
          <p>
            Upon account deletion, all your personal data stored by WordSprout will be permanently
            erased as described in the Privacy Policy.
          </p>
        </section>

        <section className={styles.section}>
          <h2>11. Intellectual Property</h2>
          <p>
            The WordSprout application, including its design, code, and branding, is owned by the
            service operator. Nothing in these Terms grants you any right to use the WordSprout
            name, logo, or intellectual property other than to use the service as intended.
          </p>
        </section>

        <section className={styles.section}>
          <h2>12. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. The "Last updated" date at the top
            reflects the most recent revision. Continued use of WordSprout after a change to these
            Terms constitutes your acceptance of the revised Terms.
          </p>
        </section>

        <section className={styles.section}>
          <h2>13. Governing Law</h2>
          <p>
            These Terms are governed by and construed in accordance with the laws of Denmark. Any
            disputes will be subject to the exclusive jurisdiction of the courts of Denmark.
          </p>
        </section>

        <section className={styles.section}>
          <h2>14. Contact</h2>
          <p>
            For enquiries regarding these Terms, contact:{' '}
            <a href="mailto:rickystream94@gmail.com">rickystream94@gmail.com</a>
          </p>
        </section>

        <nav>
          <Link to="/privacy">View Privacy Policy</Link>
        </nav>
      </div>
    </div>
  );
}
