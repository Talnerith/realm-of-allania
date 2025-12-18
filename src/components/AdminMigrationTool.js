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
    if (!window.confirm("Run Character Count Backfill?")) return;
    
    setIsRunning(true);
    setLogs(['Starting migration...', 'Scanning for user settings...']);
    setProgress(0);

    try {
      // FIX: Query the 'settings' collection group, then filter for 'account' doc
      const settingsQuery = query(collectionGroup(db, 'settings'));
      const settingsSnap = await getDocs(settingsQuery);
      
      const targets = [];

      settingsSnap.forEach(docSnap => {
          // 1. Ensure it is the 'account' document
          if (docSnap.id !== 'account') return;

          // 2. Ensure it belongs to THIS app
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
      addLog(`Found ${targets.length} valid user accounts.`);

      if (targets.length === 0) {
          addLog("WARNING: No users found. Check database structure.");
          setIsRunning(false);
          return;
      }

      let processed = 0;
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const target of targets) {
          // Count Characters
          const charColRef = collection(db, 'artifacts', APP_ID, 'users', target.userId, 'characters');
          const charSnap = await getDocs(charColRef);
          const realCount = charSnap.size;

          // Add to batch
          batch.update(target.accountRef, { characterCount: realCount });
          batchCount++;
          
          addLog(`User ${target.userId.substring(0,6)}... has ${realCount} chars. Queued.`);

          if (batchCount >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              batchCount = 0;
              addLog("-- Batch Committed --");
          }

          processed++;
          setProgress(processed);
      }

      if (batchCount > 0) {
          await batch.commit();
      }

      addLog('-----------------------------------');
      addLog(`Migration Complete. Updated ${processed} users.`);

    } catch (e) {
        console.error(e);
        addLog(`ERROR: ${e.message}`);
        if (e.message.includes('requires an index')) {
             addLog("Link to create index should be in Browser Console (F12).");
        }
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
                  <h3 className="text-amber-100 font-bold">Admin Migration Tool (Fixed)</h3>
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
          </div>
      </div>
    </div>
  );
}