import { useState } from 'react';
import { 
  collectionGroup, getDocs, query, doc, updateDoc, 
  collection, writeBatch, where 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';
import { useGame } from '@/context/GameContext';
import { Shield, Play, CheckCircle, AlertTriangle, Loader, Terminal } from 'lucide-react';

export default function AdminMigrationTool() {
  const { userRole } = useGame();
  const [logs, setLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);

  // Only Admins should see this
  if (userRole !== 'admin') return null;

  const addLog = (msg) => setLogs(prev => [...prev, `> ${msg}`]);

  const runMigration = async () => {
    if (!window.confirm("Run Character Count Backfill? This will scan all users and update their characterCount field.")) return;
    
    setIsRunning(true);
    setLogs(['Starting migration...', 'Scanning for user accounts...']);
    setProgress(0);

    try {
      // 1. Find all 'account' documents (this finds all users even if parent docs are phantom)
      // We assume your user settings are at: users/{userId}/settings/account
      const accountsQuery = query(collectionGroup(db, 'account'));
      const accountsSnap = await getDocs(accountsQuery);
      
      const targets = [];

      // Filter to ensure we only touch docs in THIS app's namespace
      accountsSnap.forEach(docSnap => {
          const path = docSnap.ref.path;
          if (path.includes(APP_ID)) {
              // Path: artifacts/{appId}/users/{userId}/settings/account
              // Parent: settings
              // Grandparent: users/{userId}
              const userDocRef = docSnap.ref.parent.parent;
              if (userDocRef) {
                  targets.push({
                      userId: userDocRef.id,
                      accountRef: docSnap.ref
                  });
              }
          }
      });

      setTotal(targets.length);
      addLog(`Found ${targets.length} users to check.`);

      let processed = 0;
      let updated = 0;
      const batchSize = 400; // Firestore batch limit is 500
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const target of targets) {
          // 2. Count Characters for this user
          const charColRef = collection(db, 'artifacts', APP_ID, 'users', target.userId, 'characters');
          const charSnap = await getDocs(charColRef);
          const realCount = charSnap.size;

          // 3. Add to batch
          batch.update(target.accountRef, { characterCount: realCount });
          batchCount++;
          
          addLog(`User ${target.userId.substring(0,6)}... has ${realCount} characters. Updating.`);

          // 4. Commit if batch full
          if (batchCount >= batchSize) {
              await batch.commit();
              batch = writeBatch(db);
              batchCount = 0;
          }

          processed++;
          setProgress(processed);
      }

      // Commit remaining
      if (batchCount > 0) {
          await batch.commit();
      }

      addLog('-----------------------------------');
      addLog(`Migration Complete.`);
      addLog(`Scanned: ${processed} users.`);
      addLog(`All character counts synchronized.`);

    } catch (e) {
        console.error(e);
        addLog(`ERROR: ${e.message}`);
        addLog(`Make sure you have the necessary indexes if prompted.`);
    } finally {
        setIsRunning(false);
    }
  };

  return (
    <div className="my-8 mx-auto max-w-2xl bg-slate-900 border-2 border-amber-500/50 rounded-xl overflow-hidden shadow-2xl animate-in slide-in-from-top-10">
      <div className="bg-amber-900/20 p-4 border-b border-amber-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-amber-500"/>
              <div>
                  <h3 className="text-amber-100 font-bold">Admin Migration Tool</h3>
                  <p className="text-xs text-amber-500/80">Database Maintenance</p>
              </div>
          </div>
          {!isRunning && (
              <button 
                onClick={runMigration}
                className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded flex items-center gap-2 font-bold transition-colors"
              >
                  <Play className="w-4 h-4"/> Run Migration
              </button>
          )}
      </div>

      <div className="p-6 bg-slate-950">
          <div className="mb-4">
             <h4 className="text-slate-400 text-sm uppercase font-bold mb-2">Task: Backfill Character Counts</h4>
             <p className="text-slate-500 text-sm">
                 This script will scan every user profile, count their actual number of characters in the database, 
                 and update their <code className="bg-slate-800 px-1 rounded text-slate-300">settings/account</code> document 
                 with a <code className="bg-slate-800 px-1 rounded text-slate-300">characterCount</code> field.
             </p>
          </div>

          {isRunning && (
              <div className="mb-6">
                  <div className="flex justify-between text-xs text-amber-500 mb-1">
                      <span>Progress</span>
                      <span>{progress} / {total} Users</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-500 transition-all duration-300"
                        style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }}
                      />
                  </div>
              </div>
          )}

          <div className="bg-black rounded border border-slate-800 p-4 font-mono text-xs h-64 overflow-y-auto custom-scrollbar">
              {logs.length === 0 ? (
                  <div className="text-slate-600 flex items-center gap-2">
                      <Terminal className="w-4 h-4"/> Ready to start...
                  </div>
              ) : (
                  logs.map((log, i) => (
                      <div key={i} className="text-green-500/80 mb-1">{log}</div>
                  ))
              )}
              {isRunning && <div className="text-amber-500 animate-pulse mt-2">Processing...</div>}
          </div>
      </div>
    </div>
  );
}