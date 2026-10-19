'use strict';

const { v4: uuidv4 } = require('uuid');
const privacyPolicyContent = require('../content/privacyPolicy');
const termsOfServiceContent = require('../content/termsOfService');
const cancellationRefundContent = require('../content/cancellationRefund');

/**
 * Full Compameet legal set (admin + app) — same policies as compameet-backend seeder.
 */
const DOCS = [
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    content: privacyPolicyContent,
    sortOrder: 10,
    requiresAcceptance: true,
    audience: 'all',
  },
  {
    slug: 'terms-of-service',
    title: 'Terms & Conditions',
    content: termsOfServiceContent,
    sortOrder: 20,
    requiresAcceptance: true,
    audience: 'all',
  },
  {
    slug: 'cancellation-refund',
    title: 'Cancellation & Refund Policy',
    content: cancellationRefundContent,
    sortOrder: 30,
    requiresAcceptance: true,
    audience: 'all',
  },
  {
    slug: 'community-guidelines',
    title: 'Community Guidelines',
    content: `Compameet Community Guidelines help keep the platform respectful and lawful.

## Be respectful
No harassment, hate, threats, or abuse.

## Be authentic
Use your own photos and real details. No fake profiles, fake plans, or impersonation.

## Post genuine plans
Plans must be real, everyday, lawful activities — coffee, a meal, a movie, a walk and similar.

## No sexual or escort services
Compameet is not for prostitution, escorting, paid companionship, or sexual services. Do not offer or request them.

## No scams
Never ask other members for money, OTPs, gifts, or investments.

## Meet only if you are comfortable
Compameet only shows plans. Meeting or not is entirely your decision. Chat first, and meet in person only if you feel comfortable. Prefer busy public places.

## Safety
Block or report anyone who makes you uncomfortable, and raise a complaint in the app. Compameet does not provide on-ground help and is not an emergency service.

## Enforcement
Violations may lead to warnings, content removal, suspension, or permanent bans.

For more detail, see Terms & Conditions and Safety pages.`,
    sortOrder: 50,
    requiresAcceptance: true,
    audience: 'all',
  },
  {
    slug: 'safety-policy',
    title: 'Safety Policy',
    content: `Compameet Safety Policy summarises how we approach online safety tools and offline-meet guidance.

## Our role
Compameet only shows people’s plans and lets interested people chat. We provide mobile OTP verification, chat moderation, block/report, in-app complaints, and Safety tips. We do not organise or supervise meets and do not provide on-ground or physical help.

## Your role
Meeting or not meeting is totally your decision. Chat first and meet in person only if you feel comfortable. Meet Compameet’s age requirements (male 21+; female and other genders 18+). If you meet, choose a busy public place, tell a trusted person, arrange your own transport, keep belongings secure, never share OTPs, and leave if you feel unsafe. In immediate danger, call your local emergency services.

## Complaints
Raise a complaint from Help & Support in the app. Our team reviews it online: Report → Review → Action (warning, plan or content removal, suspension, termination, or authority cooperation where legally required/permitted).

## Verification
Accounts are verified by mobile number OTP only. We do not do KYC or collect ID documents. OTP verification is not a guarantee of anyone’s identity, character, or safety.

## Contact
- Support: support@compameet.com
- Grievance: grievance@compameet.com
- Privacy: privacy@compameet.com

## Remember
> **Remember:** Meet only if you feel comfortable after chatting. Your safety is your responsibility — Compameet cannot guarantee the safety of in-person meetings. Always trust your instincts.

See Safety topic pages on the website and Terms & Conditions for full detail.`,
    sortOrder: 60,
    requiresAcceptance: true,
    audience: 'all',
  },
  {
    slug: 'grievance-mechanism',
    title: 'Grievance Mechanism',
    content: `## How to raise a complaint

1. Raise a complaint from **Help & Support** in the app, or  
2. Email **grievance@compameet.com**, or  
3. Use the Contact page on the Compameet website.

Please include your registered mobile number, the member or plan involved, any payment reference (if relevant), and a clear description of the issue. Complaints are handled online — Compameet does not provide on-ground or physical help.

## Official contact emails

- **Customer / user support:** support@compameet.com  
- **Complaints & grievance:** grievance@compameet.com  
- **Privacy, data deletion & personal-data requests:** privacy@compameet.com  

## What we do
We review complaints relating to members, plans, chat, payments (memberships and coin packs), and privacy requests as reasonably practicable.

We aim to acknowledge complete complaints promptly and resolve them within a reasonable period (target: acknowledgement within about **24 hours**, and resolution within about **15 days**, where practicable).

## Grievance Officer
For platform complaints and escalation, write to **grievance@compameet.com**. We will publish Grievance Officer name/designation and additional escalation details here as required under applicable Indian rules (including consumer / intermediary requirements where they apply to Compameet).

## Privacy requests
For access, correction, deletion, or other personal-data requests, email **privacy@compameet.com**. Also see the Privacy Policy and the Account / Data Deletion page on the website.`,
    sortOrder: 70,
    requiresAcceptance: false,
    audience: 'all',
  },
  {
    slug: 'data-deletion',
    title: 'Account / Data Deletion',
    content: `You can request deletion of your Compameet account and associated personal data.

## How to request deletion
- Email **privacy@compameet.com** with the subject “Account / data deletion”, including your registered mobile or email, or  
- Open the Compameet app → Profile / Settings → request deletion via Help & Support, or  
- Submit a request via Contact Us (choose Privacy / data).

## Official emails
- **Privacy, data deletion & personal-data requests:** privacy@compameet.com  
- **Customer / user support:** support@compameet.com  
- **Complaints & grievance:** grievance@compameet.com  

## What we delete
Profile details, photos, plans, chat content we control, coin history, and other personal data — subject to legal retention needs (for example payment or dispute records). Unused coins and remaining membership time are not refunded on deletion.

## Timeline
We aim to process verified deletion requests within **30 days**. You may receive a confirmation when the request is complete.

Also see our Privacy Policy and Grievance Mechanism.`,
    sortOrder: 80,
    requiresAcceptance: false,
    audience: 'all',
  },
  {
    slug: 'about-us',
    title: 'About Us',
    content: `Compameet helps you find company nearby for everyday plans across India. Post what you want to do today, let people nearby know, and chat with whoever is interested.

Compameet only shows people’s plans. Whether you meet anyone is entirely your decision — meet only if you feel comfortable after chatting. Compameet is not an escort, paid companionship, or sexual services platform.

## What we offer
- Post a plan for today — just pick the plan and your area  
- Plans stay live for 24 hours  
- Nearby alerts to people in your city within about 50 km  
- Interested / Not interested and instant in-app chat  
- 50 free coins on signup; 10 coins per plan; coin packs and memberships in the app  
- Mobile OTP verification, block, report, and in-app complaints  

## Age eligibility
Male users: **21+**. Female and other genders: **18+**. We do not knowingly permit minors.

## Contact
support@compameet.com · grievance@compameet.com · privacy@compameet.com`,
    sortOrder: 90,
    requiresAcceptance: false,
    audience: 'all',
  },
  {
    slug: 'contact-us',
    title: 'Contact Us',
    content: `## Reach Compameet

- **Customer / user support:** support@compameet.com  
- **Complaints & grievance:** grievance@compameet.com  
- **Privacy / data deletion:** privacy@compameet.com  

Please include your registered mobile number and any payment reference (if relevant) so we can help faster.

You can also raise a complaint from **Help & Support** inside the app. Compameet does not provide on-ground or physical help.`,
    sortOrder: 100,
    requiresAcceptance: false,
    audience: 'all',
  },
  {
    slug: 'faq',
    title: 'FAQ',
    content: `## How does a plan work?
Pick a plan (coffee, dinner, movie, walk and more) and your area, then post it. There is no date or time to choose. Your plan stays live on your profile for **24 hours**, then you can post a new one.

## How much does a plan cost?
Every new member gets **50 free coins**. Each plan costs **10 coins**. When your coins run out, buy a coin pack from the Coins section in your profile. Memberships also include bonus coins.

## Are coins or memberships refundable?
No. Coin packs and memberships are non-refundable, and coins spent on a plan are not returned if you cancel it. Coins have no cash value.

## Do I have to meet someone?
No. Compameet only shows people’s plans. Meeting or not is totally your decision — chat first and meet only if you feel comfortable.

## How is my account verified?
By mobile number OTP only. Compameet does not do KYC or ask for ID documents.

## Does Compameet provide help on the ground?
No. Compameet does not provide physical or on-ground help. You can block or report anyone and raise a complaint in the app, and our team will review it. In an emergency, call your local emergency number.

## Is Compameet for escort / sexual services?
No. Offering or requesting sexual or escort services is prohibited and may lead to permanent bans.

## Age rules?
Male 21+. Female and other genders 18+.`,
    sortOrder: 110,
    requiresAcceptance: false,
    audience: 'all',
  },
];

/** Always refresh body for these Compameet content modules on seed. */
const REFRESH_CONTENT_SLUGS = new Set(DOCS.map((d) => d.slug));

/** Legacy short slugs → canonical Compameet slug (keep aliases for old app links). */
const ALIASES = [
  { slug: 'terms', from: 'terms-of-service' },
  { slug: 'privacy', from: 'privacy-policy' },
  { slug: 'cancellation', from: 'cancellation-refund' },
  { slug: 'refund-policy', from: 'cancellation-refund' },
  { slug: 'code-of-conduct', from: 'community-guidelines' },
  { slug: 'safety', from: 'safety-policy' },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      `SELECT slug FROM legal_documents`
    );
    const have = new Set((existing || []).map((r) => r.slug));

    for (const doc of DOCS) {
      if (have.has(doc.slug)) {
        await queryInterface.sequelize.query(
          `UPDATE legal_documents
           SET title = :title,
               content = :content,
               "sortOrder" = :sortOrder,
               "requiresAcceptance" = :requiresAcceptance,
               audience = :audience,
               "isActive" = true,
               version = COALESCE(version, 1) + 1,
               "updatedAt" = :now
           WHERE slug = :slug`,
          {
            replacements: {
              slug: doc.slug,
              title: doc.title,
              content: doc.content,
              sortOrder: doc.sortOrder,
              requiresAcceptance: doc.requiresAcceptance,
              audience: doc.audience,
              now,
            },
          }
        );
      } else {
        await queryInterface.bulkInsert('legal_documents', [
          {
            id: uuidv4(),
            slug: doc.slug,
            title: doc.title,
            content: doc.content,
            isActive: true,
            version: 1,
            sortOrder: doc.sortOrder,
            requiresAcceptance: doc.requiresAcceptance,
            audience: doc.audience,
            createdAt: now,
            updatedAt: now,
          },
        ]);
        have.add(doc.slug);
      }
    }

    await queryInterface.sequelize.query(
      `UPDATE legal_documents SET "isActive" = false, "updatedAt" = :now
       WHERE slug = 'companion-provider-agreement'`,
      { replacements: { now } }
    );

    const bySlug = Object.fromEntries(DOCS.map((d) => [d.slug, d]));
    for (const alias of ALIASES) {
      const src = bySlug[alias.from];
      if (!src) continue;
      if (have.has(alias.slug)) {
        await queryInterface.sequelize.query(
          `UPDATE legal_documents
           SET title = :title,
               content = :content,
               "sortOrder" = :sortOrder,
               "requiresAcceptance" = :requiresAcceptance,
               audience = :audience,
               "isActive" = false,
               "updatedAt" = :now
           WHERE slug = :slug`,
          {
            replacements: {
              slug: alias.slug,
              title: src.title,
              content: src.content,
              sortOrder: src.sortOrder + 1000,
              requiresAcceptance: src.requiresAcceptance,
              audience: src.audience,
              now,
            },
          }
        );
      } else {
        await queryInterface.bulkInsert('legal_documents', [
          {
            id: uuidv4(),
            slug: alias.slug,
            title: src.title,
            content: src.content,
            isActive: false,
            version: 1,
            sortOrder: src.sortOrder + 1000,
            requiresAcceptance: src.requiresAcceptance,
            audience: src.audience,
            createdAt: now,
            updatedAt: now,
          },
        ]);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const { Op } = Sequelize;
    const slugs = [
      ...DOCS.map((d) => d.slug),
      ...ALIASES.map((a) => a.slug),
    ];
    await queryInterface.bulkDelete('legal_documents', {
      slug: { [Op.in]: slugs },
    });
  },
};
