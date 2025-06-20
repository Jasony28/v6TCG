// Fichier: collection.js (Version Complète, Corrigée et Fonctionnelle)

import { doc, runTransaction, Timestamp, collection, increment } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { db } from './firebase-config.js';
import { protectPage } from './auth-manager.js';
import { allCards } from './cards.js';
import { showToast, showConfirmDialog } from './toast.js';
import { sellCardToConsole } from './marche.js';
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js"; // Ajoutez cet import en haut

// --- Éléments du DOM ---
const collectionGrid = document.getElementById('collection-grid');
const overlay = document.getElementById('card-overlay');
const closeBtn = overlay.querySelector('.close-btn');
const viewMode = document.getElementById('view-mode');
const overlayImage = document.getElementById('overlay-image');
const overlayCardName = document.getElementById('overlay-card-name');
const overlayCardQuantity = document.getElementById('overlay-card-quantity');
const auctionButton = document.getElementById('auction-button');
const consoleSellButton = document.getElementById('console-sell-button');

// Éléments de la modale de vente/enchère
const sellMode = document.getElementById('sell-mode');
const sellCardName = document.getElementById('sell-card-name');
const sellCardPreview = document.getElementById('sell-card-preview');
const sellMaxQuantity = document.getElementById('sell-max-quantity');
const sellMinPrice = document.getElementById('sell-min-price');
const sellQuantityInput = document.getElementById('sell-quantity-input');
const sellPriceInput = document.getElementById('sell-price-input');
const confirmSellButton = document.getElementById('confirm-sell-button');
const modalErrorMessage = document.getElementById('modal-error-message');

let localUserData;

// --- Initialisation ---
// Code corrigé
async function initializeCollection() {
    localUserData = await protectPage();
    if (localUserData) {
        updateHeaderUI(localUserData); // <--- LIGNE À AJOUTER ICI
        if (!localUserData.collection) localUserData.collection = {};
        displayCollection(localUserData.collection);
    }
}

// --- Fonctions d'affichage ---
function displayCollection(userCollection) {
    collectionGrid.innerHTML = '';
    allCards.forEach(card => {
        const cardData = userCollection ? (userCollection[card.id] || null) : null;
        const owned = cardData && cardData.quantity > 0;
        const cardDiv = document.createElement('div');
        cardDiv.className = `card rarity-${card.rarity.replace('é', 'e')}`;

        if (owned) {
            const cardImage = document.createElement('img');
            cardImage.className = 'card-image';
            cardImage.src = card.image;
            cardImage.alt = card.name;
            cardDiv.appendChild(cardImage);

            if (cardData.quantity > 1) {
                const quantityDiv = document.createElement('div');
                quantityDiv.className = 'card-quantity';
                quantityDiv.textContent = `x${cardData.quantity}`;
                cardDiv.appendChild(quantityDiv);
            }
            cardDiv.addEventListener('click', () => openCardOverlay(card, cardData));
        } else {
            cardDiv.classList.add('card-back-display');
        }
        
        collectionGrid.appendChild(cardDiv);
    });
}

function openCardOverlay(card, cardData) {
    modalErrorMessage.textContent = '';
    viewMode.style.display = 'block';
    sellMode.style.display = 'none';

    overlayImage.src = card.image;
    overlayCardName.textContent = card.name;
    overlayCardQuantity.textContent = cardData.quantity;

    // On ne peut vendre ou mettre aux enchères que les doublons
    const hasDuplicates = cardData.quantity > 1;
    auctionButton.style.display = hasDuplicates ? 'block' : 'none';
    consoleSellButton.style.display = hasDuplicates ? 'block' : 'none';

    if (hasDuplicates) {
        auctionButton.onclick = () => showAuctionForm(card, cardData);
        consoleSellButton.onclick = () => showConsoleSellForm(card, cardData);
    }
    
    overlay.style.display = 'flex';
}

function closeOverlay() {
    overlay.style.display = 'none';
}

// --- Fonctions des formulaires de la modale ---
function updateHeaderUI(userData) {
    const pseudoEl = document.getElementById('user-pseudo');
    const coinAmountEl = document.getElementById('coin-amount');
    const logoutButton = document.getElementById('logout-button');

    if (pseudoEl && userData?.pseudo) {
        pseudoEl.textContent = userData.pseudo;
    }
    if (coinAmountEl && userData?.coins !== undefined) {
        coinAmountEl.textContent = userData.coins;
    }
    if(logoutButton) {
        logoutButton.addEventListener('click', () => {
            const auth = getAuth();
            auth.signOut();
        });
    }
}
// Exemple pour battlepass.js (faites de même pour les autres)
async function initializePage() {
    userData = await protectPage();
    if (!userData) return;

    updateHeaderUI(userData); // <-- APPELEZ LA FONCTION ICI

    displayRewardTrack();
    displayQuests(userData);
}
function showAuctionForm(card, cardData) {
    viewMode.style.display = 'none';
    sellMode.style.display = 'block';
    const minPrice = { "Commune": 1, "Rare": 2, "Épique": 3, "Légendaire": 5 };
    const maxQuantity = cardData.quantity - 1;

    sellCardName.textContent = `Mettre '${card.name}' aux enchères`;
    sellCardPreview.innerHTML = `<img src="${card.image}" class="card-image">`;
    sellCardPreview.className = `card rarity-${card.rarity.replace('é', 'e')}`;
    
    sellMaxQuantity.textContent = maxQuantity;
    sellMinPrice.textContent = minPrice[card.rarity];
    
    sellQuantityInput.max = maxQuantity;
    sellQuantityInput.value = 1;
    sellQuantityInput.min = 1;

    // Afficher le champ de prix pour les enchères
    document.getElementById('sell-price-container').style.display = 'block';
    sellPriceInput.min = minPrice[card.rarity];
    sellPriceInput.value = minPrice[card.rarity];

    confirmSellButton.textContent = "Confirmer la mise en vente";
    confirmSellButton.onclick = () => createAuction(card, cardData);
}

function showConsoleSellForm(card, cardData) {
    viewMode.style.display = 'none';
    sellMode.style.display = 'block';
    const maxQuantity = cardData.quantity - 1;
    
    sellCardName.textContent = `Vendre '${card.name}' à la console`;
    sellCardPreview.innerHTML = `<img src="${card.image}" class="card-image">`;
    sellCardPreview.className = `card rarity-${card.rarity.replace('é', 'e')}`;
    
    sellMaxQuantity.textContent = maxQuantity;
    
    // Pour la vente à la console, le prix est fixe, donc on cache le champ
    document.getElementById('sell-price-container').style.display = 'none';

    sellQuantityInput.max = maxQuantity;
    sellQuantityInput.value = 1;
    sellQuantityInput.min = 1;

    confirmSellButton.textContent = "Vendre à la console";
    confirmSellButton.onclick = () => handleConsoleSell(card, cardData);
}

// --- Logique Métier (Vente et Enchères) ---

async function handleConsoleSell(card, cardData) {
    const quantityToSell = parseInt(sellQuantityInput.value);
    const maxQuantity = cardData.quantity - 1;
    if (!quantityToSell || quantityToSell <= 0 || quantityToSell > maxQuantity) {
        modalErrorMessage.textContent = `La quantité doit être entre 1 et ${maxQuantity}.`;
        return;
    }

    const consoleSellPrices = { "Commune": 1, "Rare": 2, "Épique": 3, "Légendaire": 5 };
    const pricePerCard = consoleSellPrices[card.rarity];

    const ok = await showConfirmDialog({
        title: "Vente à la console",
        message: `Voulez-vous vraiment vendre ${quantityToSell} exemplaire(s) de '${card.name}' pour ${pricePerCard * quantityToSell} pièce(s) ?`,
        confirmText: "Vendre",
        cancelText: "Annuler"
    });

    if (!ok) return;

    // On appelle la fonction centralisée dans marche.js
    await sellCardToConsole(card.id, quantityToSell, pricePerCard);
    
    // On met à jour l'affichage localement après le succès
    closeOverlay();
    // Re-fetch les données utilisateur pour être sûr d'avoir le solde à jour
    initializeCollection(); 
}

async function createAuction(card, cardData) {
    const quantityToSell = parseInt(sellQuantityInput.value);
    const startPrice = parseInt(sellPriceInput.value);
    const minPrice = { "Commune": 1, "Rare": 2, "Épique": 3, "Légendaire": 5 }[card.rarity];
    const maxQuantity = cardData.quantity - 1;

    if (!quantityToSell || quantityToSell <= 0 || quantityToSell > maxQuantity) {
        modalErrorMessage.textContent = `La quantité doit être entre 1 et ${maxQuantity}.`;
        return;
    }
    if (!startPrice || startPrice < minPrice) {
        modalErrorMessage.textContent = `Le prix de départ doit être d'au moins ${minPrice} pièces.`;
        return;
    }

    confirmSellButton.disabled = true;
    modalErrorMessage.textContent = "Création de l'enchère...";

    try {
        const userDocRef = doc(db, "users", localUserData.uid);
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists()) throw "Document utilisateur non trouvé.";

            const currentCollection = userDoc.data().collection;
            if (!currentCollection[card.id] || currentCollection[card.id].quantity < quantityToSell + 1) {
                throw "Vous ne pouvez vendre que des doublons et en quantité suffisante.";
            }

            transaction.update(userDocRef, { [`collection.${card.id}.quantity`]: increment(-quantityToSell) });

            const endTime = Timestamp.fromMillis(Date.now() + 12 * 60 * 60 * 1000); // 12 heures
            const auctionData = {
                sellerId: localUserData.uid,
                sellerPseudo: localUserData.pseudo,
                cardId: card.id,
                quantity: quantityToSell,
                startPrice: startPrice,
                currentPrice: startPrice,
                highestBidderId: null,
                highestBidderPseudo: null,
                endTime: endTime,
                status: 'active'
            };
            const auctionsColRef = collection(db, "auctions");
            transaction.set(doc(auctionsColRef), auctionData);
        });

        showToast("Votre carte a été mise aux enchères avec succès !", "success");
        closeOverlay();
        initializeCollection(); // Re-fetch pour mettre à jour l'affichage

    } catch (error) {
        modalErrorMessage.textContent = `Erreur : ${error.message || error}`;
    } finally {
        confirmSellButton.disabled = false;
    }
}

// --- Écouteurs d'événements ---
closeBtn.addEventListener('click', closeOverlay);
overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeOverlay();
});

// --- Lancement ---
initializeCollection();