// Fichier: marche.js (Version 100% Complète et Corrigée)

import { showToast } from './toast.js';
import { collection, query, where, getDocs, Timestamp, doc, runTransaction, onSnapshot, orderBy, increment } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { db } from './firebase-config.js';
import { protectPage } from './auth-manager.js';
import { allCards } from './cards.js';
import { updateQuestProgress } from './quest-manager.js';
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js"; // Ajoutez cet import en haut
// --- Variable Globale ---
let localUserData;

// --- Initialisation Conditionnelle ---
// On ne lance le code de la page que si l'élément principal (#auctions-grid) est trouvé.
const auctionsGridElement = document.getElementById('auctions-grid');
if (auctionsGridElement) {
    initializeMarketplace();
}

/**
 * Initialise la page du marché, récupère les données et attache les écouteurs.
 */
async function initializeMarketplace() {
    // DÉPLACÉ : Toutes les constantes du DOM sont maintenant à l'intérieur de la fonction d'initialisation.
    const auctionsGrid = auctionsGridElement;
    const noAuctionsMessage = document.getElementById('no-auctions-message');
    const bidModal = document.getElementById('bid-modal');
    const closeModalBtn = bidModal.querySelector('.close-btn');
    const modalCardName = document.getElementById('modal-card-name');
    const modalCardPreview = document.getElementById('modal-card-preview');
    const modalSellerPseudo = document.getElementById('modal-seller-pseudo');
    const modalCurrentPrice = document.getElementById('modal-current-price');
    const modalTimeLeft = document.getElementById('modal-time-left');
    const bidAmountInput = document.getElementById('bid-amount-input');
    const bidHistoryList = document.getElementById('bid-history-list');
    
    let unsubscribeBidListener = null;

    localUserData = await protectPage();
    if (!localUserData) return;
updateHeaderUI(localUserData);
    // --- Écouteurs d'événements ---
    closeModalBtn.addEventListener('click', () => closeBidModal(unsubscribeBidListener));
    bidModal.addEventListener('click', (e) => {
        if (e.target === bidModal) {
            closeBidModal(unsubscribeBidListener);
        }
    });

    await finalizeExpiredAuctions();
    fetchAndDisplayAuctions();

    // Toutes les fonctions dépendant des éléments du DOM sont maintenant imbriquées ou appelées depuis ici.
    
    async function fetchAndDisplayAuctions() {
        auctionsGrid.innerHTML = '';
        const q = query(collection(db, "auctions"), where("status", "==", "active"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            noAuctionsMessage.style.display = 'block';
        } else {
            noAuctionsMessage.style.display = 'none';
            querySnapshot.forEach(doc => {
                const auctionData = { id: doc.id, ...doc.data() };
                const cardInfo = allCards.find(c => c.id === auctionData.cardId);
                if (cardInfo) {
                    const auctionCard = createAuctionCard(auctionData, cardInfo);
                    auctionsGrid.appendChild(auctionCard);
                }
            });
        }
    }

    function createAuctionCard(auction, card) {
        const cardDiv = document.createElement('div');
        cardDiv.className = `card rarity-${card.rarity.replace('é', 'e')}`;
        cardDiv.style.cursor = 'pointer';
        const cardImage = document.createElement('img');
        cardImage.className = 'card-image';
        cardImage.src = card.image;
        cardImage.alt = card.name;
        cardDiv.appendChild(cardImage);
        let owned = localUserData.collection?.[card.id]?.quantity > 0;
        const badge = document.createElement('div');
        badge.className = 'ownership-badge ' + (owned ? 'owned' : 'not-owned');
        badge.textContent = owned ? 'Possédée' : 'Pas possédée';
        cardDiv.appendChild(badge);
        const infoOverlay = document.createElement('div');
        infoOverlay.className = 'auction-info-overlay';
        const timeLeft = calculateTimeLeft(auction.endTime);
        infoOverlay.innerHTML = `<p class="auction-card-name">${card.name} (x${auction.quantity})</p><p>Prix: <strong>${auction.currentPrice} pièces</strong></p><p>Temps restant: ${timeLeft}</p>`;
        cardDiv.appendChild(infoOverlay);
        cardDiv.addEventListener('click', () => {
            if (auction.sellerId === localUserData.uid) {
                openOwnAuctionModal(auction, card);
            } else {
                openBidModal(auction, card);
            }
        });
        return cardDiv;
    }

    function openBidModal(auction, card) {
        document.querySelector('.bid-form').style.display = 'flex';
        const modalErrorMessage = document.getElementById('modal-error-message');
        modalErrorMessage.textContent = '';
        bidModal.style.display = 'flex';
        modalCardName.textContent = `${card.name} (x${auction.quantity})`;
        modalCardPreview.innerHTML = `<img src="${card.image}" class="card-image">`;
        modalCardPreview.className = `card rarity-${card.rarity.replace('é', 'e')}`;
        modalSellerPseudo.textContent = auction.sellerPseudo;
        modalCurrentPrice.textContent = auction.currentPrice;
        modalTimeLeft.textContent = calculateTimeLeft(auction.endTime);
        const minBid = auction.currentPrice + 1;
        bidAmountInput.min = minBid;
        bidAmountInput.placeholder = `Minimum ${minBid} pièces`;
        bidAmountInput.value = minBid;
        const submitBtn = document.getElementById('submit-bid-button');
        const newSubmitBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
        newSubmitBtn.addEventListener('click', () => handlePlaceBid(auction));
        fetchAndDisplayBidHistory(auction.id);
    }
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

    function openOwnAuctionModal(auction, card) {
        bidModal.style.display = 'flex';
        modalCardName.textContent = `${card.name} (x${auction.quantity})`;
        modalCardPreview.innerHTML = `<img src="${card.image}" class="card-image">`;
        modalCardPreview.className = `card rarity-${card.rarity.replace('é', 'e')}`;
        modalSellerPseudo.textContent = auction.sellerPseudo;
        modalCurrentPrice.textContent = auction.currentPrice;
        modalTimeLeft.textContent = calculateTimeLeft(auction.endTime);
        document.querySelector('.bid-form').style.display = 'none';
        document.getElementById('modal-error-message').textContent = "Historique des enchères sur votre vente :";
        fetchAndDisplayBidHistory(auction.id);
    }

    function fetchAndDisplayBidHistory(auctionId) {
        const bidsRef = collection(db, "auctions", auctionId, "bids");
        const q = query(bidsRef, orderBy("timestamp", "desc"));
        if (unsubscribeBidListener) unsubscribeBidListener();
        unsubscribeBidListener = onSnapshot(q, (snapshot) => {
            bidHistoryList.innerHTML = '';
            if (snapshot.empty) {
                bidHistoryList.innerHTML = '<li>Aucune enchère pour le moment.</li>';
            } else {
                snapshot.forEach(doc => {
                    const bid = doc.data();
                    const li = document.createElement('li');
                    li.innerHTML = `<strong>${bid.bidderPseudo}</strong> a enchéri <strong>${bid.amount}</strong> pièces`;
                    bidHistoryList.appendChild(li);
                });
            }
        });
    }

    function closeBidModal() {
        if (unsubscribeBidListener) {
            unsubscribeBidListener();
            unsubscribeBidListener = null;
        }
        if(bidModal) bidModal.style.display = 'none';
    }

    async function handlePlaceBid(auction) {
        const bidAmount = parseInt(bidAmountInput.value);
        const submitBidButton = document.getElementById('submit-bid-button');
        const modalErrorMessage = document.getElementById('modal-error-message');
        submitBidButton.disabled = true;
        modalErrorMessage.textContent = "Validation de l'enchère...";
        try {
            await runTransaction(db, async (transaction) => {
                const auctionRef = doc(db, "auctions", auction.id);
                const userRef = doc(db, "users", localUserData.uid);
                const auctionDoc = await transaction.get(auctionRef);
                const userDoc = await transaction.get(userRef);
                if (!auctionDoc.exists() || !userDoc.exists()) throw new Error("L'enchère ou l'utilisateur n'existe plus.");
                const auctionData = auctionDoc.data();
                const bidderData = userDoc.data();
                if (auctionData.status !== 'active') throw new Error("Cette enchère est déjà terminée.");
                if (bidAmount <= auctionData.currentPrice) throw new Error("Votre mise doit être supérieure au prix actuel.");
                if ((bidderData.coins || 0) < bidAmount) throw new Error("Vous n'avez pas assez de pièces.");
                if (auctionData.highestBidderId) {
                    const previousBidderRef = doc(db, "users", auctionData.highestBidderId);
                    transaction.update(previousBidderRef, { coins: increment(auctionData.currentPrice) });
                }
                transaction.update(userRef, { coins: increment(-bidAmount) });
                transaction.update(auctionRef, {
                    currentPrice: bidAmount,
                    highestBidderId: localUserData.uid,
                    highestBidderPseudo: localUserData.pseudo
                });
                const newBidRef = doc(collection(db, "auctions", auction.id, "bids"));
                transaction.set(newBidRef, {
                    bidderId: localUserData.uid,
                    bidderPseudo: localUserData.pseudo,
                    amount: bidAmount,
                    timestamp: Timestamp.now()
                });
            });
            await updateQuestProgress(localUserData.uid, 'place_bid', 1);
            showToast("Enchère placée avec succès !", "success");
            fetchAndDisplayAuctions();
        } catch (error) {
            console.error("Erreur lors de l'enchère: ", error);
            showToast(`Erreur : ${error.message}`, 'error');
        } finally {
            submitBidButton.disabled = false;
        }
    }

    async function finalizeExpiredAuctions() {
        const q = query(collection(db, "auctions"), where("status", "==", "active"), where("endTime", "<=", Timestamp.now()));
        const snapshot = await getDocs(q);
        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const auctionRef = doc(db, "auctions", docSnap.id);
            await runTransaction(db, async (transaction) => {
                const sellerRef = doc(db, "users", data.sellerId);
                if (data.highestBidderId) {
                    const buyerRef = doc(db, "users", data.highestBidderId);
                    const buyerCollectionPath = `collection.${data.cardId}.quantity`;
                    transaction.update(buyerRef, { [buyerCollectionPath]: increment(data.quantity) });
                    transaction.update(sellerRef, { coins: increment(data.currentPrice) });
                } else {
                    const returnPath = `collection.${data.cardId}.quantity`;
                    transaction.update(sellerRef, { [returnPath]: increment(data.quantity) });
                }
                transaction.update(auctionRef, { status: 'ended' });
            });
            if (data.highestBidderId) {
                await updateQuestProgress(data.sellerId, 'earn_market', data.currentPrice);
            }
        }
    }
}

/**
 * Vend une ou plusieurs cartes directement au système pour un prix fixe.
 * Cette fonction est exportée pour être utilisée par d'autres modules (comme collection.js).
 */
export async function sellCardToConsole(cardId, quantityToSell, pricePerCard) {
    if (!localUserData) {
        localUserData = await protectPage();
        if (!localUserData) return showToast("Veuillez vous reconnecter.", "error");
    }

    const userRef = doc(db, "users", localUserData.uid);
    const cardOwned = localUserData.collection?.[cardId]?.quantity || 0;
    if (cardOwned < quantityToSell) {
        return showToast("Vous n'avez pas assez de cette carte pour la vendre.", "error");
    }

    const totalGain = quantityToSell * pricePerCard;

    try {
        await runTransaction(db, async (transaction) => {
            const cardPath = `collection.${cardId}.quantity`;
            transaction.update(userRef, {
                [cardPath]: increment(-quantityToSell),
                coins: increment(totalGain)
            });
        });

        await updateQuestProgress(localUserData.uid, 'sell_console', quantityToSell);
        showToast(`${quantityToSell} carte(s) vendue(s) pour ${totalGain} pièces.`, "success");
        
        localUserData.coins += totalGain;
        if(localUserData.collection[cardId]) {
            localUserData.collection[cardId].quantity -= quantityToSell;
        }

    } catch (error) {
        console.error("Erreur lors de la vente à la console:", error);
        showToast("Une erreur est survenue lors de la vente.", "error");
    }
}

function calculateTimeLeft(endTime) {
    const diff = endTime.toMillis() - Date.now();
    if (diff <= 0) return "Terminée";
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}