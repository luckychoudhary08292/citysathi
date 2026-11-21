# City Companion API

Production-ready Node.js, Express, Mongoose REST API for the City Companion Android app.

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
```

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
