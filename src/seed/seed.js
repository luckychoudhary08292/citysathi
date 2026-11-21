require("dotenv").config();

const mongoose = require("mongoose");

const cities = [
  { id: "indore", name: "Indore", state: "Madhya Pradesh", latitude: 22.7196, longitude: 75.8577, heroImageUrl: "https://images.unsplash.com/photo-1599661046827-dacff0c0f0a2?auto=format&fit=crop&w=1800&q=90", collectionName: "city_indore" },
  { id: "bhopal", name: "Bhopal", state: "Madhya Pradesh", latitude: 23.2599, longitude: 77.4126, heroImageUrl: "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1800&q=90", collectionName: "city_bhopal" },
  { id: "bengaluru", name: "Bengaluru", state: "Karnataka", latitude: 12.9716, longitude: 77.5946, heroImageUrl: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1800&q=90", collectionName: "city_bengaluru" },
  { id: "jaipur", name: "Jaipur", state: "Rajasthan", latitude: 26.9124, longitude: 75.7873, heroImageUrl: "https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1800&q=90", collectionName: "city_jaipur" },
  { id: "delhi", name: "Delhi", state: "Delhi", latitude: 28.6139, longitude: 77.209, heroImageUrl: "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=1800&q=90", collectionName: "city_delhi" },
];

const categoryFilters = {
  indore: {
    HERITAGE: ["Royal Palace", "Historic", "Temple", "Architecture"],
    FOOD: ["Street Food", "Namkeen", "Local Cuisine"],
    SHOPPING: ["Local Market", "Mall", "Handicrafts"],
    ENTERTAINMENT: ["Cinema", "Family", "Live Events"],
    NATURE: ["Lake", "Garden", "Wildlife"],
    CULTURE: ["Museum", "Textile", "Local History"],
  },
  bhopal: {
    HERITAGE: ["Mosque", "Palace", "Historic", "Architecture"],
    FOOD: ["Street Food", "Bhopali Cuisine", "Cafe"],
    SHOPPING: ["New Market", "Mall", "Crafts"],
    ENTERTAINMENT: ["Arts", "Performance", "Family"],
    NATURE: ["Upper Lake", "Wildlife", "Garden"],
    CULTURE: ["Tribal Art", "Museum", "Exhibition"],
  },
  jaipur: {
    HERITAGE: ["Forts", "Palaces", "Observatory", "UNESCO"],
    FOOD: ["Rajasthani Cuisine", "Street Food", "Sweets"],
    SHOPPING: ["Bazaars", "Jewelry", "Textiles"],
    ENTERTAINMENT: ["Cinema", "Folk Music", "Family"],
    NATURE: ["Gardens", "Hills", "Wildlife"],
    CULTURE: ["Museum", "Block Printing", "Rajput History"],
  },
  bengaluru: {
    HERITAGE: ["Royal Palace", "Historic", "Architecture", "Monument"],
    FOOD: ["South Indian", "Cafe", "Food Street"],
    SHOPPING: ["Commercial Street", "Technology", "Handicrafts"],
    ENTERTAINMENT: ["Live Music", "Cinema", "Family"],
    NATURE: ["Urban Park", "Botanical Garden", "Lake"],
    CULTURE: ["Science Museum", "Kannada Culture", "Exhibition"],
  },
  delhi: {
    HERITAGE: ["Mughal Forts", "UNESCO", "Tombs", "Monuments"],
    FOOD: ["Old Delhi", "Street Food", "Mughlai Cuisine"],
    SHOPPING: ["Bazaars", "Markets", "Modern Retail"],
    ENTERTAINMENT: ["Promenade", "Cinema", "Live Events"],
    NATURE: ["Historic Gardens", "Urban Park", "Birding"],
    CULTURE: ["National Museum", "Art Gallery", "History"],
  },
};

const placesByCity = {
  indore: [
    ["HERITAGE", "Rajwada Palace", "Historic Maratha palace", ["Historic", "Palace", "Monument"]],
    ["HERITAGE", "Lal Bagh Palace", "Royal residence and museum", ["Historic", "Palace", "Museum"]],
    ["FOOD", "Sarafa Night Market", "Street food after dark", ["Street Food", "Market", "Local Cuisine"]],
    ["FOOD", "Chappan Dukan", "Iconic local food street", ["Street Food", "Local Cuisine"]],
    ["SHOPPING", "Treasure Island Mall", "Shopping and dining", ["Mall", "Shopping"]],
    ["ENTERTAINMENT", "Regal Cinema", "Classic city cinema", ["Cinema", "Family"]],
    ["NATURE", "Regional Park", "Lakeside green escape", ["Park", "Lake", "Nature"]],
    ["CULTURE", "Indore Museum", "Local history and art", ["Museum", "History"]],
    ["HOSPITAL", "Bombay Hospital Indore", "Multispecialty hospital", ["Hospital", "Emergency"]],
    ["ATM", "Central Indore ATM", "Cash and banking", ["ATM", "24/7"]],
    ["PHARMACY", "Apollo Pharmacy Indore", "Medicine and wellness", ["Pharmacy", "24/7"]],
    ["TRANSPORT", "Indore Junction", "Railway station", ["Railway", "Transport"]],
    ["EMERGENCY", "Indore Emergency Services", "Emergency response", ["Emergency", "112"]],
  ],
  bhopal: [
    ["HERITAGE", "Taj-ul-Masajid", "Historic grand mosque", ["Historic", "Architecture", "Monument"]],
    ["HERITAGE", "Gohar Mahal", "Heritage palace by the lake", ["Historic", "Palace"]],
    ["FOOD", "Chatori Gali", "Popular street food lane", ["Street Food", "Local Cuisine"]],
    ["FOOD", "Jehan Numa Cafe", "Regional dining", ["Cafe", "Local Cuisine"]],
    ["SHOPPING", "DB City Mall", "Shopping and dining", ["Mall", "Shopping"]],
    ["ENTERTAINMENT", "Bharat Bhavan", "Arts and performance venue", ["Live Events", "Arts"]],
    ["NATURE", "Van Vihar National Park", "Wildlife beside Upper Lake", ["Park", "Wildlife"]],
    ["CULTURE", "Madhya Pradesh Tribal Museum", "Regional culture exhibits", ["Museum", "Culture"]],
    ["HOSPITAL", "AIIMS Bhopal", "Public multispecialty hospital", ["Hospital", "Emergency"]],
    ["ATM", "New Market ATM", "Cash and banking", ["ATM", "24/7"]],
    ["PHARMACY", "Bhopal City Pharmacy", "Medicine and wellness", ["Pharmacy"]],
    ["TRANSPORT", "Rani Kamlapati Station", "Railway station", ["Railway", "Transport"]],
    ["EMERGENCY", "Bhopal Emergency Services", "Emergency response", ["Emergency", "112"]],
  ],
  bengaluru: [
    ["HERITAGE", "Bangalore Palace", "Royal Tudor-style palace", ["Historic", "Palace", "Architecture"]],
    ["HERITAGE", "Tipu Sultan Summer Palace", "Historic teakwood palace", ["Historic", "Palace", "Monument"]],
    ["FOOD", "VV Puram Food Street", "Beloved local food street", ["Street Food", "Local Cuisine"]],
    ["FOOD", "Indiranagar Cafe District", "Neighborhood cafes and dining", ["Cafe", "Local Cuisine"]],
    ["SHOPPING", "Commercial Street", "Busy shopping district", ["Market", "Shopping"]],
    ["ENTERTAINMENT", "UB City", "Dining and city events", ["Live Events", "Family"]],
    ["NATURE", "Cubbon Park", "Green heart of Bengaluru", ["Park", "Garden"]],
    ["CULTURE", "Visvesvaraya Museum", "Science and technology exhibits", ["Museum", "Exhibition"]],
    ["HOSPITAL", "Manipal Hospital", "Multispecialty hospital", ["Hospital", "Emergency"]],
    ["ATM", "MG Road ATM", "Cash and banking", ["ATM", "24/7"]],
    ["PHARMACY", "Bengaluru City Pharmacy", "Medicine and wellness", ["Pharmacy"]],
    ["TRANSPORT", "KSR Bengaluru City Junction", "Railway station", ["Railway", "Transport"]],
    ["EMERGENCY", "Bengaluru Emergency Services", "Emergency response", ["Emergency", "112"]],
  ],
  jaipur: [
    ["HERITAGE", "Amber Fort", "Hilltop Rajput fort", ["Historic", "Fort", "Monument"]],
    ["HERITAGE", "City Palace Jaipur", "Royal residence and museum", ["Historic", "Palace", "Museum"]],
    ["FOOD", "Rawat Mishthan Bhandar", "Famous local snacks and sweets", ["Local Cuisine", "Street Food"]],
    ["FOOD", "Johari Bazaar Food Lane", "Traditional local food", ["Street Food", "Market"]],
    ["SHOPPING", "Johari Bazaar", "Traditional jewelry market", ["Market", "Shopping"]],
    ["ENTERTAINMENT", "Raj Mandir Cinema", "Iconic art deco cinema", ["Cinema", "Family"]],
    ["NATURE", "Central Park Jaipur", "Urban gardens and paths", ["Park", "Garden"]],
    ["CULTURE", "Albert Hall Museum", "Art and heritage collections", ["Museum", "Culture"]],
    ["HOSPITAL", "SMS Hospital Jaipur", "Public multispecialty hospital", ["Hospital", "Emergency"]],
    ["ATM", "MI Road ATM", "Cash and banking", ["ATM", "24/7"]],
    ["PHARMACY", "Jaipur City Pharmacy", "Medicine and wellness", ["Pharmacy"]],
    ["TRANSPORT", "Jaipur Junction", "Railway station", ["Railway", "Transport"]],
    ["EMERGENCY", "Jaipur Emergency Services", "Emergency response", ["Emergency", "112"]],
  ],
  delhi: [
    ["HERITAGE", "Red Fort", "Historic Mughal fort", ["Historic", "Fort", "Monument"]],
    ["HERITAGE", "Humayun's Tomb", "UNESCO-listed garden tomb", ["Historic", "Monument", "Architecture"]],
    ["FOOD", "Chandni Chowk Food Lane", "Old Delhi street food", ["Street Food", "Local Cuisine"]],
    ["FOOD", "Khan Market Cafe", "Popular neighborhood dining", ["Cafe", "Local Cuisine"]],
    ["SHOPPING", "Connaught Place", "Central shopping district", ["Market", "Shopping"]],
    ["ENTERTAINMENT", "India Gate Promenade", "Evening city gathering spot", ["Family", "Outdoor"]],
    ["NATURE", "Lodhi Garden", "Historic gardens and walking paths", ["Park", "Garden"]],
    ["CULTURE", "National Museum", "Indian art and history", ["Museum", "Exhibition"]],
    ["HOSPITAL", "AIIMS Delhi", "Public multispecialty hospital", ["Hospital", "Emergency"]],
    ["ATM", "Connaught Place ATM", "Cash and banking", ["ATM", "24/7"]],
    ["PHARMACY", "Central Delhi Pharmacy", "Medicine and wellness", ["Pharmacy"]],
    ["TRANSPORT", "New Delhi Railway Station", "Railway station", ["Railway", "Transport"]],
    ["EMERGENCY", "Delhi Emergency Services", "Emergency response", ["Emergency", "112"]],
  ],
};

const imageUrls = [
  "https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1400&q=90",
  "https://images.unsplash.com/photo-1524498250077-390f9e378fc0?auto=format&fit=crop&w=1400&q=90",
  "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=1400&q=90",
  "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1400&q=90",
  "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1400&q=90",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=90",
];

const categoryDescriptions = {
  HERITAGE: "Discover a landmark that preserves the city's history, architecture and stories.",
  FOOD: "Enjoy local flavors and popular dining loved by residents and visitors.",
  SHOPPING: "Explore local shopping, crafts, markets and well-known retail destinations.",
  ENTERTAINMENT: "A favorite city venue for leisure, events, and fun with friends or family.",
  NATURE: "A scenic outdoor escape for fresh air, quiet walks and time in nature.",
  CULTURE: "Explore local art, culture, history and the stories of the region.",
  HOSPITAL: "Healthcare facility with emergency and specialist services.",
  ATM: "Convenient access to cash and banking services.",
  PHARMACY: "Find medicines, health essentials and pharmacy services.",
  TRANSPORT: "A useful local transport point for getting around the city.",
  EMERGENCY: "Emergency assistance is available by calling India's emergency number 112.",
};

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function makePlaces() {
  return cities.flatMap((city) =>
    placesByCity[city.id].map(([category, name, subtitle, subCategories], index) => ({
      id: `${slug(name)}_${city.id}`,
      docType: "place",
      cityId: city.id,
      name,
      subtitle,
      category,
      rating: Number((4.2 + ((index + city.name.length) % 8) * 0.1).toFixed(1)),
      reviewCountLabel: `${850 + index * 137} Reviews`,
      distanceLabel: `${(0.7 + index * 0.35).toFixed(1)} km`,
      tags: [...subCategories.slice(0, 2), city.name],
      subCategories,
      description: `${categoryDescriptions[category]} ${name} is located in ${city.name}, ${city.state}.`,
      openHours: ["HOSPITAL", "ATM", "PHARMACY", "EMERGENCY"].includes(category)
        ? "Open 24 hours"
        : "9:00 AM - 9:00 PM",
      phone: category === "EMERGENCY" ? "112" : "+91 0000000000",
      address: `${name}, ${city.name}, ${city.state}`,
      latitude: Number((city.latitude + ((index % 5) - 2) * 0.008).toFixed(4)),
      longitude: Number((city.longitude + ((index % 7) - 3) * 0.008).toFixed(4)),
      imageUrl: imageUrls[(index + cities.indexOf(city)) % imageUrls.length],
      isPopular: index < 2,
      isTrending: category === "FOOD" || index === 0,
    }))
  );
}

function makeCityServices() {
  const serviceInfo = [
    ["TRANSPORT", "Central Transit Station", "Public transport connections", "Open 24 hours", "+91 0000000101"],
    ["COLLEGES", "City Central College", "University and higher education", "8:00 AM - 6:00 PM", "+91 0000000102"],
    ["PHARMACY", "City 24 Hour Pharmacy", "Pharmacy and medical supplies", "Open 24 hours", "+91 0000000103"],
    ["EMERGENCY", "Emergency Services 112", "Police, fire and ambulance emergency response", "Call 112", "112"],
  ];

  return cities.flatMap((city) =>
    serviceInfo.map(([group, name, subtitle, distanceOrHours, phone], index) => ({
      id: `${city.id}_${group.toLowerCase()}_service`,
      docType: "service",
      cityId: city.id,
      group,
      name: `${city.name} ${name}`,
      subtitle,
      distanceOrHours,
      latitude: Number((city.latitude + (index - 1.5) * 0.01).toFixed(4)),
      longitude: Number((city.longitude + (index - 1.5) * 0.01).toFixed(4)),
      phone,
    }))
  );
}

async function seedDatabaseIfEmpty() {
  const places = makePlaces();
  const services = makeCityServices();
  const cityCollection = mongoose.connection.db.collection("cities");
  const categoryCollection = mongoose.connection.db.collection("categories");
  const categories = cities.flatMap((city) =>
    Object.entries(categoryFilters[city.id]).map(([category, subCategories]) => ({
      id: `${city.id}_${category}`,
      cityId: city.id,
      category,
      title: "Places & Attractions",
      subCategories,
    }))
  );
  const homeMeta = cities.map((city, index) => ({
    id: "home_meta",
    docType: "home_meta",
    cityId: city.id,
    cityName: city.name,
    heroSubtitle: `Unforgettable journeys in ${city.name},\ncreated for you.`,
    headerImageUrl: city.heroImageUrl,
    promoBanner: {
      id: `promo_${city.id}_1`,
      badgeText: "FEATURED",
      title: `${city.name} Weekend Pass`,
      subtitle: "Curated heritage walks and local food trails ready to plan.",
      ctaLabel: "Plan Trip",
      imageUrl: imageUrls[index % imageUrls.length],
      targetRoute: "plan_trip",
    },
  }));

  await cityCollection.createIndex({ id: 1 }, { unique: true });
  await categoryCollection.createIndex({ cityId: 1, category: 1 }, { unique: true });

  for (const city of cities) {
    const { collectionName, ...cityFields } = city;
    await cityCollection.updateOne(
      { id: city.id },
      { $set: { collectionName }, $setOnInsert: cityFields },
      { upsert: true }
    );

    const personalCollection = mongoose.connection.db.collection(collectionName);
    await personalCollection.createIndex({ id: 1 }, { unique: true });
    const cityPlaces = places.filter((place) => place.cityId === city.id);
    const cityServices = services.filter((service) => service.cityId === city.id);
    const cityHomeMeta = homeMeta.find((meta) => meta.cityId === city.id);
    const documents = [cityHomeMeta, ...cityPlaces, ...cityServices];
    if (documents.length) {
      await personalCollection.bulkWrite(
        documents.map((doc) => ({
          updateOne: {
            filter: { id: doc.id },
            update: { $setOnInsert: doc },
            upsert: true,
          },
        })),
        { ordered: true }
      );
    }
  }

  if (categories.length) {
    await categoryCollection.bulkWrite(
      categories.map((doc) => ({
        updateOne: {
          filter: { cityId: doc.cityId, category: doc.category },
          update: { $setOnInsert: doc },
          upsert: true,
        },
      })),
      { ordered: true }
    );
  }

  const insertedCategoryCount = categories.length;
  console.log(
    `Seed initializer checked ${cities.length} cities, ${places.length} places, ${services.length} services, and ${insertedCategoryCount} categories`
  );
  return true;
}

if (require.main === module) {
  if (!process.env.MONGODB_URI) {
    console.error("Seed failed: MONGODB_URI is required");
    process.exit(1);
  }
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(seedDatabaseIfEmpty)
    .then(() => mongoose.disconnect())
    .catch(async (error) => {
      console.error("Seed failed:", error.message);
      await mongoose.disconnect();
      process.exit(1);
    });
}

module.exports = { seedDatabaseIfEmpty };
