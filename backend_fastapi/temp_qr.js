
const { BakongKHQR, IndividualInfo } = require('../backend/node_modules/bakong-khqr');
const amount = parseFloat(process.argv[2]);
const khqr = new BakongKHQR();
const info = new IndividualInfo(
    'chheak_narat@bkrt',
    'CHHEAK NARAT',
    'Phnom Penh',
    {
        currency: '840', // USD
        amount: amount,
        expirationTimestamp: (Date.now() + 2 * 60 * 1000).toString()
    }
);
const result = khqr.generateIndividual(info);
console.log(JSON.stringify(result.data));
    