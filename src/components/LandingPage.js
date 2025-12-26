"use client";
import { useState } from 'react';
import { Map, MessageSquare, Book, Sword, ArrowRight } from 'lucide-react';

export default function LandingPage({ onEnter }) {
  const [skipFuture, setSkipFuture] = useState(false);

  const handleEnter = () => {
    if (skipFuture) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('skipLanding', 'true');
      }
    }
    onEnter();
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-slate-950 text-slate-200">
      {/* Hero Section */}
      <div className="relative h-96 flex items-center justify-center bg-gradient-to-b from-amber-900/30 to-slate-950">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1519074069444-1ba4fff66d16?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent"></div>
        </div>

        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 mb-6 drop-shadow-sm">
            Realm of Allania
          </h1>
          <p className="text-xl md:text-2xl text-slate-300 font-light max-w-2xl mx-auto mb-8">
            An immersive Play-by-Post Roleplaying experience set in a high-fantasy world of magic, intrigue, and endless adventure.
          </p>
          <button
            onClick={handleEnter}
            className="group relative inline-flex items-center justify-center px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white font-serif tracking-wide transition-all shadow-lg hover:shadow-amber-900/50 rounded-sm"
          >
            <span>Enter the Realm</span>
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>

          <div className="mt-4 flex items-center justify-center space-x-2 text-slate-400 text-sm">
            <input
              type="checkbox"
              id="skipLanding"
              checked={skipFuture}
              onChange={(e) => setSkipFuture(e.target.checked)}
              className="accent-amber-600 w-4 h-4 rounded border-slate-600 bg-slate-800"
            />
            <label htmlFor="skipLanding" className="cursor-pointer select-none hover:text-slate-300 transition-colors">
              Don&apos;t show this introduction again
            </label>
          </div>
        </div>
      </div>

      {/* Content Container */}
      <div className="max-w-6xl mx-auto px-6 py-16 space-y-24">

        {/* What is Play-by-Post? */}
        <section className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-serif text-amber-500 mb-4 flex items-center">
              <Book className="mr-3 w-8 h-8" />
              What is Play-by-Post?
            </h2>
            <div className="space-y-4 text-slate-300 leading-relaxed text-lg">
              <p>
                Play-by-Post (PbP) is a text-based roleplaying game format where the story unfolds through forum posts rather than real-time sessions.
              </p>
              <p>
                Take your time to craft beautiful, detailed responses. Explore the world at your own pace. Collaborate with other writers to weave intricate storylines that become part of the realm&apos;s history.
              </p>
            </div>
          </div>
          <div className="bg-slate-900 p-6 rounded-lg border border-slate-800 shadow-xl relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-lg"></div>
            <div className="rounded-lg overflow-hidden border border-slate-800 shadow-xl">
              <img
                src="/images/tutorial-demo.gif"
                alt="Play-by-Post Tutorial"
                className="w-full h-auto object-cover"
              />
            </div>
            <div className="mt-4 text-center text-xs text-slate-500 font-sans uppercase tracking-widest">
              Storytelling at your pace
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section>
          <h2 className="text-3xl font-serif text-amber-500 mb-12 text-center">Platform Features</h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* World Map */}
            <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-800 hover:border-amber-900/50 transition-colors">
              <div className="h-12 w-12 bg-amber-900/20 text-amber-500 flex items-center justify-center rounded-lg mb-4">
                <Map className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-serif text-slate-200 mb-3">Interactive World Map</h3>
              <p className="text-slate-400">
                Navigate the diverse regions of Allania visually. Click on any region to discover its lore, active threads, and current events. The world is yours to explore.
              </p>
            </div>

            {/* Live Chat */}
            <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-800 hover:border-amber-900/50 transition-colors">
              <div className="h-12 w-12 bg-blue-900/20 text-blue-500 flex items-center justify-center rounded-lg mb-4">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-serif text-slate-200 mb-3">Real-time Messaging</h3>
              <p className="text-slate-400">
                Coordinate with other players, plan your next adventure, or just hang out in our integrated live chat system. Seamlessly switch between writing posts and chatting.
              </p>
            </div>

            {/* Codex */}
            <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-800 hover:border-amber-900/50 transition-colors">
              <div className="h-12 w-12 bg-purple-900/20 text-purple-500 flex items-center justify-center rounded-lg mb-4">
                <Book className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-serif text-slate-200 mb-3">The Codex</h3>
              <p className="text-slate-400">
                A living wiki of the world&apos;s lore, characters, and history. Contribute your own knowledge and keep track of the ever-expanding universe of Allania.
              </p>
            </div>
          </div>
        </section>

        {/* Tutorial Section - Getting Started */}
        <section className="bg-slate-900 rounded-xl p-8 border border-slate-800">
          <h2 className="text-3xl font-serif text-slate-200 mb-8 flex items-center">
            <Sword className="mr-3 w-8 h-8 text-amber-500" />
            Getting Started
          </h2>

          <div className="space-y-8">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 text-amber-500 font-bold text-xl border border-slate-700">1</div>
              <div>
                <h3 className="text-xl text-amber-100 mb-2">Create Your Account</h3>
                <p className="text-slate-400">
                  Sign up to gain access to posting features. You can browse the world as a guest, but to make your mark, you must be a registered adventurer.
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 text-amber-500 font-bold text-xl border border-slate-700">2</div>
              <div>
                <h3 className="text-xl text-amber-100 mb-2">Create a Character</h3>
                <p className="text-slate-400">
                  Use the Character Drawer to create your persona. Define their name, appearance, and backstory. This profile will accompany every post you make.
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 text-amber-500 font-bold text-xl border border-slate-700">3</div>
              <div>
                <h3 className="text-xl text-amber-100 mb-2">Join a Thread</h3>
                <p className="text-slate-400">
                  Navigate to a region on the map, find an open thread, or start your own. Write your first post and wait for others to respond!
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <button
              onClick={handleEnter}
              className="px-8 py-3 border border-amber-600 text-amber-500 hover:bg-amber-600 hover:text-white transition-colors uppercase tracking-widest text-sm font-semibold rounded-sm"
            >
              Start Your Journey
            </button>
          </div>
        </section>

      </div>

      {/* Footer */}
      <footer className="bg-slate-950 py-12 text-center text-slate-600 text-sm border-t border-slate-900 mt-12">
        <p>&copy; {new Date().getFullYear()} Realm of Allania. All rights reserved.</p>
        <p className="mt-2">A Play-by-Post Roleplaying Community.</p>
      </footer>
    </div>
  );
}
