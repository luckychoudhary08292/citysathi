require("dotenv").config();
const mongoose = require("mongoose");
const City = require("../models/City");
const Place = require("../models/Place");
const PromoBanner = require("../models/PromoBanner");

const cities = [
  { id: "indore", name: "Indore", state: "Madhya Pradesh", latitude: 22.7196, longitude: 75.8577, heroImageUrl: "https://images.unsplash.com/photo-1599661046827-dacff0c0f0a2?auto=format&fit=crop&w=1800&q=90" },
  { id: "bhopal", name: "Bhopal", state: "Madhya Pradesh", latitude: 23.2599, longitude: 77.4126, heroImageUrl: "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1800&q=90" },
  { id: "bengaluru", name: "Bengaluru", state: "Karnataka", latitude: 12.9716, longitude: 77.5946, heroImageUrl: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1800&q=90" },
  { id: "jaipur", name: "Jaipur", state: "Rajasthan", latitude: 26.9124, longitude: 75.7873, heroImageUrl: "https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1800&q=90" },
  { id: "delhi", name: "Delhi", state: "Delhi", latitude: 28.6139, longitude: 77.2090, heroImageUrl: "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=1800&q=90" },
];

const shared = {
  indore: {
    HERITAGE: ["Rajwada Palace", "Lal Bagh Palace"], FOOD: ["Sarafa Night Market", "Chappan Dukan"],
    SHOPPING: ["Treasure Island Mall"], ENTERTAINMENT: ["Regal Cinema"], NATURE: ["Regional Park"],
    CULTURE: ["Indore Museum"], HOSPITAL: ["Bombay Hospital"], ATM: ["Central ATM"],
  },
  bhopal: {
    HERITAGE: ["Upper Lake Palace", "Taj-ul-Masajid"], FOOD: ["Chatori Gali", "Jehan Numa Kitchen"],
    SHOPPING: ["DB City Mall"], ENTERTAINMENT: ["Bharat Bhavan"], NATURE: ["Van Vihar National Park"],
    CULTURE: ["Tribal Museum"], HOSPITAL: ["AIIMS Bhopal"], ATM: ["Lake View ATM"],
  },
  bengaluru: {
    HERITAGE: ["Bangalore Palace", "Tipu Sultan Summer Palace"], FOOD: ["VV Puram Food Street", "Indiranagar Cafe"],
    SHOPPING: ["Commercial Street"], ENTERTAINMENT: ["UB City"], NATURE: ["Cubbon Park"],
    CULTURE: ["VISVESVARAYA Museum"], HOSPITAL: ["Manipal Hospital"], ATM: ["MG Road ATM"],
  },
  jaipur: {
    HERITAGE: ["Amber Fort", "City Palace"], FOOD: ["Rawat Mishthan Bhandar", "Johari Bazaar Kiosk"],
    SHOPPING: ["Johari Bazaar"], ENTERTAINMENT: ["Raj Mandir Cinema"], NATURE: ["Central Park Jaipur"],
    CULTURE: ["Albert Hall Museum"], HOSPITAL: ["SMS Hospital"], ATM: ["MI Road ATM"],
  },
  delhi: {
    HERITAGE: ["Red Fort", "Humayun's Tomb"], FOOD: ["Chandni Chowk Khau Gali", "Khan Market Cafe"],
    SHOPPING: ["Connaught Place"], ENTERTAINMENT: ["India Gate Promenade"], NATURE: ["Lodhi Garden"],
    CULTURE: ["National Museum"], HOSPITAL: ["AIIMS Delhi"], ATM: ["CP ATM"],
  },
};

const categoryMeta = {
  HERITAGE: { subtitle: "Historic landmark", sub: ["Historic", "Palace", "Monument"], tags: ["Historic", "Architecture"], description: "A celebrated landmark preserving the city's history and architecture." },
  FOOD: { subtitle: "Popular local dining", sub: ["Street Food", "Cafe", "Local Cuisine"], tags: ["Food", "Local"], description: "A well-loved destination for regional flavors and memorable local dining." },
  SHOPPING: { subtitle: "Shopping and markets", sub: ["Market", "Mall", "Local Shopping"], tags: ["Shopping", "Market"], description: "Browse fashion, crafts, souvenirs and everyday local products." },
  ENTERTAINMENT: { subtitle: "Fun city experience", sub: ["Cinema", "Live Events", "Family"], tags: ["Entertainment", "Family"], description: "An engaging city venue for performances, cinema and leisure." },
  NATURE: { subtitle: "Green city escape", sub: ["Park", "Garden", "Wildlife"], tags: ["Nature", "Outdoor"], description: "A scenic outdoor space ideal for walks, picnics and nature lovers." },
  CULTURE: { subtitle: "Arts and culture", sub: ["Museum", "Gallery", "Exhibition"], tags: ["Culture", "Arts"], description: "Explore the art, traditions and stories that shape the local community." },
  HOSPITAL: { subtitle: "Medical care and services", sub: ["Hospital", "Emergency", "Clinic"], tags: ["Medical", "Emergency"], description: "A major medical facility offering healthcare and emergency services." },
  ATM: { subtitle: "Cash and banking", sub: ["ATM", "Bank", "24/7"], tags: ["ATM", "Banking"], description: "Convenient on-demand cash and banking services." },
};

const seedImages = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1524498250077-390f9e378fc0?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=85",
];

async function seed() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  await mongoose.connect(process.env.MONGODB_URI);

  await Promise.all([
    City.deleteMany({}),
    Place.deleteMany({}),
    PromoBanner.deleteMany({}),
  ]);
  await City.insertMany(cities);

  const places = [];
  for (const city of cities) {
    for (const [category, names] of Object.entries(shared[city.id])) {
      names.forEach((name, index) => {
        const meta = categoryMeta[category];
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
        places.push({
          id: `${slug}_${city.id}`,
          cityId: city.id,
          name,
          subtitle: meta.subtitle,
          category,
          rating: Number((4.2 + ((index + city.name.length) % 7) * 0.1).toFixed(1)),
          reviewCountLabel: `${800 + (index + city.name.length) * 173} Reviews`,
          distanceLabel: `${(0.8 + index * 0.6).toFixed(1)} km`,
          tags: [...meta.tags, city.name],
          subCategories: meta.sub,
          description: `${meta.description} Located in ${city.name}, ${name} is a must-visit stop for travelers.`,
          openHours: category === "ATM" ? "Open 24 hours" : category === "HOSPITAL" ? "Open 24 hours" : "9:00 AM - 9:00 PM",
          phone: "+91 0000000000",
          address: `${name}, ${city.name}, ${city.state}`,
          latitude: Number((city.latitude + (index % 3 - 1) * 0.012).toFixed(4)),
          longitude: Number((city.longitude + (index % 4 - 1.5) * 0.012).toFixed(4)),
          imageUrl: seedImages[(city.name.length + index) % seedImages.length],
          isPopular: index === 0 || (category === "HERITAGE" && index === 0),
          isTrending: index === 0 || category === "FOOD",
        });
      });
    }
  }

  await Place.insertMany(places);

  const banners = cities.map((city) => ({
    id: `promo_${city.id}_1`,
    cityId: city.id,
    badgeText: "FEATURED",
    title: `${city.name} Weekend Pass`,
    subtitle: "Curated heritage walks and local food trails ready to plan.",
    ctaLabel: "Plan Trip",
    imageUrl: `https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85`,
    targetRoute: "plan_trip",
  }));
  await PromoBanner.insertMany(banners);

  console.log(`Seeded ${cities.length} cities, ${places.length} places, and ${banners.length} banners`);
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error("Seed failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
