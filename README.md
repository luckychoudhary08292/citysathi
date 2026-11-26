# City Companion API

Node.js, Express, and MongoDB REST API for the City Companion Android app.

## MongoDB layout

- `cities`: city selector metadata and each city's personal collection name.
- `city_<cityId>`: that city's `home_meta`, `place`, `service`, and `app` documents.
- `categories`: fixed parent categories and city-specific sub-category filters.
- `map_categories`: ordered, custom Map filter chips scoped to a city.
- `trips`: user-scoped trip plans and checkpoints.
- `tips`: place tips and ratings.
- `users`: Android username/email accounts and password reset tokens.

## Requirements

- Node.js 18+
- MongoDB Atlas or local MongoDB

## Local setup

```bash
npm install
cp .env.example .env
```

Set `MONGODB_URI` and `JWT_SECRET` in `.env`, then run:

```bash
npm run dev
```

The backend does not seed or auto-create application data at startup. City, place, category, home, and service records must be managed through your admin tooling or inserted separately. API reads query MongoDB directly. Starting or restarting the backend does not insert or delete application documents.

The server listens on `PORT` (default `5000`). Health check:

```bash
curl http://localhost:5000/health
```

## API examples

Android account signup and signin:

```bash
curl -X POST http://localhost:5000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"Lucky","email":"lucky@email.com","password":"StrongPass123"}'

curl -X POST http://localhost:5000/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"identifier":"Lucky","password":"StrongPass123"}'

curl -X POST http://localhost:5000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"lucky@email.com"}'
```

Password reset tokens are stored with a one-hour expiry. The forgot-password response never reveals whether an email is registered, and reset tokens are never returned by the API.

## Admin API

Configure `ADMIN_USERNAME` and `ADMIN_PASSWORD` in the server environment, then sign in to receive a 12-hour admin JWT:

```bash
curl -X POST http://localhost:5000/api/v1/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"change-this-password"}'
```

Send the token as `Authorization: Bearer <token>` for every `/api/v1/admin/*` endpoint. Optionally configure `ADMIN_API_KEY` and send `X-Admin-Key` for trusted server-side tools. Public signup cannot grant admin privileges.

Admin CRUD endpoints:

- `GET|POST /api/v1/admin/cities`; `PATCH|PUT|DELETE /api/v1/admin/cities/:cityId`
- `GET|PUT /api/v1/admin/cities/:cityId/home`
- `GET|POST /api/v1/admin/categories`; `PATCH|DELETE /api/v1/admin/categories/:id`
- `GET|POST /api/v1/admin/map-categories?cityId=...`; `PATCH|DELETE /api/v1/admin/map-categories/:id`
- `GET|POST /api/v1/admin/places`; `PATCH|DELETE /api/v1/admin/places/:id`
- `GET|POST /api/v1/admin/services`; `PATCH|DELETE /api/v1/admin/services/:id`
- `GET|POST /api/v1/admin/apps`; `PATCH|DELETE /api/v1/admin/apps/:id`
- `GET /api/v1/admin/tips`; `DELETE /api/v1/admin/tips/:id`

Public city service endpoints are `GET /api/v1/cities/:cityId/services` and `GET /api/v1/cities/:cityId/apps`. Service `highlightNumber` is optional, so map-category services without a phone/number are accepted. Compatibility aliases are `GET /api/v1/services?cityId=...` and `GET /api/v1/apps?cityId=...`.

The Map API is available at `GET /api/v1/cities/:cityId/map` and the compatible `GET /api/v1/cities/:cityId/map-services`, optionally with `?filter=<chip>`. Responses include `mapSubCategories`, `places`, `services`, and `cityApps` (`apps` is retained as a compatibility alias). Custom chips managed at `/api/v1/admin/map-categories` take precedence; if none exist for a city, chips are derived from that city's services. Map configuration is available at `GET /api/v1/map/config` and `GET /api/v1/config`; configure `MAPS_API_KEY` (or `GOOGLE_MAPS_API_KEY`) in the backend environment.

Public API GET responses include no-cache headers. CORS allows requests without an Origin header and accepts both HTTP and HTTPS for configured hosts in `ALLOWED_ORIGINS`.

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

## Real-time updates

The HTTP server also serves Socket.IO at `/socket.io`. Android clients may connect using polling or WebSocket, optionally with `cityId` in the handshake query. Clients can emit `join_city` with `{ "cityId": "indore" }` and `leave_city` with the same shape. Updates arrive as `data_updated` events containing `type`, `cityId`, `scope`, and `timestamp`.

When MongoDB supports change streams, updates are broadcast automatically from database changes. On standalone MongoDB, an admin service can notify connected clients with:

```bash
curl -X POST http://localhost:5000/api/v1/internal/notify-change \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: YOUR_INTERNAL_NOTIFY_SECRET" \
  -d '{"cityId":"indore","scope":"places"}'
```

Set `INTERNAL_SYNC_SECRET` in the server environment to require the matching header. The legacy `INTERNAL_NOTIFY_SECRET` is also accepted. If neither is set, the webhook does not require the header.

Successful `POST`, `PUT`, or `DELETE` requests to `/api/v1/places`, `/api/v1/places/:id`, or `/api/v1/cities/:cityId/places` emit a `data-updated` Socket.IO event with `type`, `cityId`, `scope: "places"`, `action`, and `timestamp`. City-targeted events go to that city's room and clients without a selected city.

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

Set `MONGODB_URI`, `JWT_SECRET`, `ALLOWED_ORIGINS` (optional comma-separated list), and `PORT` as environment variables. Ensure the required city and category data is provisioned by your admin/data-management process; application startup does not seed it.

Docker:

```bash
docker build -t city-companion-api .
docker run --env-file .env -p 5000:5000 city-companion-api
```
