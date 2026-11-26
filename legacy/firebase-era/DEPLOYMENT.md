# CricketVerse — Production Deployment Guide

## Architecture Overview

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  End Users   │────▶│  Firebase    │────▶│  Firestore DB    │
│  (Browser)   │     │  Hosting     │     │  (NoSQL)         │
└──────────────┘     │  (CDN)       │     └──────────────────┘
       │             └──────────────┘            │
       │                                         │
       ▼                                         ▼
┌──────────────┐                          ┌──────────────────┐
│  Cloudflare  │                          │  Firebase Auth   │
│  (optional)  │                          │  (Identity)      │
└──────────────┘                          └──────────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│  Sentry      │     │  Firebase    │
│  (Errors)    │     │  Storage     │
└──────────────┘     └──────────────┘
```

### Data Flow
1. **Static assets** served from Firebase Hosting CDN (100+ edge locations)
2. **Authentication** delegated to Firebase Auth (Google SSO)
3. **Real-time data** via Firestore `onSnapshot` listeners
4. **Storage** (profile images, logos) via Firebase Storage
5. **Error reporting** via client-side beacon → logging endpoint

---

## Deployment Checklist

### Pre-Deployment

- [ ] All environment variables configured in GitHub Secrets
- [ ] Firebase project created and configured
- [ ] Firebase Authentication: Google provider enabled
- [ ] Firestore database created in `(default)` location
- [ ] Firestore indexes deployed (`firestore.indexes.json`)
- [ ] Storage bucket created with rules from `storage.rules`
- [ ] Sentry project created and DSN configured
- [ ] Domain verified in Firebase Hosting
- [ ] SSL certificate provisioned (auto with Firebase Hosting)
- [ ] `@/` path alias verified working (tsconfig paths + vite alias)
- [ ] Build passes without errors (`npm run build`)
- [ ] All type errors resolved (`npx tsc --noEmit`)
- [ ] All lint warnings resolved (`npx eslint src/`)
- [ ] Tests passing (`npm test`)
- [ ] Security audit clean (`npm audit --audit-level=high`)
- [ ] Bundle size analyzed (< 200KB per chunk warning threshold)

### Deployment Steps

1. **Push to `main` branch** — triggers CI/CD pipeline
2. **CI Pipeline runs**:
   - Lint & type check
   - Tests with coverage
   - Security audit
   - Production build with env injection
3. **CD Pipeline runs**:
   - Deploy to Firebase Hosting
   - Deploy Firestore rules & indexes
   - Deploy Storage rules
4. **Post-deploy**:
   - Verify site loads at production URL
   - Test authentication flow
   - Test Firestore read/write
   - Verify Sentry error capture
   - Run Lighthouse audit (target: 90+ all categories)

### Rollback Procedure

```bash
# Option 1: Revert to previous deploy
firebase hosting:clone --project cricketverse previous-version live

# Option 2: Rollback Git and redeploy
git revert HEAD
git push origin main

# Option 3: Manual version rollback in Firebase Console
# Hosting → Versions → Select version → Rollback
```

---

## Security Recommendations

### Firestore Rules (already configured in `firestore.rules`)
- Principle of least privilege: deny-all base rule
- Role-based access: `user`, `moderator`, `admin` hierarchy
- Subcollection ownership enforced
- Immutable audit logs (no update/delete)
- Rate limiting on sensitive operations (create/delete)

### Authentication Security
- Google OAuth 2.0 with `prompt: select_account`
- No email/password auth (reduces attack surface)
- Token refresh handled automatically by Firebase SDK
- Session persistence via `onAuthStateChanged`

### Data Validation
- All Firestore writes should validate data structure client-side
- Storage uploads limited to 5MB (profile images) / 10MB (banners)
- Only image content types allowed for uploads
- Sanitize user-generated content before display (XSS prevention)

### CSP Headers (configured in `firebase.json`)
```
default-src 'self'
script-src 'self' https://apis.google.com
style-src 'self' 'unsafe-inline'
img-src 'self' data: blob: https://*.googleusercontent.com
connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com ...
frame-src 'self' https://accounts.google.com
```

### Environment Variables
- Never commit `.env` to version control
- Use GitHub Secrets for all production values
- Rotate Firebase API keys periodically
- Sentry DSN is public-safe (contains no secrets), but use env var

---

## Performance Optimization

### Already Implemented
| Optimization | Location |
|---|---|
| Code splitting (lazy imports) | `src/App.tsx` — all pages lazy loaded |
| Vendor chunk splitting | `vite.config.ts` — react, firebase in own chunks |
| Terser minification | `vite.config.ts` — drop console in production |
| CSS code splitting | `vite.config.ts` — `cssCodeSplit: true` |
| Immutable cache headers | `firebase.json` — 1 year for js/css |
| Image caching | `firebase.json` — 24h + stale-while-revalidate |
| Sourcemap stripping | `vite.config.ts` — hidden sourcemaps in production |
| React Compiler (optional) | `vite.config.ts` — babel-plugin-react-compiler |

### Recommendations for Further Optimization
- [ ] Add service worker for offline support (Workbox)
- [ ] Implement route-based preloading (React Router `preload`)
- [ ] Add image optimization pipeline (Cloudinary or Imgix)
- [ ] Implement virtual scrolling for large lists (react-window)
- [ ] Add performance monitoring (Lighthouse CI)
- [ ] Consider ISR for static pages (Firebase Hosting + Cloud Functions)
- [ ] Add bundle analysis to CI (`npm run build --mode analyze`)

---

## Monitoring Strategy

### Error Tracking (Sentry)
```typescript
// src/lib/monitoring.ts provides:
monitoring.captureException(error)    // Track exceptions
monitoring.trackPerformance(name, ms) // Track operation timing
monitoring.trackPageView(page)        // Track page views
monitoring.info/warn/error()          // Structured logging
```

### What to Monitor
| Category | Metrics | Tool |
|---|---|---|
| Errors | Uncaught exceptions, promise rejections, API failures | Sentry + monitoring.ts |
| Performance | Page load, Firestore query times, render times | monitoring.ts performance tracking |
| Usage | DAU/MAU, page views, feature usage | Firebase Analytics |
| Auth | Login success/failure rates | Firebase Auth monitoring |
| Firestore | Read/write counts, latency | Firebase Console → Monitoring |
| Build | Bundle size, build time | GitHub Actions + bundle analyzer |

### Alert Thresholds
- Error rate > 1% of page views
- Firestore read quota > 80%
- Auth failure rate > 5%
- Page load > 3s (p95)
- Build time > 5 minutes

---

## Backup & Disaster Recovery

### Automated Backups
| Data | Method | Frequency | Retention |
|---|---|---|---|
| Firestore | Managed export (Cloud Scheduler) | Daily | 30 days |
| Firebase Auth | Built-in (Google-managed) | Continuous | N/A |
| Storage | GCS bucket copy | Weekly | 90 days |
| Source code | GitHub (git) | Every commit | Permanent |

### Firestore Export Setup
```bash
# Schedule daily export via Cloud Scheduler
gcloud scheduler jobs create pubsub daily-firestore-export \
  --schedule="0 2 * * *" \
  --topic=firestore-export-topic \
  --message-body='{"bucket":"cricketverse-backups","export":"daily"}'

# Cloud Function triggered by Pub/Sub performs:
# gcloud firestore export gs://cricketverse-backups/daily/$(date +%Y-%m-%d)
```

### Disaster Recovery Plan
1. **Service Outage**: Firebase Hosting SLA 99.95%. Check status.firebase.google.com
2. **Data Corruption**:
   ```bash
   # Restore Firestore from backup
   gcloud firestore import gs://cricketverse-backups/daily/2024-01-01
   ```
3. **Auth Issues**: Google SSO outage — users cannot log in but existing sessions continue
4. **Storage Loss**: Restore from GCS backup copy
5. **Git Compromise**: Rotate all secrets. Restore from last known good commit

---

## Monitoring and Incident Response

### Production Runbooks

#### High Error Rate
1. Check Sentry dashboard for error spike
2. Identify affected page/feature
3. Check Firebase Console for Firestore anomalies
4. Rollback if critical (see Rollback Procedure)
5. Fix in development → deploy fix

#### Firestore Quota Exceeded
1. Check Firestore usage in Firebase Console
2. Identify expensive queries in `monitoring.ts` logs
3. Optimize queries (add indexes, reduce doc reads)
4. Request quota increase if legitimate growth

#### Slow Page Load
1. Run Lighthouse in production
2. Check bundle size via `npm run build --mode analyze`
3. Review chunk sizes in `dist/stats.html`
4. Identify large dependencies → lazy load or split

#### Auth Failures
1. Check Firebase Auth → Users for anomalies
2. Verify Google OAuth client ID matches
3. Check authorized domains in Firebase Console
4. Clear Firebase Auth state: `localStorage.clear()`

---

## Environment Matrix

| Variable | Development | Staging | Production |
|---|---|---|---|
| VITE_APP_ENV | development | staging | production |
| VITE_SITE_URL | http://localhost:3000 | https://staging.cricketverse.web.app | https://cricketverse.web.app |
| VITE_SENTRY_DSN | (empty) | (staging DSN) | (production DSN) |
| VITE_SENTRY_TRACES_SAMPLE_RATE | 1.0 | 0.5 | 0.1 |
| VITE_USE_EMULATORS | true | false | false |

### Firestore Environments
Use separate Firebase projects for each environment:
```
cricketverse-dev      → Development & local testing
cricketverse-staging  → Staging / QA
cricketverse-prod     → Production
```

---

## Cost Estimation (Production Scale)

| Service | Estimated Monthly Cost | Notes |
|---|---|---|
| Firebase Hosting | Free | 10GB storage, 360MB/day bandwidth |
| Firestore | $0–$50 | ~50K reads/day, ~10K writes/day |
| Firebase Auth | Free | 10K MAU free tier |
| Firebase Storage | $0–$5 | ~1GB stored, ~5GB download |
| Sentry | Free | 5K events/month free |
| **Total** | **$0–$55/month** | Scales with user growth |

---

## Quick Reference

### Common Commands
```bash
npm run dev              # Start dev server (port 3000)
npm run build            # Production build
npm run build --mode analyze  # Build with bundle analysis
npm run lint             # Lint all files
npm test                 # Run tests
npx tsc --noEmit         # TypeScript check
firebase deploy          # Deploy everything
firebase deploy --only hosting  # Deploy only hosting
firebase deploy --only firestore:rules  # Deploy only rules
firebase emulators:start # Start local emulators
```

### Useful Links
- [Firebase Console](https://console.firebase.google.com)
- [Sentry Dashboard](https://sentry.io)
- [GitHub Repository](https://github.com/anomalyco/cricketverse)
- [Lighthouse Report](https://pagespeed.web.dev)
