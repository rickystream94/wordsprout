import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import styles from './PrivacyPolicy.module.css';

export default function PrivacyPolicy() {
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
          <h1 className={styles.title}>Privacy Policy</h1>
          <p className={styles.lastUpdated}>Last updated: April 2026</p>
        </header>

        <section className={styles.section}>
          <h2>1. Who We Are</h2>
          <p>
            WordSprout is a personal vocabulary phrasebook application that helps language learners
            capture, organise, and review vocabulary encountered in everyday life. The service is
            operated by{' '}
            <a href="https://richmondweb.it" target="_blank" rel="noopener noreferrer">Richmond Web</a>
            {' '}(<a href="https://github.com/rickystream94" target="_blank" rel="noopener noreferrer">@rickystream94</a>).
            Contact:{' '}
            <a href="mailto:rickystream94@gmail.com">rickystream94@gmail.com</a>.
          </p>
        </section>

        <section className={styles.section}>
          <h2>2. What Data We Collect</h2>
          <p>We collect and process the following personal data when you use WordSprout:</p>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Data type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Account information</strong></td>
                <td>
                  Your email address and display name, received from your identity provider
                  (Microsoft or Google) at sign-in. We do not receive or store your password.
                </td>
              </tr>
              <tr>
                <td><strong>Vocabulary data</strong></td>
                <td>
                  Phrasebooks, vocabulary entries, translations, notes, tags, and part-of-speech
                  labels that you create in the app.
                </td>
              </tr>
              <tr>
                <td><strong>Learning progress</strong></td>
                <td>
                  Learning scores, review dates, and progress history associated with your
                  vocabulary entries.
                </td>
              </tr>
              <tr>
                <td><strong>AI enrichment data</strong></td>
                <td>
                  When you request AI-powered enrichment (e.g., example sentences, synonyms), the
                  text of your vocabulary entry is sent to an AI processing service to generate the
                  enrichment. This data is not retained by the AI provider beyond the duration of
                  the request.
                </td>
              </tr>
              <tr>
                <td><strong>Usage quotas</strong></td>
                <td>
                  A daily counter tracking your use of AI enrichment features, used to enforce
                  fair-use limits.
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className={styles.section}>
          <h2>3. Why We Collect Your Data</h2>
          <p>We process your data to:</p>
          <ul>
            <li>Provide and operate the WordSprout vocabulary management service.</li>
            <li>Sync your vocabulary data across your devices.</li>
            <li>Deliver AI-powered enrichment features when you request them.</li>
            <li>Enforce fair-use limits on AI features.</li>
          </ul>
          <p>
            The legal basis for processing is the performance of the service you have agreed to use
            (contractual basis).
          </p>
        </section>

        <section className={styles.section}>
          <h2>4. How We Store Your Data</h2>
          <p>Your data is stored in two places:</p>
          <ul>
            <li>
              <strong>On your device</strong>: In your browser's local storage, enabling offline
              access to your vocabulary.
            </li>
            <li>
              <strong>In the cloud</strong>: On secure servers hosted on Microsoft Azure in the
              European Union (North Europe region), enabling cross-device sync and backup. Your data
              does not leave the EU.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>5. Who We Share Your Data With</h2>
          <p>
            We do not sell or share your personal data with third parties for advertising or
            commercial purposes.
          </p>
          <p>We use the following third-party service providers to operate WordSprout:</p>
          <ul>
            <li>
              <strong>Microsoft Azure</strong> – Cloud infrastructure and identity provider.
              Microsoft processes your data as a sub-processor in accordance with{' '}
              <a
                href="https://privacy.microsoft.com/privacystatement"
                target="_blank"
                rel="noopener noreferrer"
              >
                Microsoft's Privacy Statement
              </a>
              .
            </li>
            <li>
              <strong>Azure OpenAI Service</strong> – AI-powered vocabulary enrichment. Your
              vocabulary entry text is transmitted to this service only when you explicitly request
              enrichment. The provider does not retain request data.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>6. How Long We Keep Your Data</h2>
          <p>
            We retain your personal data for as long as your WordSprout account is active.
          </p>
          <p>
            If you delete your account (see Section 7), all your personal data is permanently
            deleted from our cloud systems immediately, and you will be signed out. Local data
            stored on your device is also cleared at the time of deletion.
          </p>
        </section>

        <section className={styles.section}>
          <h2>7. Your Rights</h2>
          <p>You have the following rights regarding your personal data:</p>
          <ul>
            <li>
              <strong>Right of access</strong>: You may request a summary of the personal data we
              hold about you.
            </li>
            <li>
              <strong>Right to erasure</strong>: You may permanently delete your account and all
              associated data at any time via the account settings in the app.
            </li>
            <li>
              <strong>Right to rectification</strong>: You may update or correct your vocabulary
              data at any time within the app.
            </li>
            <li>
              <strong>Right to data portability</strong>: You may request an export of your
              vocabulary data by contacting us.
            </li>
            <li>
              <strong>Right to object</strong>: You may object to processing by ceasing to use the
              service and deleting your account.
            </li>
          </ul>
          <p>
            To exercise any right not available directly in the app, contact us at:{' '}
            <a href="mailto:rickystream94@gmail.com">rickystream94@gmail.com</a>.
          </p>
        </section>

        <section className={styles.section}>
          <h2>8. Cookies and Local Storage</h2>
          <p>
            WordSprout uses browser local storage and cookies only for essential functions:
            maintaining your authentication session and enabling offline access to your data. We do
            not use advertising, tracking, or analytics cookies.
          </p>
        </section>

        <section className={styles.section}>
          <h2>9. Children's Privacy</h2>
          <p>
            WordSprout is not intended for users under the age of 16. We do not knowingly collect
            personal data from children. If you believe a child has provided us with data, please
            contact us so we can delete it.
          </p>
        </section>

        <section className={styles.section}>
          <h2>10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. The "Last updated" date at the top
            of this page will reflect the most recent changes. Your continued use of WordSprout
            after a policy update constitutes acceptance of the revised policy.
          </p>
        </section>

        <section className={styles.section}>
          <h2>11. Contact</h2>
          <p>
            For privacy-related enquiries or to exercise your data rights, contact:{' '}
            <a href="mailto:rickystream94@gmail.com">rickystream94@gmail.com</a>
          </p>
        </section>

        <nav>
          <Link to="/terms">View Terms and Conditions</Link>
        </nav>
      </div>
    </div>
  );
}
