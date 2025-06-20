// Fichier: game.js (Version Finale Complète et Corrigée)

import { updateDoc, doc, getDoc, Timestamp, runTransaction, increment } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { db } from './firebase-config.js';
import { protectPage } from './auth-manager.js';
import { allCards } from './cards.js';
import { updateQuestProgress } from './quest-manager.js';

// --- Éléments du DOM ---
const boosterStatusEl = document.getElementById('booster-status');
const cardRevealArea = document.getElementById('card-reveal-area');
const boosterSelectionContainer = document.getElementById('booster-selection-container');
const dailyBoosterArea = document.getElementById('daily-booster-area');
const dailyBoosterImage = document.getElementById('booster-pack-image');
const classicBoosterArea = document.getElementById('classic-booster-area');
const classicBoosterCountEl = document.getElementById('classic-booster-count');
const classicBoosterOpener = document.getElementById('classic-booster-opener');
const legendaryBoosterArea = document.getElementById('legendary-booster-area');
const legendaryBoosterCountEl = document.getElementById('legendary-booster-count');
const legendaryBoosterOpener = document.getElementById('legendary-booster-opener');

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

// --- Fonctions principales ---

function displayAvailableBoosters() {
    const boostersOpened = userData.dailyBoosterOpenedCount || 0;
    const DAILY_BOOSTER_LIMIT = 5; // Limite augmentée pour les tests
    dailyBoosterArea.style.display = 'block';

    if (boostersOpened < DAILY_BOOSTER_LIMIT) {
        const remaining = DAILY_BOOSTER_LIMIT - boostersOpened;
        boosterStatusEl.textContent = `Boosters quotidiens restants : ${remaining}/${DAILY_BOOSTER_LIMIT}`;
        dailyBoosterImage.style.opacity = 1;
        dailyBoosterImage.style.cursor = 'pointer';
        dailyBoosterImage.addEventListener('click', () => openBooster('daily'), { once: true });
    } else {
        boosterStatusEl.textContent = "Boosters quotidiens épuisés. Revenez demain !";
        dailyBoosterImage.style.opacity = 0.5;
        dailyBoosterImage.style.cursor = 'not-allowed';
    }

    const classicBoosters = userData.boosterInventory?.classic || 0;
    if (classicBoosters > 0) {
        classicBoosterArea.style.display = 'block';
        classicBoosterCountEl.textContent = `x${classicBoosters}`;
        classicBoosterOpener.addEventListener('click', () => openBooster('classic'), { once: true });
    } else {
        classicBoosterArea.style.display = 'none';
    }

    const legendaryBoosters = userData.boosterInventory?.legendary || 0;
    if (legendaryBoosters > 0) {
        legendaryBoosterArea.style.display = 'block';
        legendaryBoosterCountEl.textContent = `x${legendaryBoosters}`;
        legendaryBoosterOpener.addEventListener('click', () => openBooster('legendary'), { once: true });
    } else {
        legendaryBoosterArea.style.display = 'none';
    }
}

async function openBooster(boosterType) {
    if (!userData) return;
    boosterSelectionContainer.style.display = 'none';
    cardRevealArea.style.display = 'grid';
    
    let drawnCards;
    const drawBoosterType = (boosterType === 'daily') ? 'classic' : boosterType;

    if (drawBoosterType === 'legendary') {
        drawnCards = drawLegendaryBoosterCards();
    } else {
        drawnCards = drawClassicBoosterCards();
    }
    
    await updateUserAfterBoosterOpen(boosterType, drawnCards);

    // Déclenchement des quêtes
    await updateQuestProgress(userData.uid, 'open_booster', 1);
    await updateQuestProgress(userData.uid, 'open_booster_typed', drawBoosterType);
    
    const hasLegendary = drawnCards.some(card => card.rarity === 'Légendaire');
    if (hasLegendary) {
        await updateQuestProgress(userData.uid, 'obtain_legendary', 1);
    }
    
    startProgressiveReveal(drawnCards);
}

function startProgressiveReveal(cards) {
    let currentCardIndex = 0;
    let isClickable = true;

    boosterStatusEl.textContent = 'Cliquez sur la carte pour révéler la suivante.';
    cardRevealArea.innerHTML = '<div id="reveal-slot" class="card" style="cursor: pointer;"></div>';
    const revealSlot = document.getElementById('reveal-slot');
    
    const displayCard = (card) => {
        revealSlot.innerHTML = `<img src="${card.image}" alt="${card.name}" class="card-image">`;
        revealSlot.className = `card rarity-${card.rarity.replace('é', 'e')}`;
    };

    const returnToBoosterSelection = async () => {
        boosterStatusEl.textContent = 'Booster terminé !';
        revealSlot.innerHTML = '';
        revealSlot.style.cursor = 'default';
        revealSlot.className = 'card';
        revealSlot.removeEventListener('click', revealNextCardHandler);

        setTimeout(async () => {
            cardRevealArea.style.display = 'none';
            boosterSelectionContainer.style.display = 'flex';
            
            const userDocRef = doc(db, "users", userData.uid);
            const updatedUserDoc = await getDoc(userDocRef);
            userData = { uid: userData.uid, ...updatedUserDoc.data() };
            
            updateHeaderUI(userData); // Mettre à jour le header avec les nouvelles données
            displayAvailableBoosters();
        }, 500);
    };

    const revealNextCardHandler = () => {
        if (!isClickable) return;
        isClickable = false;
        currentCardIndex++;

        if (currentCardIndex < cards.length) {
            displayCard(cards[currentCardIndex]);
            if (currentCardIndex === cards.length - 1) {
                boosterStatusEl.textContent = 'Voici la dernière carte. Cliquez à nouveau pour terminer.';
            }
        } else {
            returnToBoosterSelection();
        }

        setTimeout(() => { isClickable = true; }, 250);
    };

    displayCard(cards[currentCardIndex]);
    revealSlot.addEventListener('click', revealNextCardHandler);
}


async function updateUserAfterBoosterOpen(boosterType, drawnCards) {
    const userDocRef = doc(db, "users", userData.uid);
    try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists()) throw new Error("Utilisateur non trouvé.");
            const currentData = userDoc.data();
            const updates = {};
            
            const newCollection = currentData.collection || {};
            drawnCards.forEach(card => {
                newCollection[card.id] = { quantity: (newCollection[card.id]?.quantity || 0) + 1 };
            });
            updates.collection = newCollection;

            if (boosterType === 'daily') {
                updates.dailyBoosterOpenedCount = increment(1);
            } else if (boosterType === 'classic') {
                if ((currentData.boosterInventory.classic || 0) < 1) throw new Error("Pas de booster classique à ouvrir.");
                updates['boosterInventory.classic'] = increment(-1);
            } else if (boosterType === 'legendary') {
                if ((currentData.boosterInventory.legendary || 0) < 1) throw new Error("Pas de booster légendaire à ouvrir.");
                updates['boosterInventory.legendary'] = increment(-1);
            }
            
            transaction.update(userDocRef, updates);
        });
    } catch (error) {
        console.error("Erreur - mise à jour après ouverture booster:", error);
    }
}

function drawClassicBoosterCards() {
    const commons = allCards.filter(c => c.rarity === 'Commune');
    const rares = allCards.filter(c => c.rarity === 'Rare');
    const epics = allCards.filter(c => c.rarity === 'Épique');
    const legendaries = allCards.filter(c => c.rarity === 'Légendaire');
    const drawn = [];
    for (let i = 0; i < 3; i++) { drawn.push(commons[Math.floor(Math.random() * commons.length)]); }
    drawn.push(rares[Math.floor(Math.random() * rares.length)]);
    const fifthCardRoll = Math.random();
    if (fifthCardRoll < 0.10) {
        drawn.push(legendaries[Math.floor(Math.random() * legendaries.length)]);
    } else if (fifthCardRoll < 0.55) {
        drawn.push(epics[Math.floor(Math.random() * epics.length)]);
    } else {
        drawn.push(rares[Math.floor(Math.random() * rares.length)]);
    }
    return drawn;
}

function drawLegendaryBoosterCards() {
    const commons = allCards.filter(c => c.rarity === 'Commune');
    const rares = allCards.filter(c => c.rarity === 'Rare');
    const legendaries = allCards.filter(c => c.rarity === 'Légendaire');
    const commonAndRares = [...commons, ...rares];
    const drawn = [];
    for (let i = 0; i < 4; i++) { drawn.push(commonAndRares[Math.floor(Math.random() * commonAndRares.length)]); }
    drawn.push(legendaries[Math.floor(Math.random() * legendaries.length)]);
    return drawn.sort(() => Math.random() - 0.5);
}

async function checkAndResetDailyCounter() {
    const today = new Date().toDateString();
    const lastReset = userData.dailyLastReset ? new Date(userData.dailyLastReset.seconds * 1000).toDateString() : null;
    if (today !== lastReset) {
        const userDocRef = doc(db, "users", userData.uid);
        await updateDoc(userDocRef, {
            dailyBoosterOpenedCount: 0,
            dailyLastReset: Timestamp.now()
        });
        userData.dailyBoosterOpenedCount = 0;
    }
}

/**
 * Fonction principale qui lance la page.
 */
async function initializePage() {
    userData = await protectPage();
    if (!userData) return;

    if (!userData.boosterInventory) userData.boosterInventory = { classic: 0, legendary: 0 };
    if (!userData.battlePass) userData.battlePass = { rewardsUnlocked: 0, questProgress: {}, claimedRewards: {} };

    updateHeaderUI(userData);
    await checkAndResetDailyCounter();
    displayAvailableBoosters();
}

// Lancement de l'initialisation de la page
initializePage();