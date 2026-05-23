// Each guide has: id, countries (lowercase match list), title, fiatCode (for Binance P2P link), methods[]
// Each method has: name, icon, steps[], tip (optional), warning (optional)

export const GUIDES = [
    {
        id:        "pakistan",
        countries: ["pakistan"],
        title:     "Pakistan",
        fiatCode:  "PKR",
        methods: [
            {
                name: "Binance P2P → JazzCash or EasyPaisa",
                icon: "📱",
                badge: "Recommended",
                steps: [
                    "Create a Binance account at binance.com and complete identity verification (CNIC + selfie).",
                    "In NexusFund, go to Dashboard → My Wallet and copy your wallet address.",
                    "In Binance, go to Wallet → Spot → Deposit → select USDC on Polygon (Matic) network, then send your USDC there.",
                    "Once USDC arrives, tap P2P Trading → Sell → USDC → set currency to PKR.",
                    "Filter ads by payment method: select JazzCash or EasyPaisa.",
                    "Choose a verified merchant with a high completion rate and place a sell order.",
                    "The buyer sends PKR to your JazzCash or EasyPaisa number. Confirm receipt, then release the USDC.",
                ],
                tip: "Always verify that the PKR payment has arrived in your app before releasing USDC. Never release based on a screenshot alone.",
            },
            {
                name: "Binance P2P → Bank Transfer",
                icon: "🏦",
                steps: [
                    "Follow steps 1–4 above to get USDC into Binance.",
                    "In P2P, filter ads by Bank Transfer (HBL, Meezan, UBL, etc.).",
                    "Place a sell order — the buyer sends PKR directly to your bank account.",
                    "Confirm the bank credit on your banking app, then release the USDC.",
                ],
                tip: "Bank transfers may take 15–30 minutes. Wait for the actual credit before releasing.",
            },
        ],
    },
    {
        id:        "kenya",
        countries: ["kenya"],
        title:     "Kenya",
        fiatCode:  "KES",
        methods: [
            {
                name: "Binance P2P → M-Pesa",
                icon: "📲",
                badge: "Recommended",
                steps: [
                    "Create a Binance account and complete KYC (National ID + selfie).",
                    "Copy your wallet address from NexusFund Dashboard → My Wallet.",
                    "In Binance, deposit USDC via Wallet → Spot → Deposit → select USDC on Polygon network.",
                    "Go to P2P Trading → Sell → USDC → set currency to KES.",
                    "Filter ads by M-Pesa and choose a merchant with high completion rate (95%+).",
                    "Place a sell order. The buyer sends KES to your M-Pesa number.",
                    "Check your M-Pesa for the SMS confirmation, then release the USDC.",
                ],
                tip: "Standard M-Pesa transactions appear within seconds. If you don't receive payment in 15 minutes, open a dispute through Binance P2P — do not release USDC.",
            },
            {
                name: "Paxful → M-Pesa",
                icon: "🔄",
                steps: [
                    "Create an account at paxful.com and verify your identity.",
                    "Click Sell Bitcoin/USDC and select M-Pesa as payment method.",
                    "Choose a buyer ad in KES and initiate the trade.",
                    "Buyer sends KES to your M-Pesa — confirm receipt, release USDC.",
                ],
                warning: "Paxful fees are typically 1–2% higher than Binance P2P.",
            },
        ],
    },
    {
        id:        "nigeria",
        countries: ["nigeria"],
        title:     "Nigeria",
        fiatCode:  "NGN",
        methods: [
            {
                name: "Binance P2P → Bank Transfer",
                icon: "🏦",
                badge: "Recommended",
                steps: [
                    "Create a Binance account and complete KYC (NIN or BVN + selfie).",
                    "Copy your wallet address from NexusFund Dashboard → My Wallet.",
                    "Deposit USDC into Binance via Wallet → Spot → Deposit → USDC on Polygon network.",
                    "Go to P2P Trading → Sell → USDC → set currency to NGN.",
                    "Filter by Bank Transfer — select GTBank, Access Bank, Zenith, UBA, or First Bank.",
                    "Place a sell order. Buyer sends NGN to your account. Verify in your banking app, then release.",
                ],
                tip: "Nigerian banks sometimes have instant transfer delays at night. Merchants on Binance P2P are used to this — they will wait.",
            },
            {
                name: "Quidax (Local Exchange)",
                icon: "🇳🇬",
                steps: [
                    "Create an account at quidax.com — a regulated Nigerian exchange.",
                    "Complete KYC with your BVN and government ID.",
                    "Send your USDC from your NexusFund wallet to your Quidax USDC deposit address.",
                    "Sell USDC for NGN on the Quidax market.",
                    "Withdraw NGN to your local bank account (usually instant).",
                ],
                tip: "Quidax is regulated by the CBN — a good option if you prefer a local platform over Binance.",
            },
        ],
    },
];

// Fallback guide shown for all countries not matched above
export const GENERIC_GUIDE = {
    id:       "generic",
    title:    "Universal Guide",
    fiatCode: null, // no fiat pre-selection on Binance P2P
    methods: [
        {
            name: "Binance P2P",
            icon: "🌐",
            badge: "Most countries",
            steps: [
                "Create a Binance account at binance.com and complete identity verification.",
                "Copy your wallet address from NexusFund Dashboard → My Wallet.",
                "In Binance, go to Wallet → Spot → Deposit → search for USDC → select Polygon (Matic) network.",
                "Send your USDC to the Binance deposit address.",
                "Once received, go to P2P Trading → Sell → USDC and select your local currency.",
                "Choose a merchant with a high completion rate and follow the trade instructions.",
                "After receiving payment in your local bank or mobile wallet, release the USDC to complete the trade.",
            ],
            tip: "Always use Binance's in-platform chat during a trade. Never move the conversation to WhatsApp or Telegram — this is a common scam tactic.",
        },
        {
            name: "Coinbase → Bank Transfer",
            icon: "🏛️",
            steps: [
                "Create a Coinbase account at coinbase.com (available in 100+ countries).",
                "Complete identity verification.",
                "Link your local bank account.",
                "Send USDC from your NexusFund wallet to your Coinbase USDC address.",
                "In Coinbase, sell USDC for your local currency.",
                "Withdraw to your linked bank account.",
            ],
            warning: "Coinbase is not available in all countries. Check coinbase.com/places for availability.",
        },
        {
            name: "Kraken → Bank Transfer",
            icon: "🐙",
            steps: [
                "Create a Kraken account at kraken.com.",
                "Complete KYC verification.",
                "Deposit USDC from your NexusFund wallet.",
                "Sell USDC for EUR, GBP, USD, or CAD.",
                "Withdraw to your bank via SEPA, SWIFT, or local transfer.",
            ],
            tip: "Kraken supports SEPA transfers for European users — typically free and same-day.",
        },
    ],
};

// Returns the guide matching the user's country, or the generic guide
export function getGuideForCountry(country) {
    if (!country) return GENERIC_GUIDE;
    const key = country.trim().toLowerCase();
    return GUIDES.find((g) => g.countries.includes(key)) ?? GENERIC_GUIDE;
}
