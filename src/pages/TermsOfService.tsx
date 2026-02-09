import React from "react";

const TermsOfService: React.FC = () => {
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
          <h1 className="text-3xl sm:text-4xl font-semibold text-white mt-2">Terms of Service</h1>
          <p className="text-white/60 mt-2">
            Effective date: February 9, 2026. These terms govern your use of the ReemTeam platform and services.
          </p>
        </header>

        <div className="space-y-8 text-white/80 leading-relaxed">
          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">1. Acceptance of Terms</h2>
            <p className="mt-3">
              By accessing or using ReemTeam, you agree to these terms and our Privacy Policy. If you do not agree, do not use the service.
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">2. Eligibility</h2>
            <p className="mt-3">
              You must be at least the age of majority in your jurisdiction and legally permitted to use our services. You are responsible
              for ensuring your use is lawful where you live.
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">3. Account Responsibilities</h2>
            <ul className="mt-3 list-disc list-inside space-y-2">
              <li>Provide accurate, current information and keep it updated.</li>
              <li>Maintain the security of your login credentials.</li>
              <li>Notify us promptly of unauthorized access or suspicious activity.</li>
            </ul>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">4. Game Integrity and Fair Play</h2>
            <ul className="mt-3 list-disc list-inside space-y-2">
              <li>No collusion, automation, bots, or scripted play.</li>
              <li>No exploitation of bugs, security issues, or system weaknesses.</li>
              <li>Respect other players. Harassment, threats, and abusive conduct are prohibited.</li>
            </ul>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">5. Wallet, Deposits, and Withdrawals</h2>
            <ul className="mt-3 list-disc list-inside space-y-2">
              <li>Deposits and withdrawals are processed through third-party payment providers.</li>
              <li>We may apply verification or review to prevent fraud and protect players.</li>
              <li>Withdrawals can be delayed or declined if required by law, compliance, or security review.</li>
              <li>You are responsible for any fees, chargebacks, taxes, or penalties related to your transactions.</li>
            </ul>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">6. Prohibited Use</h2>
            <ul className="mt-3 list-disc list-inside space-y-2">
              <li>Use of the service for unlawful, deceptive, or fraudulent purposes.</li>
              <li>Interference with or disruption of the service or other users.</li>
              <li>Reverse engineering, scraping, or unauthorized access to systems or data.</li>
            </ul>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">7. Suspension and Termination</h2>
            <p className="mt-3">
              We may suspend or terminate access if you violate these terms, create risk for the platform, or if required by law.
              You may close your account at any time by requesting data deletion.
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">8. Intellectual Property</h2>
            <p className="mt-3">
              ReemTeam and its content are owned by us or our licensors. You receive a limited, non-exclusive, non-transferable license
              to use the service for personal, non-commercial purposes.
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">9. Disclaimers</h2>
            <p className="mt-3">
              The service is provided on an "as is" and "as available" basis. We disclaim all warranties to the maximum extent permitted
              by law, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">10. Limitation of Liability</h2>
            <p className="mt-3">
              To the maximum extent permitted by law, ReemTeam will not be liable for any indirect, incidental, special, consequential,
              or punitive damages, or for any loss of profits, data, or goodwill.
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">11. Changes to the Service or Terms</h2>
            <p className="mt-3">
              We may modify these terms or the service at any time. Continued use after changes take effect means you accept the updated
              terms. We will provide notice for material changes.
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">12. Contact</h2>
            <p className="mt-3">
              For questions about these terms, use the in-app support options or the contact address listed in your account communications.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
