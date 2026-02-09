import React from "react";

const UserDataDeletion: React.FC = () => {
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
          <h1 className="text-3xl sm:text-4xl font-semibold text-white mt-2">User Data Deletion</h1>
          <p className="text-white/60 mt-2">
            Effective date: February 9, 2026. Use this page to understand how to request deletion of your ReemTeam account data.
          </p>
        </header>

        <div className="space-y-8 text-white/80 leading-relaxed">
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">1. How to Request Deletion</h2>
            <p className="mt-3">
              To request deletion, contact support using the address provided in your account communications. Please include your
              username, the email associated with your account, and the reason for the request. We may ask for additional verification
              to protect your account.
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">2. What Will Be Deleted</h2>
            <ul className="mt-3 list-disc list-inside space-y-2">
              <li>Profile information such as username, avatar, and social account links.</li>
              <li>Authentication data, including email and password hash.</li>
              <li>Gameplay history and related personal identifiers.</li>
              <li>Support conversations that are not required for compliance.</li>
            </ul>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">3. What We May Retain</h2>
            <p className="mt-3">
              We may retain limited records required for legal, security, and financial compliance, including transaction history,
              payout records, fraud-prevention logs, and audit trails. These records are kept only as long as required by law or
              legitimate business obligations.
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">4. Processing Time</h2>
            <p className="mt-3">
              We aim to complete deletion requests within 30 days of verification. If additional time is required, we will notify you
              through the contact details on file.
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">5. Effects of Deletion</h2>
            <ul className="mt-3 list-disc list-inside space-y-2">
              <li>Your account and access to tables, wallet, and profile will be permanently removed.</li>
              <li>Any remaining wallet balance must be withdrawn prior to deletion.</li>
              <li>Deletion is irreversible once completed.</li>
            </ul>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">6. Questions</h2>
            <p className="mt-3">
              If you need help with a deletion request, use the in-app support options or the contact address listed in your account
              communications.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default UserDataDeletion;
