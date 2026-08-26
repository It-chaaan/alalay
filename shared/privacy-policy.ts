export const PRIVACY_CONTACT_EMAIL = 'guillermochristian19p@gmail.com';
export const PRIVACY_EFFECTIVE_DATE = 'August 26, 2026';

export type PrivacySection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export const privacySections: PrivacySection[] = [
  {
    title: '1. Introduction',
    paragraphs: [
      `This Privacy Policy explains how Alalay processes information when you use the Alalay web application or mobile application. Alalay is a Filipino-first personal-finance management tool. It is not a bank, lender, investment adviser, tax adviser, legal adviser, or other professional financial adviser. Any scores, summaries, reminders, AI responses, and other insights are informational and are not professional financial, legal, tax, investment, or lending advice.`,
      `This policy describes the current implementation as of ${PRIVACY_EFFECTIVE_DATE}. It is not legal advice and should be reviewed by a qualified privacy professional before publication or use as a complete compliance program.`,
    ],
  },
  {
    title: '2. Information you provide',
    paragraphs: [
      'Depending on the features you use, Alalay processes information you enter or submit, including:',
    ],
    bullets: [
      'Your name, email address, optional phone number, language, currency, pay schedule, and profile image.',
      'Authentication information handled through Supabase Auth, including email/password account details and information returned by Google sign-in. Alalay does not receive or store your password in readable form.',
      'Financial records such as wallets, account types, balances, transfers, income, expenses, bills, subscriptions, budgets, savings goals, loans, repayments, and related dates, categories, notes, and metadata.',
      'Receipt images and the information you provide when reviewing an OCR result. A confirmed expense may retain OCR-extracted text and receipt metadata in its financial record.',
      'Messages and conversation history that you submit to the AI assistant, when you use that feature.',
      'Messages you send to the support or privacy contact address.',
    ],
  },
  {
    title: '3. Information collected automatically',
    paragraphs: [
      'Alalay does not currently use advertising analytics, cross-app tracking, or a separate crash-reporting SDK. The web client uses browser storage for session and presentation preferences, and the mobile client uses platform storage such as SecureStore for session and trusted-device data. The backend and hosting infrastructure may receive ordinary request and security information such as IP address, user-agent, timestamps, route, response status, and error correlation identifiers in operational logs. The exact retention of infrastructure logs depends on the hosting and service configuration and is not currently defined by an Alalay retention schedule.',
    ],
  },
  {
    title: '4. Financial information handled by Alalay',
    paragraphs: [
      'Financial information is the core purpose of the service. Alalay uses it to display account-scoped balances, reports, budgets, reminders, savings progress, loan information, and other requested features. Financial records are stored in the shared Supabase/PostgreSQL data layer and accessed through authenticated application flows. Row-level ownership policies and backend authorization are used, but no online service can guarantee absolute security.',
      'Please do not enter credentials for a bank or other financial institution into ordinary Alalay notes or fields. Alalay is not a bank and does not connect to bank accounts through the code currently audited.',
    ],
  },
  {
    title: '5. Receipt scanning and OCR',
    paragraphs: [
      'The web receipt scanner processes a selected image in the browser with Tesseract.js. The image and OCR result are then used to prepare an expense for your review. The mobile scanner sends the selected JPEG or PNG image to the authenticated Alalay backend, where Tesseract.js extracts text and returns a review candidate. The mobile OCR endpoint reports that the uploaded image is not retained by that endpoint; the implementation does not create a receipt-image storage object.',
      'OCR can be inaccurate. You must review the merchant, date, amount, category, and other fields before saving an expense. Once you confirm an expense, the expense record can include OCR-derived text and metadata. Do not scan documents containing information that is not needed for the expense.',
    ],
  },
  {
    title: '6. AI-powered features',
    paragraphs: [
      'When you use Ask Alalay or another AI feature, the backend may send your message, selected conversation history, language, and relevant account context—such as income, expenses, bills, subscriptions, budgets, savings goals, reports, and wallet-related summaries—to Google Gemini to generate a response. The backend also uses controlled AI actions for certain user-confirmed financial operations. AI responses can be incomplete or wrong and are informational only.',
      'AI processing is optional. You can avoid it by not using the AI feature. Google may process the submitted information under its own terms and policies. Alalay has not verified or configured a promise that Google will not retain or use submitted content for provider purposes, so this policy makes no such promise. Alalay does not place the Gemini API key in the web or mobile client.',
    ],
  },
  {
    title: '7. Camera, photo, and notification permissions',
    paragraphs: [
      'The web scanner requests browser camera access only when you choose to open the camera, and also accepts a selected image. The mobile app requests camera or photo-library access for receipt capture and selection. You can deny these permissions, but receipt capture through the affected method will not work. You can change permissions later in your browser or device settings.',
      'The mobile app can schedule local financial reminders and display in-app notifications. The audited implementation does not register a remote push-notification token with Alalay. Notifications are optional and can be disabled through the device or application notification settings where available.',
    ],
  },
  {
    title: '8. Authentication and trusted devices',
    paragraphs: [
      'Authentication is provided through Supabase Auth using email/password and Google OAuth. The mobile app uses a deep-link callback for authentication. Multi-factor authentication uses authenticator-app TOTP where enabled. Alalay receives authentication identifiers and session information needed to authenticate requests; Supabase handles password verification.',
      'If you choose to remember a trusted device for MFA, the backend stores a hash of a device token with an expiry and may receive the device user-agent. The web client uses a cookie for the trusted-device token, while mobile uses platform storage. Trusted-device access is time-limited and can be cleared by signing out or using the available security controls.',
    ],
  },
  {
    title: '9. How information is used',
    paragraphs: ['Alalay uses information to:'],
    bullets: [
      'Create and secure your account, authenticate requests, and provide the features you request.',
      'Store, organize, calculate, and display your financial records, reports, reminders, and preferences.',
      'Process receipt scans and return OCR results for your review.',
      'Generate optional AI responses and perform user-confirmed AI actions through the backend.',
      'Respond to support, privacy, and account-deletion requests.',
      'Detect abuse, troubleshoot failures, protect the service, and maintain operational reliability.',
      'Send configured transactional or financial reminder notifications. No advertising or sale of personal information is implemented in the audited code.',
    ],
  },
  {
    title: '10. Processing grounds and choices',
    paragraphs: [
      'Depending on the jurisdiction and the activity, processing may be necessary to provide the service you request, based on your actions or consent for optional permissions and features, or supported by operational and security interests that must be balanced against your rights. This notice does not make a jurisdiction-specific legal determination. You can choose not to use optional OCR, AI, camera/photo, or notification features, and you can withdraw device permissions through platform settings.',
    ],
  },
  {
    title: '11. How information is shared',
    paragraphs: [
      'Alalay does not sell your personal information. Information is shared with service providers only as needed to operate the feature or infrastructure involved. This includes authentication, database/storage hosting, backend hosting, email delivery when configured, AI generation when requested, and OCR processing for the applicable scanner flow. We may also disclose information when necessary to comply with law, respond to valid legal process, protect users or the service, investigate abuse, or enforce our rights.',
    ],
  },
  {
    title: '12. Third-party services',
    paragraphs: [
      'The audited implementation uses or is configured to use these providers and technologies:',
    ],
    bullets: [
      'Supabase: authentication, PostgreSQL database, row-level security, and profile-image storage. Information sent to Supabase is needed for account and cloud data features and is subject to Supabase policies and terms.',
      'Google OAuth: optional sign-in through Google. Google processes the authentication information under Google policies and terms.',
      'Google Gemini: optional AI responses and selected financial context. This processing occurs only when the AI feature is used and is subject to Google policies and terms.',
      'Tesseract.js: OCR software used in the browser for web scans and on the backend for mobile scans. It is not an analytics or advertising service.',
      'Expo and EAS: mobile application framework and build/distribution tooling. The audited app does not use Expo as an analytics provider.',
      'Resend: an optional backend email-delivery integration for configured notification emails. It is used only when the server has the relevant configuration and is subject to Resend policies and terms.',
      'Vercel: the frontend includes Vercel deployment configuration. If the web app is deployed there, Vercel may process ordinary hosting and request information under its own terms.',
    ],
  },
  {
    title: '13. Storage and security',
    paragraphs: [
      'Cloud financial and profile data is stored through Supabase, and requests are authenticated through Supabase and the Alalay backend. Database row-level security, server-side validation, HTTPS requirements for production configuration, encrypted mobile credential storage through SecureStore, and limited access patterns are part of the current implementation. These measures reduce risk but do not provide an absolute security guarantee or end-to-end encryption claim.',
      'The web app may store sessions and non-financial presentation preferences in browser storage. Mobile uses SecureStore for native session and trusted-device values, with guarded browser storage for Expo web preview. Do not use a shared or compromised device for sensitive account access.',
    ],
  },
  {
    title: '14. Data retention',
    paragraphs: [
      'Alalay retains account and financial records while they are needed to provide the service, while your account remains active, or as needed for security, dispute handling, legal obligations, or legitimate operational purposes. The implementation does not define one universal deletion or retention period for all data. Mobile receipt image uploads are marked as not retained by the OCR endpoint, but confirmed expenses may retain OCR-derived text. Operational provider logs and third-party retention are controlled partly by those providers’ configurations and policies.',
    ],
  },
  {
    title: '15. Your choices and rights',
    paragraphs: [
      'You can review or correct profile information through the available profile settings, edit or delete individual financial records where the relevant feature supports it, sign out, disable device permissions, avoid optional AI/OCR/notification features, and request access, correction, deletion, restriction, or other rights available under applicable law by contacting us. We may need to verify your identity and may retain information where law or legitimate security needs require it.',
    ],
  },
  {
    title: '16. Account and data deletion',
    paragraphs: [
      'The current application does not provide a complete in-app account-deletion control or an automated deletion workflow. To request account and associated-data deletion, email guillermochristian19p@gmail.com with the subject “Alalay Account Deletion Request”. Do not include passwords, authentication codes, tokens, or financial details in the email. We will use the information needed to verify and process the request and will explain any data that must be retained. This manual process is a current product limitation and must be completed before treating the app as ready for platforms that require in-app account deletion.',
    ],
  },
  {
    title: '17. Children’s privacy',
    paragraphs: [
      'Alalay is intended for adults managing their personal finances and is not directed to children. We do not knowingly design the service to collect personal information from children. If you believe a child has provided information, contact us so we can review the situation.',
    ],
  },
  {
    title: '18. International and cross-border processing',
    paragraphs: [
      'Alalay uses cloud and provider infrastructure that may process information outside the Philippines, depending on provider locations and deployment configuration. Cross-border processing may occur when using Supabase, Google services, Resend, hosting infrastructure, or other providers described above. Provider terms and applicable law may govern those transfers.',
    ],
  },
  {
    title: '19. Policy changes',
    paragraphs: [
      'We may update this policy when the application, providers, or data practices change. We will update the date at the top of the policy and, where appropriate, provide additional notice through the application or another reasonable channel. Continued use after an update means the updated policy will apply to future use, subject to applicable law.',
    ],
  },
  {
    title: '20. Contact information',
    paragraphs: [
      `For privacy questions, access or correction requests, security concerns, account-deletion requests, support, or feedback, email ${PRIVACY_CONTACT_EMAIL}. Please do not send passwords, one-time codes, API keys, complete financial records, or other highly sensitive information by email.`,
    ],
  },
];
