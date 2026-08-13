import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

function argumentValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

const seedPath = resolve(argumentValue("seed") ?? "data/watches.seed.json");
const reportPath = resolve(argumentValue("report") ?? "/private/tmp/watch-data-normalization.json");
const apply = process.argv.includes("--apply");

// These records were imported from article headlines. The replacements below are
// deliberately curated instead of inferred at runtime so a future title change
// cannot silently rename a product or create a new route collision.
const NAME_FIXES = new Map([
  [115, "Masterpiece Collection Manual-Winding Spring Drive"],
  [194, "Seamaster 37mm Co-Axial Master Chronometer"],
  [249, "Seamaster Aqua Terra 150M Co-Axial Master Chronometer 41mm"],
  [961, "Prospex 1965 Heritage Diver’s Watch Save the Ocean Limited Edition"],
  [1089, "Prospex Solar Chronograph Tokyo 25 Limited Edition"],
  [1547, "Excellence Petite Seconde Couleurs Bleu Glacier 39mm"],
  [1609, "Big Crown Pointer Date Lou Gehrig Limited Edition 40mm"],
  [1673, "B 1.618 UltraFino Sapphire"],
  [1776, "The Citizen Caliber 0200 100th Anniversary Limited Edition"],
  [1832, "Seventies Chronograph Panorama Date Blue Leather"],
  [1833, "Seventies Chronograph Panorama Date Green Rubber"],
  [1834, "Seventies Chronograph Panorama Date Swimming Pool Rubber"],
  [1835, "Seventies Chronograph Panorama Date Swimming Pool Bracelet"],
  [1836, "Seventies Chronograph Panorama Date Watermelon Rubber"],
  [1837, "Seventies Chronograph Panorama Date Watermelon Bracelet"],
  [1999, "Wild One Skeleton X-Lite Limited Edition"],
  [2000, "Wild One Skeleton X-Lite Limited Edition"],
  [2039, { model: "Cosmograph Daytona", variant: null }],
  [2081, "Hass Automatic SpongeBob SquarePants 25th Limited Edition"],
  [2082, "Hass Automatic SpongeBob SquarePants 25th Limited Edition"],
  [2083, "Hass Automatic SpongeBob SquarePants 25th Limited Edition"],
  [2084, "Hass Automatic SpongeBob SquarePants 25th Limited Edition"],
  [2107, "01Series Gen 3 Burnt Pepper0ni"],
  [2108, "01Series Gen 3 Classic Cheese"],
  [2168, "Formula 1 Chronograph Black & Red"],
  [2169, "Formula 1 Chronograph Black & Blue"],
  [2170, "Formula 1 Chronograph Red"],
  [2171, "Formula 1 Chronograph Lime"],
  [2209, { model: "Pelagos FXD Chrono Cycling Edition", thicknessMm: 13.2 }],
  [2252, "Chronomaster Sport Green Bracelet"],
  [2253, "Chronomaster Sport Green Rubber"],
  [2254, "Chronomaster Sport Gem-Set"],
  [2973, {
    model: "Ocean Star Tribute Gradient",
    reference: "M026.830.17.421.00",
    thicknessMm: 13.4,
    lugWidthMm: 21
  }],
  [3311, {
    model: "BR 03-94 Black Matte",
    canonicalModel: "BR 03-94",
    modelGroup: "bell-and-ross-br-03-94",
    variant: "Black Matte"
  }],
  [3313, {
    model: "BR 03-94 Desert Type",
    canonicalModel: "BR 03-94",
    modelGroup: "bell-and-ross-br-03-94",
    variant: "Desert Type"
  }],
  [3317, "B 1.618 Flying Tourbillon Sport GMT Hybrid Red"],
  [3318, "B 1.618 UltraFino Flying Tourbillon Titanium Black"],
  [3319, "B 1.618 Flying Tourbillon Grande Date Hybrid Green"],
  [3320, "B 1.618 Flying Tourbillon Grande Date Maserati MSG Racing Hybrid"],
  [3321, "B 1.618 UltraFino Flying Tourbillon Skeleton Titanium Red"],
  [3322, "B 1.618 UltraFino Flying Tourbillon Titanium Blue"],
  [3323, "B 1.618 Flying Tourbillon Sport GMT Hybrid Sky Blue"],
  [3324, "B 1.618 UltraFino Flying Tourbillon Skeleton Titanium Blue"],
  [3325, "B 1.618 Flying Tourbillon Grande Date Hybrid Blue"],
  [3326, "B 1.618 Flying Tourbillon Grande Date Sapphire White"],
  [3327, "B 1.618 Flying Tourbillon Sport GMT Carbon White"],
  [3328, "B 1.618 Flying Tourbillon Grande Date Carbon Earth"],
  [3329, "B 1.618 UltraFino Flying Tourbillon Skeleton Carbon Red"],
  [3330, "B 1.618 Flying Tourbillon Sport GMT Carbon Sky Blue"],
  [3331, "B 1.618 Flying Tourbillon Grande Date Carbon Red"],
  [3332, "B 1.618 UltraFino Flying Tourbillon Skeleton Carbon White"],
  [3333, "B 1.618 Flying Tourbillon Grande Date Carbon White"],
  [3334, "B 1.618 Flying Tourbillon Grande Date Carbon Sky Blue"],
  [3335, "B 1.618 Flying Tourbillon Grande Date Carbon Orange"],
  [3336, "B 1.618 Flying Tourbillon Sport GMT Carbon Fern Green"],
  [3337, "B 1.618 Flying Tourbillon Grande Date Maserati MSG Racing Carbon"],
  [3338, "B 1.618 Flying Tourbillon Sport GMT Carbon Red"],
  [3339, "B 1.618 UltraFino Flying Tourbillon Skeleton Carbon Sky Blue"],
  [3340, "B 1.618 Flying Tourbillon Grande Date Carbon Lime"],
  [3341, "B 1.618 Flying Tourbillon Grande Date Hybrid Gold"],
  [3342, "B 1.618 Flying Tourbillon Sport GMT Hybrid Gold"],
  [4015, "Silver Leaf Lacquer Dial Blue"],
  [4304, "Heritage Collection Caliber 9S 25th Anniversary Limited Edition"],
  [4360, "1941 Grönograaf"],
  [4610, "Sector II Pilot Phantom"],
  [4611, "Sector II Pilot Phantom"],
  [4714, "Seamaster Planet Ocean 600M"],
  [4719, "Seamaster Planet Ocean 600M"],
  [4722, "Seamaster Planet Ocean 600M"],
  [4728, "Seamaster Planet Ocean 600M"],
  [4744, "Seamaster Planet Ocean 600M"],
  [4745, "Seamaster Planet Ocean 600M"],
  [4747, "Seamaster Planet Ocean 600M"],
  [4752, "Seamaster Planet Ocean 600M"],
  [4958, "PRX Powermatic 80 35mm"],
  [4959, "PRX 35mm"],
  [4960, "PRX 35mm"],
  [4961, "PRX 35mm"],
  [4962, "PRX 35mm"],
  [4963, "PRX Powermatic 80 35mm"],
  [4981, "Black Bay P01"],
  [5040, "Starfighter ZircTi Chronograph Aventurine Limited Edition"],
  [5848, "DOXA Army Watches of Switzerland Edition"],
  [6123, "Carrera Chronograph Tourbillon Extreme Sport Titanium"],
  [6124, "Carrera Chronograph Tourbillon Extreme Sport Rose Gold & Titanium"],
  [6468, { model: "Carrera Chronograph Tourbillon Extreme Sport TH-Carbonspring", reference: "CBU5091.FT6305" }],
  [6708, { model: "Tank Américaine Large", reference: "Tank Américaine Large 44.4 x 24.4mm" }],
  [6709, { model: "Tank Américaine Small", reference: "Tank Américaine Small 35 x 19mm" }],
  [6710, { model: "Tank Américaine Mini", reference: "Tank Américaine Mini 28 x 15.2mm" }],
  [6890, { model: "Tank Anglaise Medium", reference: "Tank Anglaise Medium 39.2 x 29.8mm" }],
  [6946, "Santos 100 Carbon"],
  [6948, "Part Time"],
  [6953, "Prospex Diver Scuba Giugiaro Design SBEE001 / SBEE002"],
  [6954, "1970 Automatic Diver"],
  [6955, "Art Deco Collection"],
  [6957, "H2O"],
  [6958, "Superman Heritage"],
  [6960, "Hyperion Ocean 600m"],
  [6963, "Hydrosphere Air Gauge"],
  [6969, "Praeludium Chronograph Black Edition"],
  [6970, "Seascape 200"],
  [6973, "Model 500-GMT"],
  [6977, "Sennen Automatic"],
  [6979, "Aquis GMT Date Carysfort Reef Limited Edition"],
  [6980, "Cortina 1956 Collection"],
  [6982, "Chronicle Collection"],
  [6983, "Cover Drive"],
  [6988, "Avigation Watch Type A-7 1935 (2020)"],
  [6989, "Streamliner Flyback Chronograph Funky Blue"],
  [6991, "AquaSport"],
  [6993, "Depthmaster"],
  [6995, "Chronomaster Aviator Sea Diver Re-Edition"],
  [6997, "Legend Diver Gradient Dial"],
  [6999, "SuperSport Compressor"],
  [7000, "Architect"],
  [7004, "Stratoscope"],
  [7005, "Mirage 2 Eight-Day Skeleton"],
  [7006, "Tourbillon 1"],
  [7007, "Unomat"],
  [7008, "Heritage Classic Sector Dial"],
  [7010, "The Citizen Mechanical Caliber 0200"],
  [7013, "Excellence Régulateur Stone Dials"],
  [7014, "Maelstrom"],
  [7016, "OHI-4 Blue Steel"],
  [7017, "901 GW Exoskeleton & Chelsea"],
  [7020, "DM01 Automatic"],
  [7021, "Hand-Wound Chronograph Collection"],
  [7022, "Apogee Horizon"],
  [7023, "Space Launcher Limited Editions"],
  [7027, "Seastrong Diver Gyre Automatic"],
  [7029, "Antarctique Salmon & Glacier Blue"],
  [7030, "Field Automatic"],
  [7031, "Adventure Neverest GMT Steel & Gold"],
  [7033, "Excellence Guilloché Main II"],
  [7034, "London Chronograph"],
  [7037, "Abyss Chronograph 30th Anniversary"],
  [7039, "Model 222-RR Classic Montgomery"],
  [7040, "GMT 0º Terra Maris"],
  [7041, "Bambino 38"],
  [7043, "Singularis"],
  [7044, "Reverso Chronographe Rétrograde"],
  [7046, "TR-660"],
  [7048, "GMT Peacock SBGJ261"],
  [7049, "Classic Traveller Magnetic Green"],
  [7050, "Superman 500"],
  [7051, "Type XX 3800ST"],
  [7052, "Speedmaster '57 Hand-Wound"],
  [7053, "Strider"],
  [7054, "DM02"],
  [7055, "Prospex Sumo SPB321J1"],
  [7057, "Orient Star Diver 1964 2nd Edition"],
  [7059, "Einser Zentralsekunde"],
  [7060, "Marinemaster M-44"],
  [7061, "Pilot Pioneer Blue & White"],
  [7062, "Neo Classic Sports Collection"],
  [7064, "Heritage Chronograph Prototype"],
  [7065, "Lensman 1 Tourbillon"],
  [7066, "Skypod Limited Edition"],
  [7067, "Orient Star Skeleton"],
  [7068, "Sattelberg Automatic"],
  [7069, "Wristmaster Micro-Rotor"],
  [7070, "x Valtteri Bottas Kilpisjärvi"],
  [7071, "Blazer Collection"],
  [7072, "Lonsdale"],
  [7073, "Vitruve Date Steel"],
  [7077, "Allure Chronograph Tangerine"],
  [7080, "Lensman 2 Exposure"],
  [7082, "Argon SpaceOne"],
  [7084, "Dark Surge"],
  [7085, "Antarctic Spider Salmon"],
  [7086, "Hastroid Blue Star"],
  [7087, "Noramis Chronograph Sachsen Classic 2023"],
  [7088, "Baroncelli Chronograph Moonphase"],
  [7091, "MACH 1 Admiral"],
  [7092, "Sous Marine Collection"],
  [7094, "Atelier"],
  [7095, "Serie-R 80s Edition"],
  [7096, "Big Pilot Markus Bühler Tourbillon"],
  [7098, "Ecce"],
  [7099, "La Rochelaise"],
  [7100, "Inveniō"],
  [7101, "Series Two"],
  [7102, "Ultradive & OPS Compressor"],
  [7103, "Deconstructed Aventurine & Meteorite"],
  [7104, "Gold PVD Collection"],
  [7105, "Rubus"],
  [7106, "MBIII Stealth Limited Edition"],
  [7107, "Bonaire MKII"],
  [7109, "Serenity 39"],
  [7110, "Amphibian 250"],
  [7111, "1924 Tourbillon"],
  [7115, "Mechanical Caliber 0210"],
  [7116, "Scubanaut 200"],
  [7117, "Big Pilot AMG G 63 Ceramic Matrix"],
  [7118, "Paul 24H Collection"],
  [7119, "Fire Exit Watch"],
  [7120, "Hermétique Glacier Limited Edition"],
  [7121, "Flygraf Flieger FAF"],
  [7123, "Pioneer Concept Citrus Green"],
  [7125, "Excellence Régulateur Grand Feu Enamel"],
  [7126, "Signature Series"],
  [7127, "Module One"],
  [7128, "C Titanium Edition Six"],
  [7129, "OPS Compressor TRTS Edition"],
  [7131, "Speedmaster Chronoscope Paris 2024"],
  [7133, "Amphibian 250 White Shark"],
  [7137, "Field Watch Collection"],
  [7138, "Aquasphere FreeFall Blue"],
  [7140, "Spirotechnique Dive Watch"],
  [7142, "C Platinum Edition Bracelet"],
  [7143, "GoS x Martin Key"],
  [7144, "Duobox 39mm Chronometer Limited Edition"],
  [7145, "Amphibian 250 Red Viper"],
  [7146, "JB300"],
  [7147, "Multifort TV 35"],
  [7148, "Speedmaster Pilot Flight Qualified"],
  [7149, "711 Heritage Chronograph POP"],
  [7150, "Speedmaster Moonphase Meteorite"],
  [7152, "Urban Military NJ0190"],
  [7153, "Angelier Classique"],
  [7154, "Moomin 80"],
  [7155, "Kortela Valta"],
  [7156, "GMT Automatico"],
  [7157, "AJ-ETYPE"],
  [7158, "DecaFlux"],
  [7161, "Pelagos Ultra"],
  [7162, "Mako 75th Anniversary"],
  [7163, "Av0cado"],
  [7164, "Black Bay 68"],
  [7166, { model: "Altitude MB Meteor", reference: "Altitude MB Meteor 43mm" }],
  [7168, "Majestic Chronoshop 09"],
  [7170, "Kaenos & Kaenos Open Date"],
  [7171, "Big Pilot Perpetual Calendar Tourbillon Le Petit Prince"],
  [7172, "Perpetual 1908 Settimo Bracelet"],
  [7173, "Autark Tourbillon"],
  [7174, "Hugenius"],
  [7176, "Marina Chronograaf"],
  [7177, "Royale Paris Power Reserve Small Seconds"],
  [7178, "Hexmariner 39 Durian"],
  [7181, "Watch Ho & Co. x Selten Jui"],
  [7182, "Integra"],
  [7184, "Mara"],
  [7186, "Richard Lange Jumping Seconds Salmon"],
  [7187, "Big Crown Calibre 113"],
  [7188, "Preventor HD12 Silk Purple"],
  [7189, "Tsuyosa 37 Blue & Purple"],
  [7190, "G5 Pacific Steel USA GMT"],
  [7192, "Apogee Visitor Meteorite"],
  [7196, "Pioneer Silva Rosé & Pistachio"],
  [7197, "H08 Chronograph Naples Yellow"],
  [7199, "417 ES Mocha Flyback Date"],
  [7200, "HU-01"],
  [7201, "AN.01"],
  [7202, "Force Majeure"],
  [7205, "Stratoliner S-41"],
  [7206, "Multifort 8 Two Crowns"],
  [7207, "M36"],
  [7208, "Toka"],
  [7209, "Project Tai Yu"],
  [7211, "Redentore Utopia II"],
  [7212, "Multifort 8 One Crown"],
  [7213, "Zenshin 60 Super Titanium"],
  [7214, "Split-Seconds Chronograph"],
  [7215, "World Timer Collection"],
  [7218, "MK1 Automatic"],
  [7220, "Wristmaster Slim Small Seconds"],
  [7221, "F77 MKII"],
  [7222, "Sky Chief Chronograph"],
  [7224, "Shell Star Automatic 41mm"],
  [7225, "Säntis Worldtimer"],
  [7226, "Artelier Complication"],
  [7229, "AB-05 Skylight"],
  [7230, "Komposition Automatic"],
  [7231, "Excellence Régulateur Esprit Flinqué"],
  [7233, "Artelier Date 38mm"],
  [7235, "Hudson 38 GMT MKII"],
  [7236, "Startimer Pilot IFR Chronograph"],
  [7237, "Type X-Graph"],
  [7238, "Commander 40mm"],
  [7239, "Arche"],
  [7240, "Kubo Collection"],
  [7241, "Purist Typ 1"],
  [7242, "Rheon Bronze"],
  [7243, "Freak X"],
  [7244, "Evolution 9 Spring Drive U.F.A. SLGB007"],
  [7247, "Divers Date Olive Green"],
  [7249, "C Titanium Edition 39.5"],
  [7251, "Square by Square Prototype"],
  [7252, "Aquasphere Matte Black"],
  [7253, "Heritage Atelier"],
  [7254, "P37 33mm Anniversary"],
  [7257, "Seamaster Ploprof"],
  [7259, "HL Ti 2"],
  [7261, "Ventura XXL"],
  [7263, "Historiques Aronde 1954"],
  [7265, "1972 Prestige"],
  [7268, "Caliber 20"],
  [7271, "Petrograd Sochi 2014"],
  [7274, "Gold Collection"],
  [7279, "Harmony Ultra-Thin Grande Complication Chronograph"],
  [7286, "Monaco Calibre 11 Steve McQueen"],
  [7287, "Giugiaro Design Quartz Chronograph Reissue"],
  [7288, { model: "Reverso Tribute Gyrotourbillon", reference: "Reverso Tribute Gyrotourbillon 2016" }],
  [7291, "Timepiece No. 1"],
  [7293, "Sequential One S110 Skull"],
  [7295, "Automatiq"],
  [7296, "UR-T8"],
  [7297, "BR 03-92 Horograph & Horolum"],
  [7298, "Sixties Iconic Square"],
  [7300, "BR 03-94 RS17"],
  [7301, "Dodekal One D110"],
  [7303, "HM6 Alien Nation"],
  [7304, "Drive de Cartier Moon Phases"],
  [7305, "BR-X1 RS17 Only Watch"],
  [7306, "Vortex Gamma"],
  [7309, "Ceramica Automatic Collection"],
  [7310, "Kalparisma"],
  [7313, "Golden Bridge Joachim Horsley"],
  [7315, "William Penn Series"],
  [7320, "PloProf Research Programme"],
  [7322, "BR-X1 R.S.19 Collection"],
  [7334, "Dollfus No. 2516 Perpetual Calendar"],
  [7335, "BR 03 R.S.20 Chronograph"],
  [7337, "Small Seconds Salmon Dial"],
  [7341, "Vintage 1945 Infinity Edition"],
  [7343, "Astronomia Casino"],
  [7344, "Monaco Calibre Heuer 02 Black"],
  [7345, "Horizon"],
  [7356, "7 Windows"],
  [7357, "Racer Jumping Hour GMT"],
  [7358, "Square Micro-Rotor Retro"],
  [7361, "M-1 Mars Collection"],
  [7362, "Récital 23 Turquoise Guilloché"],
  [7363, "Monaco Carbon Only Watch"],
  [7368, "Tetra Neomatik Silvercut"],
  [7373, "T-Race MotoGP Automatic Chronograph 2022"],
  [7376, "Sealiner PS"],
  [7378, "1972 Competition Chronograph Steel & Gold"],
  [7380, "Reverso Tribute Enamel Hokusai Amida Falls"],
  [7381, "Old Radium Bronze Pilot"],
  [7382, "Evidenza Sector Dial"],
  [7383, "UR-120 Spock"],
  [7385, "Classics Carrée Automatic"],
  [7386, "Alpiner Extreme Automatic Regulator"],
  [7391, "TMBN Telemark Bataljon"],
  [7393, "1972 Competition FIS Edition Lemon"],
  [7394, "Alpiner Extreme Automatic Freeride World Tour 2023"],
  [7395, "Stardust & Stardust Nostromo"],
  [7397, { model: "Alpiner Extreme Automatic", reference: "Alpiner Extreme Automatic Steel Bracelet" }],
  [7398, "Alpiner Extreme Automatic Freeride Verbier"],
  [7401, "H08 Chronograph"],
  [7405, { model: "Multifort TV Big Date", reference: "Multifort TV Big Date Steel" }],
  [7406, "Heritage Carrée Mechanical 140 Years"],
  [7407, "G-Shock Frogman MRG-BF1000R"],
  [7409, "Récital 23"],
  [7410, "The World Is Yours Dual Time Zone"],
  [7411, "Adventure Automatic Collection"],
  [7412, "Skel-1"],
  [7413, "Monaco Chronograph Night Driver"],
  [7417, "Pilot's Watch Performance Chronograph 41"],
  [7419, { model: "Mirage", reference: "Mirage Prussian Blue / Sienna" }],
  [7420, "Vagabonde Tourbillon Series 3"],
  [7421, "Perception Wristcheck x Seconde/Seconde"],
  [7423, "x Seconde/Seconde"],
  [7424, "Prismic Collection"],
  [7426, "Masterlink Collection"],
  [7428, "HLXX"],
  [7429, "Perpetual 1908 Platinum Guilloché"],
  [7431, { model: "Multifort TV Big Date", reference: "Multifort TV Big Date Gold PVD" }],
  [7432, "Minute Repeater Tourbillon Collection"],
  [7434, "Alpiner Extreme Skeleton Automatic"],
  [7439, "Sphere Series 2"],
  [7440, "S1 Titanium Japan Limited Edition"],
  [7442, "Antarctic GMT"],
  [7443, "Anatom High-Tech Ceramic"],
  [7444, "Digitrend Collection"],
  [7449, "Initial Automatic Calendar"],
  [7451, "Star Dial 34mm"],
  [7452, "Thundergraph"],
  [7453, "Tank à Guichets Privé"],
  [7456, "Orient Star Layered Skeleton"],
  [7457, "1972 Competition Chronograph Black & White"],
  [7458, "Streamliner Kennedy Automatic"],
  [7459, "SP One"],
  [7461, "Heritage Chronograph"],
  [7462, "Fifty Fathoms Automatique 38mm"],
  [7463, "Tank Américaine Platinum"],
  [7464, "Stealth Tourbillon"],
  [7465, "Purity Curvy HMS Mirror"],
  [7466, "CH1 Rétrograde"],
  [7468, "Goldfeather GBBY969"],
  [7469, "Clubmaster Legend Classic"],
  [7470, "BR-X3"],
  [7471, "A-11 Type 44 Watch Observer"],
  [7472, "UR-10 Spacemeter"],
  [7474, "Ventura Edge Skeleton"],
  [7475, "Alpiner Extreme Automatic Freeride World Tour 2025"],
  [7476, "Maestro 2.0 Meteorite"],
  [7477, "Anatom Skeleton"],
  [7478, "B/1.3r"],
  [7479, "Prima"],
  [7480, "Volumes"],
  [7481, "Purity Moissanite Curvy Tourbillon"],
  [7482, "Billionaire Double Tourbillon Angel"],
  [7483, "Kubera Series 1"],
  [7484, "B 1.618 UltraFino Maserati"],
  [7485, "Godfather II"],
  [7486, "A1 Abyss & Stone"],
  [7487, "BL-Endurance Evolution Bleu Asphalte Gold"],
  [7488, "Clubmaster Legend Diver Ocean"],
  [7490, "Perception V3"],
  [7491, "Digitrend OSII Black"],
  [7492, "Monaco Speed 12"],
  [7493, "Masterlink Gem-Set Stone Dial"],
  [7494, { model: "BL-Endurance", reference: "BL-Endurance United Autosports" }],
  [7495, "B/1 Breutalist"]
]);

// Some catalogue imports concatenated a collection label with a model name
// that already contained that label. IDs and anchored patterns keep these
// rewrites constrained to the known affected rows.
const MODEL_REWRITES = [
  {
    ids: [3116, 3128],
    pattern: /^Model 3-\s*Archive Model 3\s*-\s*/u,
    replacement: "Model 3 Archive "
  },
  {
    ids: [3136, 3137, 3138, 3139, 3141, 3143, 3144, 3145],
    pattern: /^Model 1 Medium Model 1\s*-\s*/u,
    replacement: "Model 1 Medium "
  },
  {
    ids: [3140, 3142, 3146, 3147],
    pattern: /^Model 2 Medium Model 2\s*-\s*/u,
    replacement: "Model 2 Medium "
  },
  {
    ids: [3148, 3149, 3150, 3151],
    pattern: /^Model 1 Small Model 1\s*-\s*/u,
    replacement: "Model 1 Small "
  },
  {
    ids: [3152, 3154, 3160, 3164],
    pattern: /^Model 1 Large Model 1\s*-\s*/u,
    replacement: "Model 1 Large "
  },
  {
    ids: [3156, 3158, 3161, 3165],
    pattern: /^Model 2 Large Model 2\s*-\s*/u,
    replacement: "Model 2 Large "
  },
  {
    ids: [3153],
    pattern: /^Model 1-\s*Archive The Model 1 Precious Metal-\s*/u,
    replacement: "Model 1 Precious Metal Archive "
  },
  {
    ids: [3157, 3166],
    pattern: /^Model 1 The Model 1 Precious Metal-\s*/u,
    replacement: "Model 1 Precious Metal "
  },
  {
    ids: [3159, 3168],
    pattern: /^Model 2 The Model 2\s*/u,
    replacement: "Model 2 "
  },
  {
    ids: [3155, 3162, 3163, 3167],
    pattern: /^Model 1 Fabrik Model 1-\s*/u,
    replacement: "Fabrik Model 1 "
  },
  {
    ids: [3283],
    pattern: /^BR 03 BR-03\s*/u,
    replacement: "BR-03 "
  },
  {
    ids: [3294],
    pattern: /^Aviation Instruments BR03 Aviation Instruments$/u,
    replacement: "BR 03-92 Diver"
  },
  {
    ids: [3300, 3302, 3305],
    pattern: /^Aviation Instruments BR01 Aviation Instruments$/u,
    replacement: "BR 01"
  },
  {
    ids: [3699, 3701, 3704, 3708, 3713, 3719, 3720, 3721, 3727, 3729, 3735, 3740, 3750, 3751, 3760],
    pattern: /^Santos-Dumont Santos Dumont\s*/u,
    replacement: "Santos-Dumont "
  },
  {
    ids: [3709, 3717, 3753, 3765],
    pattern: /^Tank Louis Cartier Tank Louis\s*/u,
    replacement: "Tank Louis Cartier "
  },
  {
    ids: [
      3799, 3806, 3824, 3827, 3837, 3860, 3863, 3879, 3882, 3885, 3913, 3921, 3923, 3924, 3927,
      3930, 3931, 3932, 3933, 3954, 3955, 3982, 3987, 3989, 3995, 3999, 4010
    ],
    pattern: /^Bel Canto C1 Bel Canto\s*/u,
    replacement: "C1 Bel Canto "
  },
  {
    ids: [
      3800, 3815, 3817, 3818, 3819, 3836, 3840, 3851, 3854, 3857, 3878, 3883, 3884, 3889, 3891,
      3892, 3904, 3909, 3920, 3938, 3942, 3943, 3949, 3964, 3968, 3972, 3974, 3984
    ],
    pattern: /^The Twelve C12 The Twelve\s*/u,
    replacement: "C12 The Twelve "
  },
  {
    ids: [4114, 4123, 4125, 4126, 4127, 4139, 4141],
    pattern: /^Cushion Case\s*/u,
    replacement: ""
  },
  {
    ids: [4134, 4146, 4160, 4167, 4169],
    pattern: /^Three Hand\s*/u,
    replacement: ""
  },
  {
    ids: [4150, 4163],
    pattern: /^GMT Bezel\s*/u,
    replacement: ""
  }
];

const RETIRED_EDITORIAL_IDS = new Set([
  6994, // Article gives no numeric lug-to-lug measurement for the discontinued FOiS.
  7025, // Brand profile without a product identity.
  7035, // Maker profile without a product identity.
  7042, // Maker profile without a product identity.
  7245, // Multi-model update without reference-level identity.
  7266, // Brand editorial without a product identity.
  7302, // Brand editorial without a product identity.
  7332, // Multi-watch roundup.
  7338, // GMT explainer covering multiple models.
  7365, // Certified pre-owned programme article, not one watch.
  7369, // Brand roundup covering multiple watches.
  7389, // Five-model capsule collection with mixed dimensions.
  7435, // Three different Breitling product families in one article.
  7445 // Historical annual-calendar overview covering many references.
]);

const MERGES = [
  { duplicateId: 1359, canonicalIds: [2105], reason: "Studio Underd0g Salm0n official reference" },
  { duplicateId: 2614, canonicalIds: [6270], reason: "Tudor Black Bay Chrono 39 Bumblebee official reference" },
  { duplicateId: 2648, canonicalIds: [1410], reason: "Timex Marlin Quartz GMT official reference" },
  { duplicateId: 2666, canonicalIds: [1827, 1828], reason: "PanoMaticCalendar Blue of Dawn official strap references" },
  { duplicateId: 2712, canonicalIds: [6752], reason: "Reverso Tribute Minute Repeater official reference" },
  { duplicateId: 2725, canonicalIds: [6165], reason: "Tudor Pelagos FXD GMT official reference" },
  { duplicateId: 2754, canonicalIds: [2209], reason: "Tudor Pelagos FXD Chrono Cycling Edition official reference" },
  { duplicateId: 2797, canonicalIds: [5938], reason: "Doxa SUB 300 Carbon Searambler official reference" },
  { duplicateId: 2805, canonicalIds: [6178, 6179], reason: "Monta Noble Voyager GMT official references" },
  { duplicateId: 2814, canonicalIds: [3668], reason: "Bremont Terra Nova 40.5 Turning Bezel Power Reserve canonical record" },
  { duplicateId: 2869, canonicalIds: [4690], reason: "Nomos Orion Neomatik New Black brand alias" },
  { duplicateId: 2889, canonicalIds: [3544], reason: "Breitling Superocean Heritage '57 Highlands official reference" },
  { duplicateId: 2929, canonicalIds: [6154], reason: "Oris AquisPro 4000m official reference" },
  { duplicateId: 2931, canonicalIds: [4309], reason: "Grand Seiko SBGJ275 canonical reference" },
  { duplicateId: 2976, canonicalIds: [1070, 1071], reason: "Seiko Presage STAR BAR official references" },
  {
    duplicateId: 3025,
    canonicalIds: [
      1771, 5326, 5327, 5328, 5329, 5330, 5331, 5332, 5333, 5334, 5335, 5336, 5337, 5338, 5339,
      5340, 5341, 5342, 5450, 5451, 5452
    ],
    reason: "Christopher Ward C1 Jump Hour Mk V official option references"
  },
  { duplicateId: 3032, canonicalIds: [6467], reason: "TAG Heuer Monaco TH-Carbonspring canonical reference" },
  { duplicateId: 3067, canonicalIds: [3708], reason: "Cartier Santos-Dumont Small official reference" },
  { duplicateId: 3068, canonicalIds: [3699], reason: "Cartier Santos-Dumont Large official reference" },
  { duplicateId: 3110, canonicalIds: [3109], reason: "Anoma A1 Slate canonical variant record" },
  { duplicateId: 4022, canonicalIds: [1531, 5916], reason: "Doxa SUB 300T Professional official references" },
  { duplicateId: 4023, canonicalIds: [1424, 5993], reason: "Doxa SUB 300 Professional official references" },
  { duplicateId: 4026, canonicalIds: [5914, 5915], reason: "Doxa SUB 300T Sharkhunter official references" },
  { duplicateId: 4030, canonicalIds: [5912, 5913], reason: "Doxa SUB 300T Divingstar official references" },
  { duplicateId: 4031, canonicalIds: [1528, 5911], reason: "Doxa SUB 300T Aquamarine official references" },
  { duplicateId: 4032, canonicalIds: [5838, 5839], reason: "Doxa SUB 300T Whitepearl official references" },
  { duplicateId: 4033, canonicalIds: [1530, 5816], reason: "Doxa SUB 300T Caribbean official references" },
  { duplicateId: 4035, canonicalIds: [5983, 5984], reason: "Doxa SUB 200 C-GRAPH II Caribbean official references" },
  { duplicateId: 4036, canonicalIds: [1527, 5992], reason: "Doxa SUB 300 Sharkhunter official references" },
  { duplicateId: 4037, canonicalIds: [5814, 5815], reason: "Doxa SUB 300T Searambler official references" },
  { duplicateId: 4040, canonicalIds: [5907, 5908], reason: "Doxa SUB 1500T Sharkhunter official references" },
  { duplicateId: 4041, canonicalIds: [5967, 5968], reason: "Doxa SUB 300 Caribbean official references" },
  { duplicateId: 4042, canonicalIds: [5909, 5910], reason: "Doxa SUB 1500T Professional official references" },
  { duplicateId: 4043, canonicalIds: [5969, 5970], reason: "Doxa SUB 300 Aquamarine official references" },
  { duplicateId: 4044, canonicalIds: [5985, 5986, 5987, 5988], reason: "Doxa SUB 200 C-GRAPH II Whitepearl official references" },
  { duplicateId: 4045, canonicalIds: [5840, 5841], reason: "Doxa SUB 300 Whitepearl official references" },
  { duplicateId: 4046, canonicalIds: [5989, 5990], reason: "Doxa SUB 300 Searambler official references" },
  { duplicateId: 4048, canonicalIds: [5973, 5974], reason: "Doxa SUB 200 C-GRAPH Sharkhunter official references" },
  { duplicateId: 4049, canonicalIds: [5977, 5978], reason: "Doxa SUB 200 C-GRAPH II Sharkhunter official references" },
  { duplicateId: 4052, canonicalIds: [5832, 5833], reason: "Doxa SUB 1500T Searambler official references" },
  { duplicateId: 4053, canonicalIds: [5846, 5847], reason: "Doxa SUB 1500T Whitepearl official references" },
  { duplicateId: 4054, canonicalIds: [5932, 5933], reason: "Doxa SUB 200 C-GRAPH Searambler official references" },
  { duplicateId: 4056, canonicalIds: [5963, 5964], reason: "Doxa SUB 200 C-GRAPH Aquamarine official references" },
  { duplicateId: 4057, canonicalIds: [5965, 5966], reason: "Doxa SUB 200 C-GRAPH II Aquamarine official references" },
  { duplicateId: 4059, canonicalIds: [5979, 5980], reason: "Doxa SUB 200 C-GRAPH II Professional official references" },
  { duplicateId: 4060, canonicalIds: [5934, 5935], reason: "Doxa SUB 200 C-GRAPH Professional official references" },
  { duplicateId: 4061, canonicalIds: [1786], reason: "Doxa SUB 300T Clive Cussler official reference" },
  { duplicateId: 4062, canonicalIds: [1526, 5991], reason: "Doxa SUB 300 Divingstar official references" },
  { duplicateId: 4063, canonicalIds: [5901, 5902], reason: "Doxa SUB 1500T Aquamarine official references" },
  { duplicateId: 4064, canonicalIds: [5903, 5904], reason: "Doxa SUB 1500T Divingstar official references" },
  { duplicateId: 4065, canonicalIds: [5905, 5906], reason: "Doxa SUB 1500T Caribbean official references" },
  { duplicateId: 4066, canonicalIds: [5981, 5982], reason: "Doxa SUB 200 C-GRAPH II Divingstar official references" },
  { duplicateId: 4067, canonicalIds: [5975, 5976], reason: "Doxa SUB 200 C-GRAPH Divingstar official references" },
  { duplicateId: 4069, canonicalIds: [5810, 5811], reason: "Doxa SUB 300 Carbon Whitepearl official references" },
  { duplicateId: 4070, canonicalIds: [5994], reason: "Doxa SUB 300 Carbon Sharkhunter official reference" },
  { duplicateId: 4071, canonicalIds: [1787, 1788], reason: "Doxa SUB 300 Beta Sharkhunter official references" },
  { duplicateId: 4072, canonicalIds: [5936, 5937], reason: "Doxa SUB 300 Carbon Professional official references" },
  { duplicateId: 4073, canonicalIds: [5939, 5940], reason: "Doxa SUB 300 Carbon Caribbean official references" },
  { duplicateId: 4074, canonicalIds: [5941, 5942], reason: "Doxa SUB 300 Carbon Divingstar official references" },
  { duplicateId: 4075, canonicalIds: [5943, 5944], reason: "Doxa SUB 300 Carbon Aquamarine official references" },
  { duplicateId: 4218, canonicalIds: [1838], reason: "Glashütte Original Sixties Chronograph brand alias" },
  { duplicateId: 4221, canonicalIds: [1829], reason: "Glashütte Original Senator Chronometer brand alias" },
  { duplicateId: 4252, canonicalIds: [1158], reason: "Glashütte Original SeaQ Panorama Date brand alias" },
  { duplicateId: 4265, canonicalIds: [1839], reason: "Glashütte Original Sixties Small Second brand alias" },
  { duplicateId: 5079, canonicalIds: [6131], reason: "Armin Strom Minute Repeater Resonance official reference" },
  {
    duplicateId: 6139,
    canonicalIds: [5348, 5349, 5350, 5351, 5352, 5353, 5354, 5355, 5356, 5357],
    reason: "Christopher Ward C1 Bel Canto Classic official option references"
  },
  { duplicateId: 6312, canonicalIds: [6599], reason: "Nivada Grenchen Antarctic GMT Hodinkee official reference" },
  { duplicateId: 6482, canonicalIds: [3432, 3491, 3527, 3555], reason: "Breitling Avenger B01 Chronograph 44 official references" },
  { duplicateId: 7090, canonicalIds: [7532, 7533, 7534], reason: "Belisar Date Sport Pro official references" },
  { duplicateId: 7091, canonicalIds: [2935], reason: "Bangalore Watch Co. MACH 1 Admiral brand alias" },
  {
    duplicateId: 7112,
    canonicalIds: [7507, 7516, 7524, 7526, 7527, 7543, 7559, 7561],
    reason: "Belisar Chronograph 44mm official references"
  },
  { duplicateId: 7122, canonicalIds: [6469], reason: "Doxa SUB 200T canonical family record" },
  { duplicateId: 7139, canonicalIds: [7521], reason: "1893 Johannes Dürrstein Moon Phase official rose-gold reference" },
  { duplicateId: 7141, canonicalIds: [4547], reason: "Louis Erard Régulateur Gravé Noir canonical reference" },
  { duplicateId: 7184, canonicalIds: [6387], reason: "Paulin Mara canonical record" },
  {
    duplicateId: 7185,
    canonicalIds: [7501, 7511, 7512, 7525, 7537, 7538, 7539, 7540],
    reason: "Belisar Chronograph Moon Phase official references"
  },
  { duplicateId: 7228, canonicalIds: [7496, 7503, 7504], reason: "Averin Chronograph official references" },
  { duplicateId: 7269, canonicalIds: [7273], reason: "Hautlence Destination dimensions were transposed" },
  { duplicateId: 7372, canonicalIds: [584, 585, 586], reason: "Longines Spirit 37 official references" },
  { duplicateId: 7446, canonicalIds: [7150], reason: "Omega Speedmaster Moonphase Meteorite canonical 43mm record" },
  { duplicateId: 7447, canonicalIds: [7354, 7396], reason: "Gerald Charles 25th anniversary Maestro models" },
  { duplicateId: 7479, canonicalIds: [6394], reason: "Niton Prima canonical 42mm lug-to-lug record" }
];

const FAMILY_GROUPS = [
  {
    ids: [63, 2973],
    canonicalModel: "Ocean Star Tribute",
    modelGroup: "mido-ocean-star-tribute"
  },
  {
    ids: [1212, 2252, 2253, 2254, 2255, 2256],
    canonicalModel: "Chronomaster Sport",
    modelGroup: "zenith-chronomaster-sport"
  },
  {
    ids: [1673, 3318, 3321, 3322, 3324, 3329, 3332, 3339, 7484],
    canonicalModel: "B 1.618 UltraFino",
    modelGroup: "bianchet-b-1-618-ultrafino"
  },
  {
    ids: [1832, 1833, 1834, 1835, 1836, 1837],
    canonicalModel: "Seventies Chronograph Panorama Date",
    modelGroup: "glash-tte-original-seventies-chronograph-panorama-date"
  },
  {
    ids: [2107, 2108],
    canonicalModel: "01Series Gen 3",
    modelGroup: "studio-underd0g-x-time-tide-01series-gen-3"
  },
  {
    ids: [2168, 2169, 2170, 2171],
    canonicalModel: "Formula 1 Chronograph",
    modelGroup: "tag-heuer-formula-1-chronograph"
  },
  {
    ids: [3317, 3323, 3327, 3330, 3336, 3338, 3342],
    canonicalModel: "B 1.618 Flying Tourbillon Sport GMT",
    modelGroup: "bianchet-b-1-618-flying-tourbillon-sport-gmt"
  },
  {
    ids: [3319, 3320, 3325, 3326, 3328, 3331, 3333, 3334, 3335, 3337, 3340, 3341],
    canonicalModel: "B 1.618 Flying Tourbillon Grande Date",
    modelGroup: "bianchet-b-1-618-flying-tourbillon-grande-date"
  },
  {
    ids: [6123, 6124, 6468],
    canonicalModel: "Carrera Chronograph Tourbillon Extreme Sport",
    modelGroup: "tag-heuer-carrera-chronograph-tourbillon-extreme-sport"
  },
  {
    ids: [6958, 6998, 7050, 7113, 7402],
    canonicalModel: "Superman",
    modelGroup: "yema-superman"
  },
  {
    ids: [7069, 7220],
    canonicalModel: "Wristmaster",
    modelGroup: "yema-wristmaster"
  },
  {
    ids: [7089, 7196],
    canonicalModel: "Pioneer Silva",
    modelGroup: "hanhart-pioneer-silva"
  },
  {
    ids: [7110, 7133, 7145],
    canonicalModel: "Amphibian 250",
    modelGroup: "eska-amphibian-250"
  },
  {
    ids: [7138, 7252],
    canonicalModel: "Aquasphere",
    modelGroup: "hanhart-aquasphere"
  },
  {
    ids: [3660, 7166],
    canonicalModel: "Altitude MB Meteor",
    modelGroup: "bremont-altitude-mb-meteor"
  },
  {
    ids: [7216, 7395],
    canonicalModel: "Stardust",
    modelGroup: "sarpaneva-stardust"
  },
  {
    ids: [7279, 7284],
    canonicalModel: "Harmony Chronograph",
    modelGroup: "vacheron-constantin-harmony-chronograph"
  },
  {
    ids: [6925, 7288],
    canonicalModel: "Reverso Tribute Gyrotourbillon",
    modelGroup: "jaeger-lecoultre-reverso-tribute-gyrotourbillon"
  },
  {
    ids: [7286, 7311, 7314, 7324, 7325, 7328, 7329, 7344, 7363, 7377, 7413, 7492],
    canonicalModel: "Monaco",
    modelGroup: "tag-heuer-monaco"
  },
  {
    ids: [7297, 7300, 7335],
    canonicalModel: "BR 03",
    modelGroup: "bell-and-ross-br-03"
  },
  {
    ids: [7350, 7399],
    canonicalModel: "Tetra",
    modelGroup: "nomos-tetra"
  },
  {
    ids: [7354, 7476],
    canonicalModel: "Maestro 2.0",
    modelGroup: "gerald-charles-maestro-2"
  },
  {
    ids: [7362, 7409],
    canonicalModel: "Récital 23",
    modelGroup: "bovet-recital-23"
  },
  {
    ids: [7378, 7393, 7457],
    canonicalModel: "1972 Competition Chronograph",
    modelGroup: "junghans-1972-competition-chronograph"
  },
  {
    ids: [7394, 7397, 7398, 7434, 7455, 7475],
    canonicalModel: "Alpiner Extreme",
    modelGroup: "alpina-alpiner-extreme"
  },
  {
    ids: [6378, 7419],
    canonicalModel: "Mirage",
    modelGroup: "berneron-mirage"
  },
  {
    ids: [7405, 7431],
    canonicalModel: "Multifort TV Big Date",
    modelGroup: "mido-multifort-tv-big-date"
  },
  {
    ids: [7421, 7490],
    canonicalModel: "Perception",
    modelGroup: "atelier-wen-perception"
  },
  {
    ids: [7426, 7493],
    canonicalModel: "Masterlink",
    modelGroup: "gerald-charles-masterlink"
  },
  {
    ids: [7443, 7477],
    canonicalModel: "Anatom",
    modelGroup: "rado-anatom"
  }
];

function normalizedUrl(value) {
  return String(value ?? "").replace(/\/$/u, "");
}

function appendSource(target, source, duplicate, reason) {
  if (target.sources.some((item) => normalizedUrl(item.sourceUrl) === normalizedUrl(source.sourceUrl))) return false;

  let note = source.note;
  if (note) {
    const identity = `for ${duplicate.brand} ${duplicate.model} in “`;
    const replacement = `for ${target.brand} ${target.model} (${target.reference}) in “`;
    note = note.replace(identity, replacement);

    const sameCase = Number(duplicate.caseMm) === Number(target.caseMm);
    const sameLugToLug = Number(duplicate.lugToLugMm) === Number(target.lugToLugMm);
    if (!sameCase || !sameLugToLug) {
      note += ` Canonical target dimensions retained: ${target.caseMm}mm case and ${target.lugToLugMm}mm lug-to-lug (${reason}).`;
    }
  }

  target.sources.push({ ...source, note });
  return true;
}

function normalizedFix(value) {
  return typeof value === "string" ? { model: value } : value;
}

function updateSourceModelNotes(watch, previousModel, nextModel) {
  for (const source of watch.sources) {
    if (!source.note) continue;
    source.note = source.note.replace(
      `${watch.brand} ${previousModel}`,
      `${watch.brand} ${nextModel}`
    );
  }
}

const watches = JSON.parse(await readFile(seedPath, "utf8"));
const watchesById = new Map(watches.map((watch) => [watch.id, watch]));
const changedNames = [];

for (const [id, rawFix] of NAME_FIXES) {
  const watch = watchesById.get(id);
  if (!watch) {
    const isExpectedRetirement = RETIRED_EDITORIAL_IDS.has(id) || MERGES.some((merge) => merge.duplicateId === id);
    if (isExpectedRetirement) continue;
    throw new Error(`Missing watch ${id} for editorial-name normalization.`);
  }
  const fix = normalizedFix(rawFix);
  const previousModel = watch.model;
  const previousReference = watch.reference;
  const previousState = JSON.stringify({
    model: watch.model,
    reference: watch.reference,
    canonicalModel: watch.canonicalModel,
    modelGroup: watch.modelGroup,
    variant: watch.variant,
    lugToLugMm: watch.lugToLugMm,
    caseMm: watch.caseMm,
    thicknessMm: watch.thicknessMm,
    lugWidthMm: watch.lugWidthMm
  });
  const nextReference = fix.reference ?? (previousReference === previousModel ? fix.model : previousReference);

  watch.model = fix.model;
  watch.reference = nextReference;
  for (const field of ["canonicalModel", "modelGroup", "variant"]) {
    if (!Object.hasOwn(fix, field)) continue;
    if (fix[field] == null) delete watch[field];
    else watch[field] = fix[field];
  }
  for (const metric of ["lugToLugMm", "caseMm", "thicknessMm", "lugWidthMm"]) {
    if (Object.hasOwn(fix, metric)) watch[metric] = fix[metric];
  }
  updateSourceModelNotes(watch, previousModel, fix.model);

  const nextState = JSON.stringify({
    model: watch.model,
    reference: watch.reference,
    canonicalModel: watch.canonicalModel,
    modelGroup: watch.modelGroup,
    variant: watch.variant,
    lugToLugMm: watch.lugToLugMm,
    caseMm: watch.caseMm,
    thicknessMm: watch.thicknessMm,
    lugWidthMm: watch.lugWidthMm
  });
  if (previousState !== nextState) {
    changedNames.push({ id, fromModel: previousModel, toModel: watch.model, fromReference: previousReference, toReference: watch.reference });
  }
}

for (const rewrite of MODEL_REWRITES) {
  for (const id of rewrite.ids) {
    const watch = watchesById.get(id);
    if (!watch) throw new Error(`Missing watch ${id} for repeated-model normalization.`);
    if (!rewrite.pattern.test(watch.model)) continue;

    const previousModel = watch.model;
    const previousReference = watch.reference;
    const nextModel = previousModel.replace(rewrite.pattern, rewrite.replacement).replace(/\s+/gu, " ").trim();

    watch.model = nextModel;
    if (previousReference === previousModel) watch.reference = nextModel;
    updateSourceModelNotes(watch, previousModel, nextModel);
    changedNames.push({
      id,
      fromModel: previousModel,
      toModel: nextModel,
      fromReference: previousReference,
      toReference: watch.reference
    });
  }
}

const retiredIds = new Set(RETIRED_EDITORIAL_IDS);
const mergeResults = [];
let transferredSourceCount = 0;

for (const merge of MERGES) {
  retiredIds.add(merge.duplicateId);
  const duplicate = watchesById.get(merge.duplicateId);
  if (!duplicate) {
    mergeResults.push({ ...merge, status: "already-retired", transferredSourceCount: 0 });
    continue;
  }
  const targets = merge.canonicalIds.map((id) => {
    const target = watchesById.get(id);
    if (!target) throw new Error(`Missing canonical watch ${id} for duplicate ${merge.duplicateId}.`);
    return target;
  });

  let transferredForMerge = 0;
  for (const target of targets) {
    for (const source of duplicate.sources) {
      if (appendSource(target, source, duplicate, merge.reason)) transferredForMerge += 1;
    }
  }
  transferredSourceCount += transferredForMerge;
  mergeResults.push({ ...merge, status: "merged", transferredSourceCount: transferredForMerge });
}

for (const group of FAMILY_GROUPS) {
  for (const id of group.ids) {
    const watch = watchesById.get(id);
    if (!watch || retiredIds.has(id)) throw new Error(`Missing active watch ${id} for ${group.modelGroup}.`);
    watch.canonicalModel = group.canonicalModel;
    watch.modelGroup = group.modelGroup;
    watch.variant = watch.model === group.canonicalModel ? undefined : watch.model;
  }
}

const finalWatches = watches.filter((watch) => !retiredIds.has(watch.id));
const report = {
  generatedAt: new Date().toISOString(),
  apply,
  initialWatchCount: watches.length,
  finalWatchCount: finalWatches.length,
  normalizedNameCount: changedNames.length,
  retiredEditorialCount: RETIRED_EDITORIAL_IDS.size,
  mergedDuplicateCount: MERGES.length,
  groupedFamilyCount: FAMILY_GROUPS.length,
  transferredSourceCount,
  retiredIds: [...retiredIds].sort((left, right) => left - right),
  changedNames,
  mergeResults
};

if (apply) await writeFile(seedPath, `${JSON.stringify(finalWatches, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(
  `Watch data normalization ${apply ? "applied" : "previewed"}: ${changedNames.length} names normalized, ` +
    `${RETIRED_EDITORIAL_IDS.size} editorials retired, ${MERGES.length} duplicate rows merged, ` +
    `${FAMILY_GROUPS.length} families grouped, ${transferredSourceCount} sources transferred.\n`
);
