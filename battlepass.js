// Fichier: battlepass.js (Version Finale Complète)

import { doc, getDoc, runTransaction, increment } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { db } from './firebase-config.js';
import { protectPage } from './auth-manager.js';
import { fullRewardsList, questsConfig } from './battlepass-config.js';
import { showToast } from './toast.js';

let userData;

/**
 * Met à jour le header avec les informations de l'utilisateur (pseudo, pièces).
 * @param {object} userData - Les données de l'utilisateur.
 */
function updateHeaderUI(userData) {
    const pseudoEl = document.getElementById('user-pseudo');
    const coinAmountEl = document.getElementById('coin-amount');
    
    if (pseudoEl && userData?.pseudo) {
        pseudoEl.textContent = userData.pseudo;
    }
    if (coinAmountEl && userData?.coins !== undefined) {
        coinAmountEl.textContent = userData.coins;
    }
}

/**
 * Affiche la piste des récompenses en fonction de la progression de l'utilisateur.
 */
function displayRewardTrack() {
    const trackContainer = document.querySelector('.pass-track');
    if (!trackContainer) return;
    trackContainer.innerHTML = '';

    const rewardsUnlockedCount = userData.battlePass?.rewardsUnlocked || 0;
    const claimedRewardsMap = userData.battlePass?.claimedRewards || {};

    fullRewardsList.forEach(reward => {
        const isUnlocked = reward.step <= rewardsUnlockedCount;
        const isClaimed = claimedRewardsMap[reward.step] === true;
        
        let cardStateClass = 'locked';
        if (isUnlocked && !isClaimed) {
            cardStateClass = 'unlocked';
        } else if (isClaimed) {
            cardStateClass = 'claimed';
        }

        const cardElement = document.createElement('div');
        cardElement.className = `pass-level-card ${cardStateClass}`;
        cardElement.id = `reward-card-${reward.step}`;
        
        let actionAreaHTML = '';
        if (isUnlocked && !isClaimed) {
            actionAreaHTML = `<button class="claim-button">RÉCLAMER</button>`;
        }
        
        cardElement.innerHTML = `
            <span class="level-number">Récompense ${reward.step}</span>
            <div class="reward-icon">${reward.type === 'coins' ? '🪙' : (reward.type === 'classic_booster' ? '🎴' : '🌟')}</div>
            <p class="reward-text">${reward.description}</p>
            <div class="action-area">${actionAreaHTML}</div>
        `;
        trackContainer.appendChild(cardElement);

        if (isUnlocked && !isClaimed) {
            cardElement.querySelector('.claim-button').addEventListener('click', () => handleClaimReward(reward));
        }
    });
}

/**
 * Affiche la liste des quêtes et leur progression.
 * @param {object} userData - Les données de l'utilisateur.
 */
function displayQuests(userData) {
    console.log("Données utilisateur pour l'affichage des quêtes:", JSON.parse(JSON.stringify(userData))); 

    const questsContainer = document.querySelector('.quests-list');
    if (!questsContainer) return;
    questsContainer.innerHTML = '';

    const userQuestProgress = userData?.battlePass?.questProgress || {};

    for (const questId in questsConfig) {
        const questDef = questsConfig[questId];
        const questProg = userQuestProgress[questId] || {};
        const isCompleted = questProg.completed || false;
        let progressText = isCompleted ? 'Terminée ✓' : '';
        
        if (!isCompleted) {
             // Nouveau Code (corrigé et simplifié)
switch (questId) {
    case 'q6':
        progressText = `${(questProg.progress?.length || 0)} / ${questDef.target}`;
        break;
    default:
        // La nouvelle quête q7 sera gérée ici, comme toutes les autres quêtes numériques
        progressText = `${(questProg.progress || 0)} / ${questDef.target}`;
}
        }
       
        const questElement = document.createElement('li');
        questElement.className = `quest-item ${isCompleted ? 'completed' : ''}`;
        questElement.innerHTML = `
            <span class="quest-description">${questDef.description}</span>
            <span class="quest-progress">${progressText}</span>
        `;
        questsContainer.appendChild(questElement);
    }
}

/**
 * Gère le clic sur le bouton "RÉCLAMER" d'une récompense.
 * @param {object} reward - L'objet de la récompense à réclamer.
 */
async function handleClaimReward(reward) {
    const button = document.querySelector(`#reward-card-${reward.step} .claim-button`);
    if(button) {
        button.disabled = true;
        button.textContent = '...';
    }

    const userRef = doc(db, "users", userData.uid);
    try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw new Error("Utilisateur non trouvé.");
            
            const bpData = userDoc.data().battlePass || {};
            if (reward.step > (bpData.rewardsUnlocked || 0)) throw new Error("Récompense non encore débloquée.");
            if (bpData.claimedRewards?.[reward.step]) throw new Error("Récompense déjà réclamée.");

            const updates = {};
            if (reward.type === 'coins') updates.coins = increment(reward.value);
            else if (reward.type === 'classic_booster') updates['boosterInventory.classic'] = increment(reward.value);
            else if (reward.type === 'legendary_booster') updates['boosterInventory.legendary'] = increment(reward.value);
            
            updates[`battlePass.claimedRewards.${reward.step}`] = true;
            transaction.update(userRef, updates);
        });

        showToast(`Récompense réclamée : ${reward.description}`, 'success');
        const updatedUserDoc = await getDoc(userRef);
        userData = { uid: userData.uid, ...updatedUserDoc.data() };
        updateHeaderUI(userData); // Mettre à jour le header avec les nouvelles pièces
        displayRewardTrack();

    } catch (error) {
        console.error("Erreur de réclamation:", error);
        showToast(error.message, 'error');
        if(button){
            button.disabled = false;
            button.textContent = 'RÉCLAMER';
        }
    }
}

/**
 * Fonction principale qui lance la page.
 */
async function initializePage() {
    userData = await protectPage();
    if (!userData) return;

    updateHeaderUI(userData);
    displayRewardTrack();
    displayQuests(userData);
}

// Lancement de l'initialisation de la page
initializePage();