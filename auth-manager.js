// Fichier: auth-manager.js
// Dans auth-manager.js
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js"; // <--- UNE SEULE LIGNE CORRECTE
import { db } from './firebase-config.js';
import { updateQuestProgress } from './quest-manager.js';
const auth = getAuth();

/**
 * Protège les pages nécessitant une connexion et retourne les données de l'utilisateur.
 */
export function protectPage() {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const userData = { uid: user.uid, ...userDoc.data() };
                    // On vérifie la quête de connexion quotidienne
                    await checkDailyLoginQuest(userData);
                    resolve(userData);
                } else {
                    // Logique pour créer un nouvel utilisateur si nécessaire
                    const newUser = {
                        pseudo: user.displayName || 'Nouveau Joueur',
                        email: user.email,
                        createdAt: serverTimestamp(),
                        coins: 100,
                        boosterInventory: { classic: 2, legendary: 0 },
                        collection: {},
                        battlePass: { rewardsUnlocked: 0, questProgress: {}, claimedRewards: {} }
                    };
                    await setDoc(userDocRef, newUser);
                    resolve({ uid: user.uid, ...newUser });
                }
            } else {
                window.location.href = 'index.html';
                resolve(null);
            }
        });
    });
}

/**
 * Vérifie si c'est la première connexion du jour et met à jour la quête correspondante.
 * @param {object} userData - Les données de l'utilisateur.
 */
async function checkDailyLoginQuest(userData) {
    const today = new Date().toDateString();
    const lastLogin = userData.lastLogin ? new Date(userData.lastLogin.seconds * 1000).toDateString() : null;

    if (today !== lastLogin) {
        console.log("Première connexion du jour, mise à jour de la quête 'daily_login'.");
        // Met à jour la quête et la date de dernière connexion
        await updateQuestProgress(userData.uid, 'daily_login');
        await setDoc(doc(db, "users", userData.uid), { lastLogin: serverTimestamp() }, { merge: true });
    }
}