# Gaps → Voids: Java Implementation Reference

Exact behavioral details extracted from the original Java/Spring implementation (©2025 Jason H House, MIT License). This document is the authoritative reference for TypeScript reimplementation — no guessing from here.

---

## 1. Gap-Finding Algorithm (GapsSearchService)

### Entry point
```
run(machineIdentifier: String, libraryKey: Int)
```

### Owned movies resolution
1. Load `ownedBasicMovies` from file for the given `(machineIdentifier, libraryKey)`.
2. Fail if empty (send `Payload.OWNED_MOVIES_CANNOT_BE_EMPTY`).
3. Maintain a `searched` list (ArrayList<BasicMovie>) to track dedups per run.

### For each owned movie, resolve TMDB/collection in priority order:

```
if (tmdbId != -1 AND collectionId != -1)
  → handleCollection directly (skip search)
  
else if (tmdbId != -1)
  → GET /movie/{tmdbId}  (fetch details + collectionId)
  
else if (imdbId is not blank)
  → GET /find/{imdbId}?external_source=imdb_id
  → extract tmdbId from result[0].id
  → GET /movie/{tmdbId}
  
else
  → GET /search/movie?query=title&year=year
  → extract tmdbId from result[0].id
  → GET /movie/{tmdbId}
```

Every TMDB hit is cached in file. Check cache before API call.

### Collection fetch & part processing

```
GET /collection/{collectionId}
  → check status_code 34 (not found) — if present, return
  → extract parts[] array
  
FOR each part NOT in ownedBasicMovies AND NOT in searched:
  1. Extract year from release_date (yyyy-MM-dd format)
  2. If MovieStatus=RELEASED:
     - Require release_date to be present (non-empty)
     - Require status field == "Released" (case-insensitive)
     - Skip if either check fails
  3. GET /movie/{partTmdbId} to fetch: imdb_id, genres, overview, poster_path
  4. Build recommended movie object
  5. Upsert to `recommended` set (dedup by movieKey: tmdbId→imdbId→normalized title+year)
  6. Add to `searched` list so we don't reprocess it
  7. Send progress event over WebSocket (searchedCount, totalCount, movie)
  
  8. Write RSS feed (incremental)
  
searched.add(originalMovie)  // Mark original as processed
```

### Rate limiting (original)
- Fixed `Thread.sleep(700)` after TMDB call
- Fixed `Thread.sleep(350)` in finally block (cumulative 1050ms per movie)
- No automatic retry; 4xx/5xx failures logged and skipped

### Cancellation
- `cancelSearch: AtomicBoolean` (Java concurrency flag)
- Check at loop top; throw `SearchCancelledException` if true
- Set false at start, true at end (in finally block)

---

## 2. Movie Identity Key (nameWithoutBadCharacters)

```java
name.replaceAll("[<>`~\\[\\]()*&^%$#@!|{}.,?\\-_=+:;]", "")
```

This regex normalizes movie titles for equality checks across owned/recommended.

**Equality rule:**
```
BasicMovie.equals(other):
  return year == other.year 
    AND nameWithoutBadCharacters == other.nameWithoutBadCharacters
```

**HashCode:** same two fields.

---

## 3. Plex Client (PlexQueryImpl)

### Default timeouts
- `TIMEOUT = 5000` ms for `/library/sections` (list libraries)
- `connectTimeout = readTimeout = writeTimeout = 180 seconds` (library listing + movie scanning)

### Query token
- Passed as `X-Plex-Token` query parameter (not header)

### Endpoints

#### Test/info
```
GET http://{address}:{port}/ ?X-Plex-Token={token}
  → parse /MediaContainer/@friendlyName, /@machineIdentifier
```

#### List libraries
```
GET http://{address}:{port}/library/sections ?X-Plex-Token={token}
  → parse JAXB MediaContainer → filter plexLibraries where type == "movie"
  → extract @key, @title, @type (must be "movie"), @scanner (e.g., "Plex Movie Scanner")
```

#### List movies in library
```
GET http://{address}:{port}/library/sections/{key}/all ?X-Plex-Token={token}
  → parse /MediaContainer/Video elements
  → extract: @title, @year, @ratingKey (int), @key, @thumb (poster), @summary
  → parse Genre children for genre tags
```

#### Get movie GUIDs (for imdb/tmdb ID extraction)
```
GET http://{address}:{port}/library/metadata/{ratingKey} ?X-Plex-Token={token}
  → parse /MediaContainer/Video/Guid children
  → extract @id attribute (modern: "imdb://tt1234567" or "tmdb://12345")
  → also check legacy @guid attribute on Video (old format, not a child)
```

### GUID Parsing (dual mode)

#### Legacy (old Plex Movie Scanner)
```
Video/@guid = "com.plexapp.agents.themoviedb://12345?lang=en"
  → strip "com.plexapp.agents.themoviedb://" → "12345?lang=en"
  → extract until "?" → tmdbId = 12345
  
Video/@guid = "com.plexapp.agents.imdb://tt1234567?lang=en"
  → strip "com.plexapp.agents.imdb://" → "tt1234567?lang=en"
  → extract until "?" → imdbId = "tt1234567"
```

#### Modern (Plex Movie agent)
```
Video/Guid/@id = "imdb://tt1234567"
  → strip "[A-Za-z]+://" → imdbId = "tt1234567"
  
Video/Guid/@id = "tmdb://12345"
  → strip "[A-Za-z]+://" → tmdbId = 12345
```

### Scanner skip
```
if (scanner == "Plex Movie Scanner") → return (skip GUID resolution for old libraries)
```

---

## 4. TMDB Client (GapsUrlGenerator + GapsSearchService)

### Base URL
```
https://api.themoviedb.org/3
```

### Endpoints

#### Search movie
```
GET /search/movie
  ?api_key={key}
  &language=en-US
  &query={title}
  &year={year}
  &page=1
  &include_adult=false
  
Response: { results: [...], total_results, ... }
Use result[0].id as tmdbId
```

#### Find by IMDb ID
```
GET /find/{imdbId}
  ?api_key={key}
  &language=en-US
  &external_source=imdb_id
  
Response: { movie_results: [...], ... }
Use movie_results[0].id as tmdbId
```

#### Movie details
```
GET /movie/{tmdbId}
  ?api_key={key}
  &language=en-US
  
Response fields parsed:
  - belongs_to_collection: { id, name, backdrop_path }  [nullable]
  - genres: [{ id, name }, ...]
  - imdb_id: "tt1234567"  [nullable]
  - status: "Released" | "Planned" | ...
  - release_date: "yyyy-MM-dd"  [blank if unknown]
  - poster_path: "/p/xyz"  [nullable, convert to URL]
  - backdrop_path: "/b/xyz"  [nullable]
  - title: string
  - id: int (tmdbId)
  - overview: string
```

#### Collection details
```
GET /collection/{collectionId}
  ?api_key={key}
  &language=en-US
  
Response:
  - id: int
  - name: string
  - backdrop_path: string  [nullable]
  - parts: [{ id, title, release_date, poster_path, ... }, ...]
  
  On NOT FOUND: { status_code: 34, status_message: "..." }
```

### Image URL construction
```
Poster:   https://image.tmdb.org/t/p/w185/{poster_path}
Backdrop: https://image.tmdb.org/t/p/original/{backdrop_path}
```

### Not-found handling
```
if (response.status_code == 34) → skip this collection (not an error)
```

### Language code (hardcoded)
```
languageCode = "en-US"
```

---

## 5. RSS Feed (Rss.java + FileIoService)

### Format
JSON array of objects, written per library.

### Object schema (for Radarr compatibility)
```json
{
  "imdb_id": "tt1234567",      // may be null
  "release_date": 2021,         // year as integer
  "tmdb_id": 12345,
  "title": "Movie Title",
  "poster_path": "https://image.tmdb.org/t/p/w185/..."
}
```

### @JsonProperty names (case-sensitive)
```
imdb_id         (not imdbId)
release_date    (not releaseDate — integer year)
tmdb_id         (not tmdbId)
title
poster_path     (not posterPath)
```

### File location
```
{data_dir}/{machineIdentifier}_{libraryKey}_movies.json
```

### Write behavior
- Upserted incrementally as movies are found (line 789 in GapsSearchService)
- Written on every new recommendation

---

## 6. Radarr Client

Not present in original Gaps. Specification mentions `/api/v3/movie?apikey={key}` for read-only verification, but no send functionality exists in the Java source.

---

## 7. Notifications (7 providers)

### Config fields per provider type

All inherit `enabled: Boolean` and `notificationTypes: NotificationType[]`.

#### 0. Telegram
```
botId: String       // Bot token from BotFather
chatId: String      // Chat ID from /getid command
```

#### 1. PushBullet
```
channel_tag: String     // Channel tag for routing
accessToken: String     // API token
```

#### 2. Slack
```
webHookUrl: String      // Full webhook URL (e.g., https://hooks.slack.com/services/...)
```

#### 3. Gotify
```
address: String         // Base URL (e.g., https://gotify.example.com)
token: String           // Message token
```

#### 4. Email
```
username: String
password: String
mailTo: String
mailFrom: String
mailServer: String
mailPort: Integer
mailTransportProtocol: String   // e.g., "smtp"
mailSmtpAuth: String            // e.g., "true"
mailSmtpTlsEnabled: Boolean
```

#### 5. PushOver
```
token: String
user: String
priority: Integer
sound: String
retry: Integer          // Retry count
expire: Integer         // Expiration seconds
```

#### 6. Discord
```
webHookUrl: String      // Full webhook URL
```

### HTTP request shapes

#### Telegram
```
POST https://api.telegram.org/bot{botId}/sendMessage
Content-Type: application/json

{
  "chat_id": "{chatId}",
  "text": "<strong>{title}</strong>\n{message}",
  "parse_mode": "HTML"
}
```

#### PushBullet
```
POST https://api.pushbullet.com/v2/pushes
Content-Type: application/json
Access-Token: {accessToken}

{
  "type": "note",
  "channel_tag": "{channelTag}",
  "title": "{title}",
  "body": "{message}"
}
```

#### Slack
```
POST {webHookUrl}
Content-Type: application/json

{
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*{title}*\n{message}"
      }
    }
  ]
}
```

#### Gotify
```
POST {address}/message?token={token}
Content-Type: application/json

{
  "title": "{title}",
  "message": "{message}"
}
```

#### Email
```
JavaMailSender (Spring Mail)
from: mailFrom
to: mailTo
subject: title
body: message
SMTP config: host, port, auth, STARTTLS, protocol
```

#### PushOver
```
POST https://api.pushover.net/1/messages.json
Content-Type: application/json

{
  "token": "{token}",
  "user": "{user}",
  "priority": {priority},
  "sound": "{sound}",
  "title": "{title}",
  "message": "{message}",
  "retry": {retry},
  "expire": {expire}
}
```

#### Discord
```
POST {webHookUrl}
Content-Type: application/json

{
  "embeds": [
    {
      "title": "{title}",
      "description": "{message}"
    }
  ]
}
```

### Timeout (all providers)
```
5000 ms (connectTimeout, readTimeout, writeTimeout)
```

### NotificationType enum
```
TEST (bypass subscription filter)
TMDB_API_CONNECTION
PLEX_SERVER_CONNECTION
PLEX_METADATA_UPDATE
PLEX_LIBRARY_UPDATE
GAPS_MISSING_COLLECTIONS
```

---

## 8. REST Endpoints & Request/Response Shapes

### Search result progress (WebSocket `/newMovieFound`)
```json
{
  "searchedCount": 42,
  "totalCount": 100,
  "movie": {
    "name": "The Matrix Reloaded",
    "year": 2003,
    "tmdbId": 234,
    "imdbId": "tt0234",
    "collectionId": 1234,
    "collectionTitle": "The Matrix",
    ...
  }
}
```

### Finished search (WebSocket `/finishedSearching`)
```
Payload enum value (integer code): e.g., 0 = SEARCH_SUCCESSFUL
```

### RSS file response (GET /{machineId}/{libraryKey})
```json
[
  { "imdb_id": "tt...", "release_date": 2021, "tmdb_id": 12345, "title": "...", "poster_path": "https://..." },
  ...
]
```

---

## 9. Key Enums

### Payload codes (numeric result catalog)
Selected values:
```
0    SEARCH_SUCCESSFUL
1    SEARCH_FAILED
20   TMDB_KEY_VALID
50   RECOMMENDED_MOVIES_FOUND
60   OWNED_MOVIES_CANNOT_BE_EMPTY
... (many more for various error conditions)
```

### MovieStatus
```
ALL (id=0)       — include all movies, regardless of release status
RELEASED (id=1)  — only include movies with status="Released"
```

### Schedule (not in core; preset cron expressions in UI)
```
Every Monday (EVERY_MONDAY) — default
Daily 4am
Hourly
Biweekly
Monthly
Custom cron string (user-provided)
```

---

## 10. Quirks & Important Details

1. **Movie key deduplication:** The `searched` list prevents reprocessing the same movie within a single run. The key is `(nameWithoutBadCharacters, year)`.

2. **Collection fetching is eager:** Once a movie's tmdbId is known, its collection is fetched immediately, not deferred.

3. **No caching across runs:** The `searched` list is local to the current run; next schedule/manual trigger creates a fresh list.

4. **Incremental RSS writes:** The RSS file is updated after every new recommendation found, not batched at the end.

5. **Title normalization (Plex parsing):** Colons (`:`) are stripped from Plex Video/@title before storage. This is to match file system constraints, not for display.

6. **Genre parsing:** Only direct `<Genre>` child elements of `<Video>` are extracted (from Plex); extracted as `@tag` attribute value.

7. **Poster URL construction:** If `poster_path` is missing or null in TMDB response, it is stored as empty string; Radarr-compatible RSS must include the full URL.

8. **No retry logic on API errors:** Any HTTP error from TMDB/Plex is logged; the movie is skipped. No backoff or automatic retry.

9. **Empty year handling:** Movies with year=0 are skipped from recommendations (`if (year == 0) continue`).

10. **Null collection:** If a movie has no `belongs_to_collection`, it is marked as searched and skipped (not added to recommendations).

---

## 11. Settings/PlexProperties Shape

```java
PlexProperties {
  plexServers: List<PlexServer>
  movieDbApiKey: String
  password: String (hashed at rest, only for auth)
  
  // Notification provider configs (one per type)
  telegramProperties: TelegramProperties
  pushBulletProperties: PushBulletProperties
  emailProperties: EmailProperties
  gotifyProperties: GotifyProperties
  slackProperties: SlackProperties
  pushOverProperties: PushOverProperties
  discordProperties: DiscordProperties
  
  schedule: Schedule (preset enum)
  movieStatus: MovieStatus (ALL or RELEASED)
}

PlexServer {
  friendlyName: String
  machineIdentifier: String (unique identity key)
  plexToken: String
  address: String (default "localhost")
  port: Integer (default 32400)
  plexLibraries: List<PlexLibrary>
}

PlexLibrary {
  key: Integer (library id)
  title: String
  type: String ("movie", "show", etc.)
  scanner: String ("Plex Movie Scanner", "Plex Movie", etc.)
}
```

---

## 12. Rate Limit (original fixed sleeps)

No sophisticated rate limiter in original. Instead:
```
Thread.sleep(350);   // after every loop iteration (finally block)
Thread.sleep(700);   // inside try after TMDB API call (if made)

Total per movie: 1050 ms minimum
~1 movie per second (at best)
```

The projectBrief specifies replacing this with a token-bucket limiter + 429 retry handling for the TS reimplementation.

