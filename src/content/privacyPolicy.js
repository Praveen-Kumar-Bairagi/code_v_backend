'use strict';

/**
 * Compameet Privacy Policy (website, app, admin).
 * Draft for professional legal review — bracketed [PLACEHOLDER: …] items must be completed
 * and verified before publication. Not a guarantee of legal compliance.
 */
module.exports = `**Effective date:** [PLACEHOLDER: effective date]

This Privacy Policy explains what personal data Compameet collects, why we collect it, who can see it, who we share it with, how long we keep it, and the choices and rights you have. It applies to the Compameet mobile app, the website at compameet.com, and related services (together, the “Services”).

> **In short:** Compameet helps you discover people through daily plans, show mutual interest, and chat in the app. We collect what we need to run those features — your account and profile details, the plans you post, your chats, and (if you allow it) your device location. We do **not** sell your personal data, we do **not** use advertising or third-party analytics tools in the app, and we do **not** collect Aadhaar, PAN or other identity documents.

## 1. WHO WE ARE

The Services are operated by:

- **Operator:** [PLACEHOLDER: legal name of the proprietor / business], a sole proprietorship
- **Trade name:** Compameet
- **Address:** [PLACEHOLDER: registered / principal place of business address]
- **GSTIN (if applicable):** [PLACEHOLDER: GSTIN or “not applicable”]
- **Privacy contact:** privacy@compameet.com
- **Grievance Officer:** [PLACEHOLDER: name and designation of Grievance Officer], grievance@compameet.com

In this policy, “Compameet”, “we”, “us” and “our” mean the operator named above.

### Laws that apply to this policy

- **Today:** we handle personal data under the **Information Technology Act, 2000** (including Section 43A) and the **Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011** (“SPDI Rules”). This policy is published as required by Rule 4 of the SPDI Rules.
- **From 13 May 2027:** the main obligations and rights under the **Digital Personal Data Protection Act, 2023** (“DPDP Act”) and the **Digital Personal Data Protection Rules, 2025** come into force under Government notifications G.S.R. 843(E) and G.S.R. 846(E) dated 13 November 2025. From then, Compameet will be the **Data Fiduciary** for the personal data described here and you will be the **Data Principal**, and Section 43A and the SPDI Rules will cease to apply. We will update this policy before that date.
- Platform obligations for content posted by users are set by the **Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021**, as amended (“IT Rules”).

## 2. WHAT COMPAMEET IS (AND IS NOT)

Compameet is an online platform for discovery and communication. You can post a plan for today (for example coffee, a movie or a walk) with an area, see plans from people nearby, tap Interested or Not interested, and chat in the app.

Compameet is **not** a dating service and **not** an offline meeting or booking service. We do not arrange, attend or supervise meetings. Whether you meet anyone is your own decision.

## 3. PERSONAL DATA WE COLLECT

We only describe below the data that the Services actually collect today.

### 3.1 Account and sign-up details

- **Mobile number**, verified with a one-time password (OTP) sent by SMS; **or** your **Google account** details (name, email address and a Google account identifier) if you choose “Continue with Google”. Google sign-in is handled through Google Firebase Authentication.
- **First name and last name.**
- **Gender** and **date of birth** — used to apply our age rules and to show your age.
- **Religion** — required at sign-up, shown on your profile, and can only be set once in the app. Religion may be considered sensitive information. Please choose the option you are comfortable sharing publicly.
- **City** (required) and **PIN code** (optional).
- **Email address** (optional for mobile sign-ups; taken from Google for Google sign-ups).
- The date and time you **accepted our Terms** at sign-up, and when you accepted plan terms when posting a plan.

### 3.2 Profile details you choose to add

- **Profile photos** you upload from your gallery or camera.
- **Bio (About me)** — reviewed by our team before it is shown to others.
- Education, profession, drinking, smoking, eating habits, relationship status, what you are looking for, and interests.
- Your privacy and notification settings (for example Hide age, Hide distance, Hide work, Hide lifestyle, Pause profile, Hide read receipts, Hide typing).

### 3.3 Plans, interest and activity

- Plans you post (plan type, area, who can see it, status and time).
- Your Interested / Not interested responses, likes and passes in Discover, profile views needed to run these features, and members you block.
- Coins balance and coin transactions, membership (subscription) purchases, and voucher redemptions.
- In-app notifications we send you.

### 3.4 Chat messages

- Messages you send and receive in Compameet chat, including in-chat game moves, are stored on our servers so that both members can see the conversation.
- **Text messages are end-to-end encrypted** when both members use the current version of the Compameet app. A message is encrypted on the sender’s device and can be decrypted only on the sender’s and the recipient’s own devices. Each device creates its own encryption key, and the private part of that key never leaves the device. Our servers store and deliver only the encrypted message; Compameet does not have the keys, so neither our servers nor our staff can read these messages.
- **Not end-to-end encrypted — in-chat game cards and chat-theme notices**, which are created by our servers.
- **Not end-to-end encrypted — messages sent the earlier way:** messages sent before end-to-end encryption was introduced, messages exchanged with a member who is still using an older version of the app, and messages the app could not filter on the device (see section 3.4A). Our servers can read these messages; their text is **encrypted by our application** (AES-256-GCM) before it is saved, with the key held by Compameet.
- **Not end-to-end encrypted — chat metadata**, such as who is chatting with whom, when messages are sent, how many messages there are, read status, and the public keys of your devices.
- **Notifications:** for end-to-end encrypted messages, the push notification shows only the sender’s name and “New message”; no message text is sent to our push notification providers. For messages sent the earlier way, a preview of the filtered text (up to about 180 characters) is passed to those providers (see section 8).
- **Your keys and devices:** your encryption key is stored on your device (on the website version, in your browser’s storage). If you sign in on a new device, reinstall the app or clear its data, end-to-end encrypted messages from before cannot be read on that device, and **we cannot recover them**. Messages appear in readable form on the devices of the people in the chat, and the app keeps a short copy of your chat list on your device until you log out.
- The app does not yet let you check the other member’s security key yourself (for example by comparing a code), so it relies on our servers to provide the correct device keys.

### 3.4A Automated chat filter

Every text message is checked by an automated filter before it is sent. For end-to-end encrypted messages, the filter runs **on the sender’s device, before the message is encrypted**, using a list of checks and words that the app downloads from us. For messages sent the earlier way, the filter runs on our servers. The filter looks for:

- **Contact information:** phone numbers and email addresses;
- **Social media and external contact:** social media and messaging platform names, usernames or handles, web links, and additional words our team adds to the filter;
- **Abusive language** in English, Hindi and Hinglish, in five categories: profanity, insults, harassment, hate speech, and threats.

Our team can turn individual checks on or off and add or allow specific words. The filter works on words and patterns; it does not understand every context and can both miss content and flag harmless content.

When the filter detects something:

- the message is **still delivered**, but the matched words are **replaced with asterisks** (*) for the recipient — the message is not blocked or rejected;
- for end-to-end encrypted messages, only the filtered version is encrypted and sent; the **original, unfiltered text is not sent to us** and we do not store it;
- for messages sent the earlier way, we keep the **original, unfiltered text**, encrypted by our application like other such messages. It is not shown in our admin panel; it is included only in a report snapshot if a member reports the conversation;
- we record a **moderation log** with the sender, conversation, detected categories, number of matches, severity and review status. For end-to-end encrypted messages, these details are reported by the sender’s app. The log does not contain the message text;
- for more serious abuse, the sender’s violation count is increased, and **threats and hate speech** are placed in a queue for review by our team;
- after review, our team may dismiss the flag, send the sender a warning, or suspend the sender’s chat access. Chat access is **not** suspended automatically by the filter.

Because the filter for end-to-end encrypted messages runs on the sender’s device, we cannot check its result on our servers, and a modified app could avoid it. Please report anyone who shares contact details or sends abusive messages.

### 3.5 Reports, blocks and support

- When you report a member, we store the reason, any details you provide, and a **snapshot** of the reported profile (name, gender, date of birth, bio, profession, city and photo references) and, if the report is made from a chat, up to the **last 300 messages** of that conversation, so our team can review it.
- For end-to-end encrypted messages, **your app decrypts the messages it can read on your device and sends them with your report**. Our team sees that this text was shared from the reporter’s device; we cannot confirm it against the encrypted original. For messages sent the earlier way, we copy the text from our servers, including the original text of any filtered messages.
- The report snapshot is stored separately from the chat and is **not** encrypted by our application or end-to-end encrypted.
- When you block or unmatch a member, any chat conversation between you, including the encrypted messages, is **deleted for both of you** and no longer appears in the app. As required by law, we keep a hidden copy for 180 days (see section 9).
- Emails and complaints you send to support@compameet.com, grievance@compameet.com or privacy@compameet.com, and our responses.
- If you apply for the creator programme, the email address, phone number and note you submit with that request.

### 3.6 Location

- If you allow location access on your device, the app reads your **precise device location (latitude and longitude)** while the app is open and sends it to our servers when you open the app and about every five minutes while you keep using it. We store the **most recent** location and the time it was updated (each update replaces the previous one).
- The app does **not** collect your location in the background when the app is closed, and does not request background location permission.
- Your device’s own location service may be used to suggest your city during sign-up or when posting a plan.
- If you decline location permission, Compameet still works using the city and area you choose, but distance and nearby results may be less accurate.

### 3.7 Device and technical data

- For each logged-in device: device name, platform (for example Android or iOS), app version, browser or app user-agent, and when the session was last active. You can see and sign out of these devices in Settings.
- A **push notification token** for your device, if you allow notifications.
- When you use the Services, our servers and hosting provider may record technical logs such as **IP address**, request time and the API endpoint used, for security, debugging and abuse prevention.
- For each logged-in device, we record the **IP address used to sign in and the most recent IP address** seen, with the device name, platform, app version and time. These are not shown to other members. We use them for account security, fraud prevention and to respond to lawful requests from authorities.
- When we send an OTP, we keep a log of the SMS (mobile number, purpose, delivery status and gateway response). The OTP code itself is not stored in this log.

### 3.8 Payment data

- Memberships and coin packs are paid through **Razorpay**. We receive and store the order and payment reference, amount, item purchased, status and time.
- We do **not** receive or store your full card number, CVV, net-banking password or UPI PIN. These are handled by Razorpay under its own privacy policy.

### 3.9 What we do NOT collect

- We do **not** access your contacts, call logs, SMS inbox, microphone or files beyond the photos you choose to upload.
- We do **not** collect Aadhaar, PAN, passport or other identity documents, and we do **not** carry out KYC.
- We do **not** use automated face matching or biometric verification. A “verified” badge, where shown, is assigned by our team and is **not** a guarantee of identity — see our Terms.
- We do **not** use third-party advertising IDs, advertising SDKs or third-party analytics SDKs in the app.
- Under the SPDI Rules, “sensitive personal data” means passwords, financial information such as bank account, card or other payment instrument details, health information, sexual orientation, medical records and biometric information. In the current version of the Services we do not ask for or store any of these: there are no user passwords (sign-in is by OTP or Google), card and bank details are handled by Razorpay, and we do not ask about health, sexual orientation or biometrics. Religion, which we do collect, is not “sensitive personal data” under the SPDI Rules, but we treat it with care because it is personal.

## 4. MANDATORY AND OPTIONAL DATA

- **Required to create an account:** a verified mobile number or a Google account, first and last name, gender, date of birth, religion, city, and acceptance of our Terms.
- **Required to complete your profile:** the minimum number of profile photos and interests shown in the app.
- **Optional:** email (for mobile sign-ups), PIN code, bio, education, profession, lifestyle details, relationship status, what you are looking for, device location, and push notifications.
- **Generated automatically when you use the Services:** plans, interest and like activity, chats, coin and payment records, device sessions and technical logs.

If you do not provide required data, we cannot create or operate your account.

## 5. HOW WE USE YOUR DATA

We use personal data to:

- create and secure your account, send OTPs, and keep you logged in on your devices;
- show your profile and plans to other members, and show you plans and people nearby (in your city and within about 50 km);
- calculate approximate distance between members and send plan, interest, like and chat notifications;
- deliver chat messages and in-chat games;
- process memberships, coin packs and vouchers, and keep payment records;
- apply our age rules and Community Guidelines, review bios and photos, filter chats, handle reports and blocks, and prevent fraud, spam, multiple-account abuse and evasion of bans;
- respond to support requests, complaints and grievances;
- send service messages (for example about your account, purchases, safety or changes to our policies);
- comply with law, lawful requests from authorities, and to establish or defend legal claims.

We do **not** use your personal data for third-party advertising, and we do **not** sell it.

## 6. LEGAL BASIS FOR PROCESSING

We process your personal data:

- on the basis of your **consent**, which you give when you sign up and accept this Privacy Policy and our Terms, and when you grant device permissions such as location, camera, photos and notifications;
- where processing is **necessary to comply with law**, including the IT Act, the IT Rules, tax laws, and lawful requests from authorities; and
- from 13 May 2027, also for the **legitimate uses** allowed by Section 7 of the DPDP Act, such as complying with law or a court order and responding to a medical emergency or a threat to someone’s life or safety.

[PLACEHOLDER: lawyer to confirm whether the current sign-up consent meets the DPDP Act and Rules standard for a standalone, itemised consent notice before 13 May 2027.]

You can withdraw consent at any time (see section 10). Withdrawing consent does not affect processing that already happened, and we may not be able to provide the Services without data that is required to operate your account.

## 7. WHO CAN SEE YOUR INFORMATION

### Other members

Other members who see your profile or plan may see your first and last name, photos, gender, age (unless you turn on Hide age), city, approved bio, interests, religion, relationship status, what you are looking for, education and profession (unless you turn on Hide work), lifestyle details (unless you turn on Hide lifestyle), your approximate distance (unless you turn on Hide distance), any badges, and your active plan. Members you chat with see the messages you send them.

Other members do **not** see your mobile number or email address.

Please share only what you are comfortable making visible to other members. We cannot control what other members do with information you share with them, such as screenshots.

### Our team

Compameet staff with an admin account can access account, profile, plan, payment and location information through our password-protected admin panel.

**Our staff cannot read your chats.** End-to-end encrypted messages cannot be read by our servers or staff at all, and our admin panel does not show any chat messages. Staff can see only chat metadata — who is chatting with whom, how many messages were sent, and when — and moderation logs, which record the detected categories but not the message text.

Staff see message text only when a member **reports** someone from a chat: the report includes recent messages from that conversation — for end-to-end encrypted messages, the text the reporter’s app shares (see section 3.5) — so our team can review it. Messages sent the earlier way (see section 3.4) may also be disclosed where required by law (see section 8).

We use this access to review reports and moderation flags, investigate fraud, abuse or threats, handle complaints and support requests, enforce our Terms, and comply with law. [PLACEHOLDER: owner to confirm who holds admin accounts.]

## 8. SHARING WITH SERVICE PROVIDERS AND OTHERS

We share personal data only as described below.

### Service providers (Data Processors)

These providers process data on our behalf and under our instructions:

- [PLACEHOLDER: hosting / cloud provider name and server location] — hosting of our servers, database and uploaded photos;
- Razorpay — payment processing;
- [PLACEHOLDER: SMS gateway provider name] — sending OTP SMS messages through the DLT system;
- Google (Firebase Authentication) — Google sign-in;
- Expo, Google Firebase Cloud Messaging and Apple Push Notification service — delivering push notifications;
- Google Maps Platform — place search and map features, where those features are used.

### Others

- **Authorities:** when required by law — for example a court order, a lawful order under the IT Act, a request from a government agency lawfully authorised under the IT Rules for the prevention, detection, investigation or prosecution of offences, or a notice under the Bharatiya Nagarik Suraksha Sanhita, 2023 — or where reasonably necessary to protect someone’s life or safety, investigate fraud, or respond to legal claims. Where the law requires us to report certain offences (for example offences involving children), we will do so. For end-to-end encrypted messages, we can provide only the information we hold, such as chat metadata and the encrypted data, because we do not have the keys to read them. Information we may provide in response to a lawful request includes account and registration details, device and IP address records, chat metadata, messages sent the earlier way, report records and payment records, including the 180-day copies described in section 9. We keep a record of each request we receive.
- **Business transfers:** if the Compameet business is transferred, merged or sold, personal data may be transferred to the new operator, who must continue to protect it in line with this policy and applicable law.
- **With your consent:** in any other case, only with your consent.

We do **not** sell personal data and do **not** share it with advertisers or data brokers.

### Transfers outside India

Some of our service providers (for example Google, Expo and Apple) may process data on servers outside India. Where we transfer personal data outside India, we do so as permitted under applicable Indian law, including any restrictions notified by the Government of India under the DPDP Act.

## 9. HOW LONG WE KEEP YOUR DATA

We keep personal data only as long as needed for the purposes in this policy, or as required by law.

- **Active accounts:** while your account is active.
- **Plans:** a plan is live for 24 hours; records of past plans are kept with your account.
- **Deactivated accounts:** when you deactivate, your profile is hidden and you are logged out of all devices, but your data is kept so you can reactivate by logging in again.
- **Chat messages:** kept on our servers (end-to-end encrypted messages in encrypted form only) for as long as the conversation exists. A conversation and all its messages (including the original text of filtered messages sent the earlier way) are removed from the app when either member blocks or unmatches the other or deletes their account; a hidden copy is then kept for 180 days (see “Kept for 180 days after deletion” below). We do **not** currently delete active chats automatically after a fixed period. Copies on members’ devices are controlled by those members.
- **Device public keys:** kept while your account exists, for up to 10 devices; when you add more, the key of the device used least recently is removed. They are deleted when you delete your account.
- **Moderation logs:** kept without a fixed end date, including after the related message is deleted. They do not contain message text.
- **Reports:** reports and their evidence snapshot (including copied chat messages) are kept without a fixed end date, including after the chat or either account is deleted.

### When you delete your account

When you delete your account from Settings → Manage account, we:

- remove your chats and conversations from the app (this also removes those conversations for the other member; a hidden copy is kept for 180 days as described below), plan interests, likes, passes, blocks, notifications, push tokens and the public encryption keys of your devices;
- cancel your plans;
- replace your name, date of birth, mobile number, email and Google link with placeholder values (after keeping the hidden 180-day copy of your registration details described below), and clear your profile details, photos list, settings and stored location;
- delete your uploaded photo files, except where a report against you is still under review, in which case they are kept until the review is closed.

### What we keep

- **Kept for 180 days after deletion:** the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 require us to keep registration information for 180 days after an account is deleted, and to preserve content we remove, for possible investigation. So, when an account is deleted, we keep a hidden copy of the registration details (name, gender, date of birth, mobile number, email, Google account link, city and sign-up date) and of the device session records. When a chat is removed by a block, an unmatch or account deletion, we keep a hidden copy of the conversation: messages are kept exactly as stored (end-to-end encrypted messages stay encrypted and we still cannot read them). Photos removed by our team are kept for the same period. These copies are not visible in the app or to members. They are used only to respond to lawful requests from courts or government agencies, and are deleted automatically after 180 days unless an authority has asked us to keep them for longer for an investigation.
- **Kept after deletion:** payment, membership, coin and voucher records; reports made by or about you, including their evidence snapshot; chat moderation logs; creator programme requests; device session records; SMS delivery logs; and technical logs. We keep these for tax and accounting, fraud prevention, safety, dispute resolution and legal compliance. We do not currently delete them automatically after a fixed period. [PLACEHOLDER: owner to decide and implement a retention period for each category, e.g. as required under tax and IT laws.]
- **Backups:** [PLACEHOLDER: owner to confirm whether database backups are taken, how long they are kept, and whether they are encrypted. Until confirmed, do not state a backup period.]
- Where required by applicable law (for example the IT Rules, 2021), we may retain information about an account or content that has been removed or deleted for the period required for investigation purposes.

## 10. YOUR CHOICES AND RIGHTS

Today, the SPDI Rules give you the right to review the information you have provided, ask for it to be corrected, and withdraw your consent. From 13 May 2027, Sections 11 to 14 of the DPDP Act will also give you rights to information about processing, correction and erasure, grievance redressal, and nomination. We already offer the following:

- **Access your information:** view your profile, plans, chats, coins, purchases and logged-in devices in the app. To request a summary of the personal data we hold about you and the processing activities, email privacy@compameet.com. The app does not currently have an automatic data export tool.
- **Correct or update:** edit most profile details in the app. Some details (such as date of birth, gender and religion) cannot be changed in the app; email privacy@compameet.com to request correction of inaccurate data.
- **Erase:** delete your account in the app from Settings → Manage account, or email privacy@compameet.com. Section 9 explains what is deleted and what we must keep.
- **Withdraw consent:** turn off location, camera, photos or notification permissions in your device settings, change your privacy settings in the app, or delete your account. Some features may stop working.
- **Nominate:** nominate another person to exercise your rights in the event of your death or incapacity, by emailing privacy@compameet.com.
- **Raise a grievance:** contact our Grievance Officer (section 13). From 13 May 2027, if you are not satisfied with our response, you may complain to the Data Protection Board of India under the DPDP Act. Until then, you may use the remedies available under the IT Act and other applicable law.

We may ask you to confirm your identity before acting on a request. We may decline requests where the law permits, for example where we must keep data for legal reasons or where a request would reveal another person’s personal data.

## 11. SECURITY

We use reasonable security safeguards, including:

- end-to-end encryption of chat text messages between members using the current app (X25519 key exchange with XSalsa20-Poly1305 encryption, from the NaCl cryptography library), with a separate key on each device;
- application-level encryption (AES-256-GCM) of chat messages sent the earlier way (see section 3.4), including the original text of filtered messages, before it is stored;
- OTP or Google sign-in, and device sessions you can sign out of from Settings;
- a password-protected admin panel for our team.

Other data in our database — including profiles, location, payment records and report snapshots — is not encrypted by our application. [PLACEHOLDER: owner to confirm whether the production database disk and backups are encrypted at rest by the hosting provider, and whether HTTPS/TLS is used for all production traffic, including the database connection. Do not claim these until confirmed.]

Profile photos are stored as image files that can be opened by anyone who has the direct link to the file.

[PLACEHOLDER: owner to confirm whether Compameet has a documented information security programme and policies as described in Rule 8 of the SPDI Rules (for example IS/ISO/IEC 27001 or an approved code). Do not claim certification unless it exists.]

No system is completely secure, and we cannot guarantee that data will never be accessed, disclosed, altered or lost. If a personal data breach occurs, we will notify affected users and authorities as required by applicable law.

Keep your phone and OTPs safe and never share them. If you believe your account is no longer secure, sign out of other devices in Settings and contact support@compameet.com.

## 12. CHILDREN

Compameet is only for adults: **male members must be 21 years or older**, and **female members and members of other genders must be 18 years or older**. We do not knowingly allow children to register or knowingly process children’s personal data. Age is based on the date of birth you provide; we do not verify identity documents.

If you believe a child or under-age person is using Compameet, report the profile in the app or email grievance@compameet.com. We will take action, which may include removing the account and its data.

## 13. GRIEVANCE OFFICER

If you have a complaint about how we handle your personal data, or about any content or conduct on Compameet, contact:

- **Grievance Officer:** [PLACEHOLDER: name and designation]
- **Email:** grievance@compameet.com (privacy-specific requests: privacy@compameet.com)
- **Address:** [PLACEHOLDER: address for written complaints]

We will acknowledge your complaint within **24 hours** and aim to resolve it within **7 days** of receipt, in line with the IT Rules (as amended with effect from 20 February 2026). Privacy grievances will in any case be resolved within one month, as required by Rule 5(9) of the SPDI Rules. Some content-removal complaints have shorter timelines — see section 30 of our Terms. See our Grievance Mechanism for details.

[PLACEHOLDER: lawyer to confirm these timelines and that the Grievance Officer details meet the IT Rules, the SPDI Rules and the Consumer Protection (E-Commerce) Rules, 2020.]

## 14. WEBSITE, COOKIES AND LOCAL STORAGE

The public Compameet website does not use third-party tracking, advertising or analytics cookies. The admin panel stores a login token in your browser’s local storage for authorised staff only. See our Cookie Policy for details.

## 15. CHANGES TO THIS POLICY

We may update this Privacy Policy when our Services or legal requirements change. The current version, with its last-updated date and version number, is always available on our website and in the app. Where changes are material, we will notify you in the app or by other appropriate means and, where required by law, ask for your consent again.

## 16. CONTACT US

- **Privacy, data deletion and personal-data requests:** privacy@compameet.com
- **Customer / user support:** support@compameet.com
- **Complaints and grievances:** grievance@compameet.com

You can also use the Contact page on our website or Help & Support inside the Compameet app.

This Privacy Policy is governed by the laws of India.`;
