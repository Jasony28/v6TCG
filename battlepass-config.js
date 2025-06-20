// Fichier: battlepass-config.js

function getRewardForStep(step) {
    const patternKey = (step - 1) % 10 + 1;
    let reward = { step: step };

    switch (patternKey) {
        case 3:
        case 6:
            reward.type = 'classic_booster';
            reward.value = 1;
            reward.description = 'Booster Classique';
            break;
        case 10:
            reward.type = 'legendary_booster';
            reward.value = 1;
            reward.description = 'Booster Légendaire';
            break;
        default:
            reward.type = 'coins';
            reward.value = 5;
            reward.description = '+5 Pièces';
            break;
    }
    return reward;
}

export const fullRewardsList = Array.from({ length: 30 }, (_, i) => getRewardForStep(i + 1));

export const questsConfig = {
    q1: { description: "Ouvrir 5 boosters", target: 5, actionType: 'open_booster' },
    q2: { description: "Vendre 3 cartes à la console", target: 3, actionType: 'sell_console' },
    q3: { description: "Gagner 150 pièces sur le marché", target: 150, actionType: 'earn_market' },
    q4: { description: "Participer à 3 enchères", target: 3, actionType: 'place_bid' },
    q5: { description: "Obtenir 1 carte légendaire", target: 1, actionType: 'obtain_legendary' },
    q6: { description: "Se connecter 3 jours différents", target: 3, actionType: 'daily_login' },
   q7: { description: "Ouvrir 25 boosters au total", target: 25, actionType: 'open_booster' }
};