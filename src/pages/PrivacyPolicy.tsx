import React from "react";

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen text-white">
      <div
        className="fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1200px 600px at 10% 10%, rgba(255,199,74,0.12), transparent 60%)," +
            "radial-gradient(900px 500px at 90% 10%, rgba(244,138,24,0.12), transparent 55%)," +
            "linear-gradient(180deg, #0b0c0e 0%, #111214 45%, #0b0c0e 100%)",
        }}
        aria-hidden
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <header className="mb-8">
          <div className="text-xs uppercase tracking-[0.3em] text-white/50">Legal</div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-white mt-2">Privacy Policy</h1>
          <p className="text-white/60 mt-2">
            Effective date: February 9, 2026. This policy explains how ReemTeam collects, uses, and protects your data.
          </p>
        </header>

        <div className="space-y-8 text-white/80 leading-relaxed">
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">1. Overview</h2>
            <p className="mt-3">
              ReemTeam provides online table experiences, player profiles, and wallet features so you can play with your community.
              This policy describes what we collect, why we collect it, and the choices you have. By using ReemTeam, you agree to
              this policy.
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">2. Data We Collect</h2>
            <ul className="mt-3 list-disc list-inside space-y-2">
              <li>Account data: username, email, password hash, and profile settings.</li>
              <li>Identity and social data: optional social login tokens and public profile details from linked accounts.</li>
              <li>Gameplay data: table participation, in-game actions, and performance metrics.</li>
              <li>Wallet data: deposits, withdrawals, transaction history, and payout requests.</li>
              <li>Device and usage data: IP address, device identifiers, browser type, and log activity.</li>
              <li>Support data: messages, attachments, and related metadata when you contact us.</li>
            </ul>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">3. How We Use Data</h2>
            <ul className="mt-3 list-disc list-inside space-y-2">
              <li>Provide and personalize gameplay, tables, and social features.</li>
              <li>Process deposits and withdrawals through payment partners.</li>
              <li>Prevent fraud, enforce rules, and protect players and the platform.</li>
              <li>Improve performance, reliability, and user experience.</li>
              <li>Communicate about account activity, security, and updates.</li>
            </ul>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">4. Payments and Payouts</h2>
            <p className="mt-3">
              Deposits and withdrawals are handled by third-party payment processors. We do not store full payment card numbers.
              We receive transaction confirmations, status, and limited metadata required to fulfill wallet activity and reporting.
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">5. Sharing and Disclosure</h2>
            <ul className="mt-3 list-disc list-inside space-y-2">
              <li>With service providers that help run our platform (hosting, analytics, payments, customer support).</li>
              <li>With other players when you participate in tables (username, avatar, and gameplay presence).</li>
              <li>For legal compliance, security, or to protect the rights and safety of ReemTeam and its users.</li>
              <li>As part of a corporate transaction such as a merger, acquisition, or asset transfer.</li>
            </ul>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">6. Data Retention</h2>
            <p className="mt-3">
              We retain data for as long as needed to provide services, comply with legal requirements, resolve disputes, and enforce
              agreements. Transaction records may be retained for financial compliance and anti-fraud obligations.
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">7. Your Choices</h2>
            <ul className="mt-3 list-disc list-inside space-y-2">
              <li>Update your profile and avatar from your account dashboard.</li>
              <li>Disconnect social accounts where available.</li>
              <li>Request account or data deletion as described on the User Data Deletion page.</li>
            </ul>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">8. Security</h2>
            <p className="mt-3">
              We use reasonable administrative, technical, and physical safeguards to protect your data. No system is perfectly secure,
              but we work hard to protect your information and limit access to authorized personnel only.
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">9. Children</h2>
            <p className="mt-3">
              ReemTeam is intended for users who are at least the age of majority in their jurisdiction. We do not knowingly collect data
              from minors. If you believe a minor has provided data, contact us so we can take action.
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">10. Changes</h2>
            <p className="mt-3">
              We may update this policy as our services evolve. We will post the latest version here and update the effective date.
              Material changes will be communicated through the app or via email.
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">11. Contact</h2>
            <p className="mt-3">
              For privacy questions, use the in-app support options or the contact address listed in your account communications.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
