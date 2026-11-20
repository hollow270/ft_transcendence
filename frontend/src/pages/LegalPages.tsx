import { ReactNode, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark, LegalLinks, Wordmark } from '../components';

const LAST_UPDATED = '20 November 2026';
const REPOSITORY_URL = 'https://github.com/hollow270/ft_transcendence';

function LegalLayout({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  useEffect(() => {
    document.title = title + ' · GO VIRUS';
    window.scrollTo(0, 0);
  }, [title]);

  return (
    <div className="min-h-screen bg-ink text-slate-300">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandMark className="h-8 w-8" />
          <Wordmark />
        </Link>
        <Link to="/" className="text-link text-sm">
          Back to GO VIRUS
        </Link>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-6 pb-20 pt-6">
        <h1 className="display text-[36px] text-white">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">Last updated {LAST_UPDATED}</p>
        <p className="mt-6 text-[15px] leading-7 text-slate-300">{intro}</p>
        <div className="mt-10 space-y-10">{children}</div>
      </main>

      <footer className="border-t hairline">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-6 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>GO VIRUS is a student project built for ft_transcendence at 42.</p>
          <LegalLinks />
        </div>
      </footer>
    </div>
  );
}

function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-7 text-slate-300">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-slate-500">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

function ContactSection() {
  return (
    <LegalSection title="Contact">
      <p>
        Questions about this page, or a request about your data, can be sent to the team through the project
        repository at{' '}
        <a className="text-link" href={REPOSITORY_URL} target="_blank" rel="noreferrer">
          github.com/hollow270/ft_transcendence
        </a>
        .
      </p>
    </LegalSection>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      intro="GO VIRUS lets people check files and links against several security engines and discuss the results. This page explains what we keep about you, why, who else sees it, and how you can remove it."
    >
      <LegalSection title="What we collect">
        <BulletList
          items={[
            <>
              <strong className="text-white">Your account:</strong> username, email address and a salted scrypt hash
              of your password. We never store the password itself. If you turn on two-factor authentication, the
              secret is stored encrypted.
            </>,
            <>
              <strong className="text-white">Your sessions:</strong> a hash of each sign-in token, the browser name
              sent with it, and when it was last used. Sessions expire after seven days.
            </>,
            <>
              <strong className="text-white">What you submit:</strong> the file name, size, type and SHA-256 hash of a
              file, or the address of a link, together with the scan results and whether the submission is public or
              private.
            </>,
            <>
              <strong className="text-white">What you write:</strong> comments, replies, community verdicts, votes,
              and reports about comments.
            </>,
            <>
              <strong className="text-white">Notifications and API use:</strong> the notifications we send you, the
              hash and prefix of your API keys, and a log of API requests (route, status and time).
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="What we do not keep">
        <BulletList
          items={[
            'The content of an uploaded file is used only for the analysis. It is not saved after the analysis finishes and is never kept longer than 24 hours.',
            'Questions you ask the AI assistant and the answers it gives are not stored. We only count usage: the provider, the model, the number of tokens and how long the answer took.',
            'We do not use advertising or tracking cookies, and we do not sell your data.',
          ]}
        />
      </LegalSection>

      <LegalSection title="Public and private submissions">
        <p>
          Submissions are public by default. A public file or link, its scan results and the comments on it can be
          seen by other people, found in search and returned by the public API. Signed-in users can mark a file as
          private. Private files are scanned only by our own engine, are never sent to outside services, and do not
          appear in search, in community pages or in the API. Administrators see private activity only as anonymous
          totals.
        </p>
        <p>
          If you submit a file that someone else already made public, you may be shown the existing public result.
          This never reveals that you submitted it.
        </p>
      </LegalSection>

      <LegalSection title="Who else receives data">
        <BulletList
          items={[
            <>
              <strong className="text-white">VirusTotal</strong> receives public files and links so that its engines
              can analyse them. Anything sent there falls under VirusTotal's own terms and may be seen by its
              customers.
            </>,
            <>
              <strong className="text-white">The AI provider</strong> configured for the assistant receives the scan
              details you ask it to explain, so that it can write the explanation.
            </>,
            'We share nothing else with third parties, except when the law requires it.',
          ]}
        />
      </LegalSection>

      <LegalSection title="Cookies and local storage">
        <p>
          After you sign in, your browser keeps one session token in its local storage so that you stay signed in.
          Signing out removes it. We use no analytics or advertising cookies.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <BulletList
          items={[
            'Change your username and email, or sign out of any session, from Profile & sessions.',
            'Edit or delete your own comments at any time.',
            'Choose private mode for files you do not want shared.',
            'Delete your own submissions from your history.',
            'Revoke an API key whenever you like.',
            'Delete your account from Profile & sessions. Your sign-in details, keys and two-factor secret are removed, and your name and email are replaced with anonymous values. Comments you wrote stay in place, shown under that anonymous name.',
          ]}
        />
      </LegalSection>

      <LegalSection title="How we protect it">
        <p>
          Connections use HTTPS and pass through a web application firewall. Passwords are hashed with a salt, two-factor
          authentication is available, the secrets the application needs are held in HashiCorp Vault, and sign-in and
          account routes are rate limited. No system is perfectly safe, so please use a strong, unique password.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          If we change this policy we will update the date at the top of the page. Continuing to use GO VIRUS after a
          change means you accept the new version.
        </p>
      </LegalSection>

      <ContactSection />
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      intro="By using GO VIRUS you agree to these terms. If you do not agree, please do not use the service."
    >
      <LegalSection title="What GO VIRUS is">
        <p>
          GO VIRUS is a free service that checks files and links with several security engines, keeps the results,
          and lets signed-in users discuss them. It is a student project built for ft_transcendence at 42 and is
          provided as it is, with no promise that it will always be available.
        </p>
      </LegalSection>

      <LegalSection title="Scan results are not a guarantee">
        <p>
          Engines can miss real threats and can flag harmless files. A clean result does not prove that a file or link
          is safe, and a detection does not prove that it is dangerous. Use your own judgement and keep your own
          protection in place. Explanations written by the AI assistant are for information only and can contain
          mistakes.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <BulletList
          items={[
            'You must give a real email address and keep your sign-in details to yourself.',
            'You are responsible for what happens under your account, including actions taken with your API keys.',
            'You can delete your account at any time from Profile & sessions.',
          ]}
        />
      </LegalSection>

      <LegalSection title="What you may submit">
        <p>
          You may upload files, including suspected malware, and submit links in order to have them analysed. Do not
          submit files that contain private or confidential information in public mode, because public submissions
          and their results can be seen by others and shared with VirusTotal. Use private mode for files you want
          kept local.
        </p>
        <p>You may only submit content that you have the right to submit.</p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>You agree not to:</p>
        <BulletList
          items={[
            'use the service to attack, harass or harm anyone, or to spread malware;',
            'try to bypass limits, probe or overload the service, or gain access you were not given;',
            'run automated requests outside the public API, or use one API key on behalf of many people;',
            'post comments that are unlawful, hateful, misleading or spam;',
            'impersonate another person or misuse another person’s account.',
          ]}
        />
      </LegalSection>

      <LegalSection title="Community content and moderation">
        <p>
          You own what you write, and you allow GO VIRUS to display it to other users as part of the discussion on a
          public submission. Anyone can report a comment. Moderators may hide or remove comments, and may restrict
          commenting, when these terms are broken.
        </p>
      </LegalSection>

      <LegalSection title="The public API">
        <p>
          API access needs a personal key, which you must keep secret. Requests are rate limited, and a key that is
          abused can be revoked.
        </p>
      </LegalSection>

      <LegalSection title="Suspending accounts">
        <p>
          Administrators may disable an account, revoke its sessions and keys, or remove content when these terms are
          broken or when security requires it.
        </p>
      </LegalSection>

      <LegalSection title="Liability">
        <p>
          GO VIRUS is provided without warranties of any kind. To the extent the law allows, the team is not liable
          for loss or damage that results from using the service or relying on its results.
        </p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>
          We may update these terms. The date at the top shows the latest version, and continuing to use the service
          means you accept it. How we handle your data is described in the{' '}
          <Link className="text-link" to="/privacy">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <ContactSection />
    </LegalLayout>
  );
}
