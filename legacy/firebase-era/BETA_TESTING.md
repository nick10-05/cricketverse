# CricketVerse Beta Test Plan (v0.1.0-beta)

## Test Overview

- **Duration**: 2 weeks (14 days)
- **Target Audience**: 10–20 trusted friends
- **Platform**: Web (mobile-first, desktop supported)
- **Test Focus**: Core gameplay loop, multiplayer sync, 1v1 & 2v2 matches

---

## Test Phases

### Phase 1: Smoke Tests (Day 1–2)

| ID | Test | Expected | Priority |
|---|---|---|---|
| S1 | Guest visits landing page | Login screen renders | P0 |
| S2 | Login with Google | Redirects to dashboard | P0 |
| S3 | Dashboard loads with 0 tournaments | Empty state shown | P0 |
| S4 | Create tournament | Tournament created, room code shown | P0 |
| S5 | Join tournament via room code | User appears in team list | P0 |
| S6 | Start tournament | Fixtures generated | P0 |
| S7 | Navigate between all pages | No blank/error states | P0 |

### Phase 2: 1v1 Gameplay (Day 3–5)

| ID | Test | Expected | Priority |
|---|---|---|---|
| 1v1-1 | Create 1v1 room | Room code displayed | P0 |
| 1v1-2 | Join 1v1 room from another browser | Both players shown in lobby | P0 |
| 1v1-3 | Start match, player 1 bowls | Bowling controls visible | P0 |
| 1v1-4 | Select delivery type, line, length | UI updates correctly | P0 |
| 1v1-5 | Release power meter | Meter locks at chosen power | P0 |
| 1v1-6 | Submit bowling input | Turn phase changes to 'batting' | P0 |
| 1v1-7 | Player 2 sees ball approach | Batting canvas renders with ball trajectory | P0 |
| 1v1-8 | Drag/swipe to bat | Shot animation plays | P0 |
| 1v1-9 | Ball outcome displays (runs/wicket/dot) | Score updates | P0 |
| 1v1-10 | Complete a full over | Strike rotates after 6 balls | P0 |
| 1v1-11 | Complete an innings (10 wickets or overs) | Innings ends, switch sides | P0 |
| 1v1-12 | Complete a full match | Match result screen shown | P0 |
| 1v1-13 | Disconnect during match and reconnect | Game resumes from last completed ball | P1 |
| 1v1-14 | Score updates in real-time across clients | Both players see same score | P0 |

### Phase 3: 2v2 Gameplay (Day 5–7)

| ID | Test | Expected | Priority |
|---|---|---|---|
| 2v2-1 | Create 2v2 room | Room code shown, host on Team A | P0 |
| 2v2-2 | Player 2 joins Team B | Lobby shows 2 players on different teams | P0 |
| 2v2-3 | Player 3 and 4 join | 2v2 roster complete, match ready | P0 |
| 2v2-4 | Start 2v2 match | Roles assigned: striker, non-striker, bowler, captain | P0 |
| 2v2-5 | Striker sees batting canvas | Can swipe to hit | P0 |
| 2v2-6 | Non-striker sees waiting screen | Shows "Partner is batting" with score | P1 |
| 2v2-7 | Bowler sees bowling controls | Can select deliveries | P0 |
| 2v2-8 | Captain sees field settings | Can set field aggression | P0 |
| 2v2-9 | Send quick chat from teammate | Message appears in chat panel | P0 |
| 2v2-10 | Captain changes field aggression | Field positions update | P1 |
| 2v2-11 | Over completes, roles rotate | Striker → non-striker, bowler ↔ captain | P0 |
| 2v2-12 | Wicket falls, replacement batter comes in | Batting order advances | P0 |
| 2v2-13 | Innings complete, teams switch roles | Batting team becomes bowling team | P0 |
| 2v2-14 | Full match complete | Result screen with partnership stats | P0 |

### Phase 4: Edge Cases & Stress (Day 8–10)

| ID | Test | Expected | Priority |
|---|---|---|---|
| E1 | Player closes browser mid-match | Other players see "disconnected" status | P1 |
| E2 | Reconnect within 60s | Game resumes at last completed ball | P1 |
| E3 | 4 players simultaneously in 2v2 | All see same game state | P0 |
| E4 | Rapid bowling (submit input instantly) | No desync or state corruption | P1 |
| E5 | Bat with 0ms timing window | Shot result correctly evaluates as edge/miss | P1 |
| E6 | Power meter at 0% and 100% extremes | Ball speed/spin affected appropriately | P1 |
| E7 | Network tab throttled to Slow 3G | UI shows loading states, no crashes | P2 |
| E8 | Leave and rejoin 5+ times | Session handles repeated leaves | P2 |
| E9 | Create room, wait 5 min, no one joins | Room stays in 'waiting' status | P1 |
| E10 | Try to join with invalid room code | Error message displayed | P0 |

### Phase 5: Security & Data (Day 11–12)

| ID | Test | Expected | Priority |
|---|---|---|---|
| SEC1 | Inspect Firestore rules | Deny-all base, authenticated access only | P0 |
| SEC2 | Try direct Firestore write without auth | Operation rejected | P0 |
| SEC3 | Check no API keys in client source | All keys in env vars only | P0 |
| SEC4 | XSS check: enter script in team name | Rendered as text, not executed | P0 |
| SEC5 | Session timeout > 60s | Player marked as disconnected | P1 |
| SEC6 | Host leaves mid-match | Host transferred to next player | P1 |
| SEC7 | Player count in 2v2 exceeds 4 | Join rejected | P0 |

### Phase 6: Bug Bash & Polish (Day 13–14)

- Open testing by all beta testers
- Focus on usability and feel
- Collect feedback on:
  - Batting timing windows (too easy/hard?)
  - Bowling power meter speed
  - UI readability on mobile
  - Overall game pace (5-over matches feel right?)
- Log all bugs in a shared tracker

---

## Test Environment

### Device Matrix

| Device | Screen | Browser | Status |
|---|---|---|---|
| iPhone 14/15 | 6.1" | Safari | Primary |
| iPhone SE | 4.7" | Safari | Secondary |
| Android Pixel 7 | 6.3" | Chrome | Primary |
| Android Galaxy S22 | 6.1" | Chrome | Secondary |
| iPad (10th gen) | 10.9" | Safari | Secondary |
| MacBook Air 13" | 13" | Chrome | Dev primary |
| Windows desktop | 24" | Chrome/Edge | Dev secondary |

### Network Profiles

| Profile | Simulated | Use Case |
|---|---|---|
| Fast WiFi | 100ms latency, 50 Mbps | Primary testing |
| 4G Mobile | 150ms latency, 10 Mbps | Real-world mobile |
| Slow 3G | 400ms latency, 1.5 Mbps | Connection stress |
| Offline | Disconnected | Reconnection testing |

---

## Bug Tracking

Use a shared GitHub Project or spreadsheet with:

```
Severity:
  P0 - Critical (game unplayable, data loss)
  P1 - High (feature broken, no workaround)
  P2 - Medium (feature degraded, workaround exists)
  P3 - Low (cosmetic, enhancement)

Status: New → Triaged → In Progress → Fixed → Verified → Closed
```

### Bug Report Template

```
## Summary
[One-line description]

## Steps to Reproduce
1. Go to ...
2. Tap ...
3. See error

## Expected
[What should happen]

## Actual
[What actually happens]

## Environment
- Device: [iPhone 14 / Pixel 7 / MacBook ...]
- Browser: [Safari 17 / Chrome 120 ...]
- Network: [WiFi / 4G]
- Build: [beta-0.1.0]

## Screenshots/Videos
[Attach if applicable]
```

---

## Beta Test Feedback Form

Send to testers after their session:

```
### Session Feedback

1. Overall experience (1-5): ___
2. Batting felt: [Too Easy | Just Right | Too Hard]
3. Bowling felt: [Too Easy | Just Right | Too Hard]
4. Did you experience any lag or desync? [Yes / No]
   If yes, describe:
5. UI clarity (1-5): ___
6. Did you encounter any bugs? [Yes / No]
   If yes, describe:
7. What feature did you enjoy most?
8. What would you improve?
9. Would you play again? [Yes / Maybe / No]
10. Additional comments:
```

---

## Success Criteria

| Metric | Target | Measurement |
|---|---|---|
| Zero P0 bugs at end of beta | 100% | Bug tracker |
| Match completion rate | > 80% | Analytics events |
| Average match duration | 8-15 min | Analytics timing |
| Crash-free session rate | > 95% | Error tracking |
| 2v2 game completion rate | > 70% | Analytics events |
| Player satisfaction (1-5) | > 3.5 | Feedback form |
| Firebase read quota used | < 50K/day | Firebase console |

---

## Beta Launch Checklist

### Pre-Launch
- [ ] All P0/P1 bugs from Phases 1-3 fixed
- [ ] Build passes (`npm run build`)
- [ ] TypeScript 0 errors (`npx tsc -b`)
- [ ] Lint clean (`npm run lint`)
- [ ] Tests pass (`npm test`)
- [ ] Firebase emulators: all features tested locally
- [ ] `.env.production` configured with real Firebase project
- [ ] Sentry project created, DSN configured
- [ ] Firestore indexes deployed
- [ ] Firestore rules deployed (validate ownership)
- [ ] Storage rules deployed
- [ ] Bundle size checked (< 200KB per chunk)
- [ ] Lighthouse score > 80 on mobile

### During Beta
- [ ] Monitor Sentry for new errors daily
- [ ] Check Firebase usage every 3 days
- [ ] Respond to bugs within 24 hours
- [ ] Weekly progress update to testers
- [ ] Collect feedback forms

### Post-Beta
- [ ] All logged bugs triaged and prioritized
- [ ] Performance data analyzed
- [ ] Decision: proceed to public alpha or iterate
- [ ] If proceeding: fix P1/P2 bugs, merge to main
