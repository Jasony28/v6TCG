// Fichier : functions/index.js (Version finale V3 avec quêtes)
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {log, error} = require("firebase-functions/logger");

initializeApp();
const db = getFirestore();

// On copie ici la liste des quêtes pour que le serveur les connaisse
const battlePassQuests = [
    { id: 'S1Q05', type: 'win_auction', xp_reward: 10 }, { id: 'S1Q10', type: 'win_auction', xp_reward: 10 },
    { id: 'S1Q08', type: 'earn_coins', target: 5, xp_reward: 10 }, { id: 'S2Q07', type: 'earn_coins', target: 10, xp_reward: 10 },
    { id: 'S3Q09', type: 'win_auction_over_price', target: 5, xp_reward: 10 }, { id: 'S4Q10', type: 'win_auction_over_price', target: 10, xp_reward: 10 },
    // On pourrait ajouter toutes les autres quêtes ici pour une logique plus complexe
];

exports.closeAuctions = onSchedule({
  schedule: "every 5 minutes", region: "europe-west1", memory: "512MiB"
}, async (event) => {
  log("Vérification des enchères terminées...");
  const now = new Date();
  const query = db.collection("auctions").where("status", "==", "active").where("endTime", "<=", now);
  const expiredAuctionsSnapshot = await query.get();

  if (expiredAuctionsSnapshot.empty) {
    log("Aucune enchère terminée à traiter.");
    return null;
  }
  const promises = expiredAuctionsSnapshot.docs.map(doc => processSingleAuction({ id: doc.id, ...doc.data() }));
  return Promise.all(promises);
});

async function processSingleAuction(auction) {
  const auctionRef = db.collection("auctions").doc(auction.id);
  return db.runTransaction(async (transaction) => {
    const freshAuctionDoc = await transaction.get(auctionRef);
    if (freshAuctionDoc.data().status !== "active") { return; }

    if (auction.highestBidderId) {
      log(`Gagnant pour ${auction.id}: ${auction.highestBidderPseudo}`);
      const winnerRef = db.collection("users").doc(auction.highestBidderId);
      const sellerRef = db.collection("users").doc(auction.sellerId);
      
      transaction.update(winnerRef, { [`collection.${auction.cardId}.quantity`]: FieldValue.increment(auction.quantity) });
      transaction.update(sellerRef, { coins: FieldValue.increment(auction.currentPrice) });
      
      const winnerEvents = [{type: 'win_auction', amount: 1}];
      if(auction.currentPrice > 5) winnerEvents.push({type: 'win_auction_over_price', amount: auction.currentPrice});
      if(auction.currentPrice > 10) winnerEvents.push({type: 'win_auction_over_price', amount: auction.currentPrice});
      await updatePlayerQuests(transaction, winnerRef, winnerEvents);

      await updatePlayerQuests(transaction, sellerRef, [{type: 'earn_coins', amount: auction.currentPrice}]);

      transaction.update(auctionRef, { status: "closed_won" });
    } else {
      log(`Aucune mise pour ${auction.id}. Retour de la carte.`);
      const sellerRef = db.collection("users").doc(auction.sellerId);
      transaction.update(sellerRef, { [`collection.${auction.cardId}.quantity`]: FieldValue.increment(auction.quantity) });
      transaction.update(auctionRef, { status: "closed_no_bids" });
    }
  }).then(() => log(`Transaction pour ${auction.id} réussie.`))
    .catch((err) => error(`Erreur de transaction pour ${auction.id}:`, err));
}

async function updatePlayerQuests(transaction, userRef, events) {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) return;
    const bpData = userDoc.data().battlePass;
    if (!bpData) return;

    let xpGained = 0;
    events.forEach(event => {
        battlePassQuests.filter(q => q.type === event.type).forEach(quest => {
            let questProgress = bpData.questProgress[quest.id] || { progress: 0, completed: false };
            if (!questProgress.completed) {
                let progressAmount = questProgress.progress + event.amount;
                if(quest.type.includes('over_price') && progressAmount < quest.target) return;

                if(progressAmount >= quest.target) {
                    questProgress.completed = true;
                    xpGained += quest.xp_reward || 0;
                }
                bpData.questProgress[quest.id] = { progress: progressAmount, completed: questProgress.completed };
            }
        });
    });

    if (xpGained > 0) {
        bpData.xp = (bpData.xp || 0) + xpGained;
    }
    transaction.update(userRef, { battlePass: bpData });
}