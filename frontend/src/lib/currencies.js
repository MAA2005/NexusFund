// Maps lowercase country names to ISO 4217 currency codes and Intl locales.
// Lookup is case-insensitive — see getCurrencyForCountry() below.
const COUNTRY_CURRENCY = {
    // South Asia
    "pakistan":          { code: "PKR", locale: "ur-PK" },
    "india":             { code: "INR", locale: "en-IN" },
    "bangladesh":        { code: "BDT", locale: "bn-BD" },
    "sri lanka":         { code: "LKR", locale: "si-LK" },
    "nepal":             { code: "NPR", locale: "ne-NP" },
    "afghanistan":       { code: "AFN", locale: "ps-AF" },

    // East & West Africa
    "kenya":             { code: "KES", locale: "sw-KE" },
    "tanzania":          { code: "TZS", locale: "sw-TZ" },
    "uganda":            { code: "UGX", locale: "en-UG" },
    "ethiopia":          { code: "ETB", locale: "am-ET" },
    "ghana":             { code: "GHS", locale: "en-GH" },
    "nigeria":           { code: "NGN", locale: "en-NG" },
    "south africa":      { code: "ZAR", locale: "en-ZA" },
    "egypt":             { code: "EGP", locale: "ar-EG" },
    "morocco":           { code: "MAD", locale: "ar-MA" },
    "senegal":           { code: "XOF", locale: "fr-SN" },
    "ivory coast":       { code: "XOF", locale: "fr-CI" },
    "cameroon":          { code: "XAF", locale: "fr-CM" },
    "rwanda":            { code: "RWF", locale: "rw-RW" },
    "zambia":            { code: "ZMW", locale: "en-ZM" },
    "zimbabwe":          { code: "ZWL", locale: "en-ZW" },

    // Middle East
    "saudi arabia":      { code: "SAR", locale: "ar-SA" },
    "uae":               { code: "AED", locale: "ar-AE" },
    "united arab emirates": { code: "AED", locale: "ar-AE" },
    "qatar":             { code: "QAR", locale: "ar-QA" },
    "kuwait":            { code: "KWD", locale: "ar-KW" },
    "bahrain":           { code: "BHD", locale: "ar-BH" },
    "oman":              { code: "OMR", locale: "ar-OM" },
    "jordan":            { code: "JOD", locale: "ar-JO" },
    "lebanon":           { code: "LBP", locale: "ar-LB" },
    "iraq":              { code: "IQD", locale: "ar-IQ" },
    "turkey":            { code: "TRY", locale: "tr-TR" },

    // Europe
    "france":            { code: "EUR", locale: "fr-FR" },
    "germany":           { code: "EUR", locale: "de-DE" },
    "spain":             { code: "EUR", locale: "es-ES" },
    "italy":             { code: "EUR", locale: "it-IT" },
    "netherlands":       { code: "EUR", locale: "nl-NL" },
    "portugal":          { code: "EUR", locale: "pt-PT" },
    "greece":            { code: "EUR", locale: "el-GR" },
    "belgium":           { code: "EUR", locale: "fr-BE" },
    "uk":                { code: "GBP", locale: "en-GB" },
    "united kingdom":    { code: "GBP", locale: "en-GB" },
    "great britain":     { code: "GBP", locale: "en-GB" },
    "poland":            { code: "PLN", locale: "pl-PL" },
    "sweden":            { code: "SEK", locale: "sv-SE" },
    "norway":            { code: "NOK", locale: "nb-NO" },
    "denmark":           { code: "DKK", locale: "da-DK" },
    "switzerland":       { code: "CHF", locale: "de-CH" },
    "russia":            { code: "RUB", locale: "ru-RU" },
    "ukraine":           { code: "UAH", locale: "uk-UA" },
    "czech republic":    { code: "CZK", locale: "cs-CZ" },
    "hungary":           { code: "HUF", locale: "hu-HU" },
    "romania":           { code: "RON", locale: "ro-RO" },

    // Americas
    "united states":     { code: "USD", locale: "en-US" },
    "usa":               { code: "USD", locale: "en-US" },
    "us":                { code: "USD", locale: "en-US" },
    "america":           { code: "USD", locale: "en-US" },
    "canada":            { code: "CAD", locale: "en-CA" },
    "brazil":            { code: "BRL", locale: "pt-BR" },
    "mexico":            { code: "MXN", locale: "es-MX" },
    "argentina":         { code: "ARS", locale: "es-AR" },
    "colombia":          { code: "COP", locale: "es-CO" },
    "chile":             { code: "CLP", locale: "es-CL" },
    "peru":              { code: "PEN", locale: "es-PE" },
    "venezuela":         { code: "VES", locale: "es-VE" },

    // Asia Pacific
    "china":             { code: "CNY", locale: "zh-CN" },
    "japan":             { code: "JPY", locale: "ja-JP" },
    "south korea":       { code: "KRW", locale: "ko-KR" },
    "korea":             { code: "KRW", locale: "ko-KR" },
    "indonesia":         { code: "IDR", locale: "id-ID" },
    "malaysia":          { code: "MYR", locale: "ms-MY" },
    "philippines":       { code: "PHP", locale: "en-PH" },
    "thailand":          { code: "THB", locale: "th-TH" },
    "vietnam":           { code: "VND", locale: "vi-VN" },
    "australia":         { code: "AUD", locale: "en-AU" },
    "new zealand":       { code: "NZD", locale: "en-NZ" },
    "singapore":         { code: "SGD", locale: "en-SG" },
    "hong kong":         { code: "HKD", locale: "zh-HK" },
    "taiwan":            { code: "TWD", locale: "zh-TW" },
};

const DEFAULT = { code: "USD", locale: "en-US" };

// Returns { code, locale } for a given country name string.
// Falls back to USD if the country is not in the map.
export function getCurrencyForCountry(country) {
    if (!country) return DEFAULT;
    const key = country.trim().toLowerCase();
    return COUNTRY_CURRENCY[key] ?? DEFAULT;
}
