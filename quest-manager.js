// Fichier: quest-manager.js (Version finale et corrigée)

import { doc, runTransaction, increment } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { db } from './firebase-config.js';
import { questsConfig } from './battlepass-config.js';
import { showToast } from './toast.js';

export async function updateQuestProgress(userId, actionType, value = 1) {
    if (!userId) return;
    const userRef = doc(db, "users", userId);

    try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw "User document not found";

            const userData = userDoc.data();
            const bpData = userData.battlePass || { questProgress: {}, rewardsUnlocked: 0, claimedRewards: {} };
            bpData.questProgress = bpData.questProgress || {};
            let questsCompletedThisAction = 0;

            for (const questId in questsConfig) {
                const questDef = questsConfig[questId];
                if (questDef.actionType !== actionType) continue;

                if (!bpData.questProgress[questId]) {
                    if (questId === 'q6') bpData.questProgress[questId] = { progress: [], completed: false };
                    else bpData.questProgress[questId] = { progress: 0, completed: false };
                }
                
                const questProg = bpData.questProgress[questId];
                if (questProg.completed) continue;

                let newProgress = questProg.progress;

                // CORRECTION : q7 est maintenant gérée comme une quête numérique normale.
                switch (questId) {
                    case 'q1':
                    case 'q2':
                    case 'q4':
                    case 'q5':
                    case 'q7': // q7 est ici avec les autres quêtes simples.
                        newProgress += 1; 
                        break;
                    case 'q3': 
                        newProgress += value; 
                        break;
                    case 'q6':
                        const today = new Date().toDateString();
                        const progressSet = new Set(newProgress);
                        progressSet.add(today);
                        newProgress = Array.from(progressSet);
                        break;
                }
                
                questProg.progress = newProgress;

                let isNowCompleted = false;
                if (questId === 'q6') isNowCompleted = questProg.progress.length >= questDef.target;
                else isNowCompleted = questProg.progress >= questDef.target;

                if (isNowCompleted) {
                    questProg.completed = true;
                    questsCompletedThisAction++;
                }
            }
            
            const updates = { 'battlePass.questProgress': bpData.questProgress };
            if (questsCompletedThisAction > 0) {
                updates['battlePass.rewardsUnlocked'] = increment(questsCompletedThisAction);
            }
            transaction.update(userRef, updates);
        });
    } catch (e) {
        console.error("La transaction de mise à jour de quête a échoué : ", e);
    }
}