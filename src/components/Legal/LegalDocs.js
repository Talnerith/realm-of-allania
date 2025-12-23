import { useState } from 'react';
import { Shield, Lock, Cookie, FileText, ChevronLeft } from 'lucide-react';

export default function LegalDocs({ goBack }) {
  const [activeTab, setActiveTab] = useState('tos');

  const tabs = [
    { id: 'tos', label: 'Terms of Service', icon: FileText },
    { id: 'privacy', label: 'Privacy Policy', icon: Lock },
    { id: 'cookies', label: 'Cookie Policy', icon: Cookie },
  ];

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-slate-950 pb-24">
      <div className="max-w-4xl mx-auto p-4 md:p-8 animate-in fade-in">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
            {goBack && (
                <button onClick={goBack} className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors">
                    <ChevronLeft className="w-5 h-5" /> Back
                </button>
            )}
            <h1 className="text-3xl font-serif font-bold text-amber-100 flex items-center gap-3">
                <Shield className="w-8 h-8 text-amber-500" />
                Legal & Compliance
            </h1>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-slate-800 pb-4">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-bold text-sm ${
                        activeTab === tab.id 
                        ? 'bg-amber-900/40 text-amber-500 border border-amber-900/50' 
                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                </button>
            ))}
        </div>

        {/* Content Area */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 md:p-10 text-slate-300 space-y-6 shadow-xl">
            
            {activeTab === 'tos' && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-serif font-bold text-white">Terms of Service</h2>
                    <p className="text-sm text-slate-500">Last Updated: 2025</p>

                    <Section title="1. Acceptance of Terms">
                        By accessing or using the Realm of Allania (the &quot;Service&quot;), you agree to be bound by these Terms. If you disagree with any part of the terms, you may not access the Service.
                    </Section>

                    <Section title="2. Acceptable Use Policy (AUP)">
                        You agree not to use the Service to:
                        <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-slate-400">
                            <li>Post content that is hate speech, threatening, or pornographic.</li>
                            <li>Harass, abuse, or harm another person.</li>
                            <li>Upload viruses or malicious code.</li>
                            <li>Spam or excessively burden the Service.</li>
                        </ul>
                        <p className="mt-2">We reserve the right to ban any user found violating these rules without refund or notice.</p>
                    </Section>

                    <Section title="3. User-Generated Content (UGC)">
                        <p><strong>Ownership:</strong> You retain ownership of the characters, lore, and stories you create.</p>
                        <p className="mt-2"><strong>License:</strong> By posting content, you grant Realm of Allania a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content in connection with the Service.</p>
                    </Section>

                    <Section title="4. Copyright & DMCA">
                        We respect the intellectual property rights of others. If you believe your work has been copied in a way that constitutes copyright infringement, please contact the administration immediately for removal.
                    </Section>

                    <Section title="5. Disclaimers">
                        The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis. We do not warrant that the Service will be uninterrupted or error-free.
                    </Section>
                </div>
            )}

            {activeTab === 'privacy' && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-serif font-bold text-white">Privacy Policy</h2>
                    <p className="text-sm text-slate-500">Last Updated: 2025</p>

                    <Section title="1. Data Collection">
                        We collect the following information:
                        <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-slate-400">
                            <li><strong>Account Info:</strong> Email address and username (via Google Firebase).</li>
                            <li><strong>Usage Data:</strong> IP addresses and browser type (standard server logs).</li>
                            <li><strong>Content:</strong> Posts, messages, and images you upload.</li>
                        </ul>
                    </Section>

                    <Section title="2. How We Use Data">
                        We use your data solely to provide and improve the Service, manage your account, and ensure security. We do not sell your personal data to third parties.
                    </Section>

                    <Section title="3. Data Storage">
                        Your data is stored securely using Google Firebase services. While we implement security measures, no method of transmission over the Internet is 100% secure.
                    </Section>

                    <Section title="4. Data Deletion">
                        You may request the deletion of your account and personal data at any time by contacting the administration or using the delete feature within the application.
                    </Section>
                </div>
            )}

            {activeTab === 'cookies' && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-serif font-bold text-white">Cookie Policy</h2>
                    
                    <Section title="1. What Are Cookies?">
                        Cookies are small text files stored on your device to help the website function properly.
                    </Section>

                    <Section title="2. How We Use Cookies">
                        <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-slate-400">
                            <li><strong>Essential Cookies:</strong> Required for authentication (keeping you logged in).</li>
                            <li><strong>Preferences:</strong> Storing your UI settings (e.g., active region).</li>
                        </ul>
                    </Section>

                    <Section title="3. Managing Cookies">
                        You can instruct your browser to refuse all cookies, but if you do so, you may not be able to use some portions of our Service (specifically, logging in).
                    </Section>
                </div>
            )}

            <div className="mt-12 pt-8 border-t border-slate-800 text-center text-slate-500 text-sm">
                <p>&copy; 2025 Realm of Allania. All Rights Reserved.</p>
                <p className="mt-1">Contact: admin@realm-of-allania.com</p>
            </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
    return (
        <div className="border-b border-slate-800/50 pb-4 last:border-0">
            <h3 className="font-bold text-amber-500 mb-2 text-lg">{title}</h3>
            <div className="text-slate-300 leading-relaxed">{children}</div>
        </div>
    );
}