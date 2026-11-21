# City Companion API

Node.js, Express, and MongoDB REST API for the City Companion Android app.

## MongoDB layout

- `cities`: city selector metadata and each city's personal collection name.
- `city_<cityId>`: that city's `home_meta`, `place`, and `service` documents.
- `categories`: fixed parent categories and city-specific sub-category filters.
- `trips`: user-scoped trip plans and checkpoints.
- `tips`: place tips and ratings.

## Requirements

- Node.js 18+
- MongoDB Atlas or local MongoDB

## Local setup

```bash
npm install
cp .env.example .env
```

Set `MONGODB_URI` and `JWT_SECRET` in `.env`. Start MongoDB and run:

```bash
npm run seed
npm run dev
```

The server listens on `PORT` (default `5000`). Health check:

```bash
curl http://localhost:5000/health
```

## API examples

Register:

```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Aarav Sharma","email":"aarav@example.com","password":"StrongPass123","selectedCityId":"indore"}'
```

Login:

```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"aarav@example.com","password":"StrongPass123"}'
```

List cities:

```bash
curl http://localhost:5000/api/v1/cities
```

City home and explore:

```bash
curl http://localhost:5000/api/v1/cities/indore/home
curl "http://localhost:5000/api/v1/cities/indore/explore?category=HERITAGE&subCategory=Historic&q=palace"
curl "http://localhost:5000/api/v1/cities/indore/map-services?filter=PHARMACY"
curl "http://localhost:5000/api/v1/categories?cityId=indore&category=HERITAGE"
```

Trips are scoped to `X-User-Id`, then `X-Device-Id`, then a body `userId`, and finally `default_user`:

```bash
curl http://localhost:5000/api/v1/trips -H "X-User-Id: android-user-123"
curl -X POST http://localhost:5000/api/v1/trips \
  -H "X-User-Id: android-user-123" \
  -H "X-Device-Id: android-device-123" \
  -H "Content-Type: application/json" \
  -d '{"id":"weekend-indore","title":"Indore Weekend","cityId":"indore","duration":"2 days","placeIds":["rajwada_palace_indore"],"startDateMillis":1797724800000,"completedPlaceIds":[],"status":"UPCOMING"}'
```

Place tips:

```bash
curl http://localhost:5000/api/v1/places/rajwada_palace_indore/tips
curl -X POST http://localhost:5000/api/v1/places/rajwada_palace_indore/tips \
  -H "Content-Type: application/json" \
  -d '{"id":"tip-1","placeName":"Rajwada Palace","note":"Visit early to avoid the queues.","rating":4.5,"timestamp":1797724800000}'
```

On startup, the service idempotently inserts missing city, category, home, place, and service documents into the city-wise collections. It does not delete or overwrite existing documents or user trips. `npm run seed` runs the same initializer explicitly.

Protected activity (replace the token):

```bash
curl http://localhost:5000/api/v1/user/activity \
  -H "Authorization: Bearer YOUR_JWT"
```

Save a place:

```bash
curl -X POST http://localhost:5000/api/v1/user/saved \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"placeId":"rajwada_palace_indore"}'
```

Create a trip plan:

```bash
curl -X POST http://localhost:5000/api/v1/user/plans \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"title":"Indore Weekend","date":"2026-12-20","placeIds":["rajwada_palace_indore"],"notes":"Heritage walk","status":"PLANNED"}'
```

Update preferences:

```bash
curl -X PATCH http://localhost:5000/api/v1/user/preferences \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"selectedCityId":"jaipur","notificationsEnabled":true}'
```

## Deployment

Set `MONGODB_URI`, `JWT_SECRET`, `ALLOWED_ORIGINS` (optional comma-separated list), and `PORT` as environment variables. Run `npm run seed` once against the production database if needed.

Docker:

```bash
docker build -t city-companion-api .
docker run --env-file .env -p 5000:5000 city-companion-api
```
