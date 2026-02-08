# P2P Multiplayer - Security Summary

## Overview

This document outlines the security considerations for the P2P multiplayer implementation in Phase 1 (current) and Phase 2 (planned).

## Phase 1: P2P Trust Model (Current Implementation)

### Trust Assumptions

**Current State**: Clients trust each other completely.

- ✅ Suitable for: Friendly matches, private games, casual play
- ❌ **NOT** suitable for: Competitive play, ranked matches, tournaments

### Security Vulnerabilities

#### 1. **Cheating via Command Injection**

**Risk**: HIGH

**Description**: Malicious client can send illegal commands (e.g., spawn free units, infinite resources).

**Mitigation (Phase 1)**: 
- Local validation only
- Command validator checks structure and rate limits
- No server-side verification

**Mitigation (Phase 2)**:
- Server validates all commands
- Check resource availability
- Check action legality
- Reject invalid commands

#### 2. **State Manipulation**

**Risk**: MEDIUM

**Description**: Malicious client can modify local game state directly.

**Mitigation (Phase 1)**:
- None - clients can cheat freely
- Deterministic simulation means others will desync

**Mitigation (Phase 2)**:
- Periodic state hash verification
- Server compares all client hashes
- Desync = potential cheating detected
- Rollback to last verified state

#### 3. **Command Flooding (DoS)**

**Risk**: MEDIUM

**Description**: Malicious client sends excessive commands to overwhelm peers.

**Mitigation (Phase 1)**:
- CommandValidator enforces rate limits
- Max 100 commands per tick per player
- Max 1KB payload size per command

**Current Code**:
```typescript
// In transport.ts
private readonly COMMANDS_PER_TICK_LIMIT = 100;
private readonly MAX_PAYLOAD_SIZE = 1024;
```

**Mitigation (Phase 2)**:
- Server-side rate limiting
- IP-based rate limits
- Temporary bans for abuse

#### 4. **Network Eavesdropping**

**Risk**: LOW

**Description**: Commands are sent in plaintext over P2P connections.

**Mitigation (Phase 1)**:
- WebRTC encrypts P2P traffic (DTLS-SRTP)
- Not a concern for gameplay commands
- No sensitive data transmitted

**Mitigation (Phase 2)**:
- Additional encryption for sensitive data
- Command signing for authenticity

#### 5. **Impersonation**

**Risk**: LOW (Phase 1), MEDIUM (Phase 2)

**Description**: Attacker claims to be another player.

**Mitigation (Phase 1)**:
- Player IDs generated locally
- No authentication
- Trust-based system

**Mitigation (Phase 2)**:
- Supabase Auth for identity
- Cryptographic signatures on commands
- Server verifies signatures

### Database Security (Supabase)

#### Row Level Security (RLS)

**Current Implementation**: JWT-based policies

**Issues**:
- Anonymous access mode available for development
- RLS policies assume JWT claims (not present in anon mode)
- Production MUST use Supabase Auth

**Recommendation**:
```sql
-- For production, enable JWT-based policies
-- For development only, use anonymous policies (commented in schema)
```

**Files**: `supabase-p2p-schema.sql`

#### Data Exposure

**What's Stored**:
- Match metadata (name, seed, settings)
- Player IDs and usernames
- Signaling messages (temporary, auto-deleted)

**Sensitive Data**: NONE
- No passwords
- No payment info
- No personal data
- Game commands NOT stored (P2P only)

**Recommendation**:
- Enable RLS in production
- Use Supabase Auth for user identity
- Delete old matches periodically (cleanup function provided)

### P2P Connection Security

#### WebRTC Security

**Built-in Protection**:
- DTLS encryption for data channels
- SRTP encryption for media
- ICE prevents direct IP exposure (via STUN)

**Limitations**:
- No authentication of peers (anyone can join with match ID)
- No protection against malicious peers

**Recommendation**:
- Match IDs should be private (share only with trusted players)
- Consider match passwords (Phase 2)

#### Signaling Security

**Supabase Realtime**:
- WebSocket over TLS
- Anon key is public (safe for client use)
- RLS policies restrict access

**Recommendation**:
- Keep anon key in client code (it's designed for this)
- Never expose service role key
- Enable RLS in production

## Phase 2: Server-Based Security (Planned)

### Server Relay Transport

#### Command Validation

**Implementation**: `ServerRelayTransport`

**Server Responsibilities**:
1. Receive commands from clients
2. Validate command structure
3. Verify command legality (can player afford this?)
4. Check rate limits
5. Broadcast valid commands to all clients
6. Reject/log invalid commands

**Anti-Cheat Features**:
- Server knows true game state
- Validates every action
- Detects impossible actions (teleporting, infinite resources, etc.)
- Logs suspicious activity

#### State Hash Verification

**Implementation**: Periodic hash comparison

**Flow**:
1. Every N ticks (e.g., 100), clients generate state hash
2. Clients send hash to server
3. Server compares all client hashes
4. If mismatch → desync detected
5. Server requests state details from all clients
6. Identifies cheating client
7. Kick/ban cheater

**State Hash Includes**:
- All unit positions, health, resources
- All building states
- Player resources, upgrades
- Projectile states
- RNG state (seed + call count)

**Example**:
```typescript
// In multiplayer-network.ts (TODO marker exists)
if (this.currentTick % 100 === 0) {
    const hash = generateStateHash(gameState);
    this.transport.sendStateHash(hash);
}
```

#### Command Signatures

**Implementation**: Cryptographic signing

**Flow**:
1. Client generates command
2. Client signs command with private key
3. Server verifies signature with public key
4. If invalid → reject command

**Benefits**:
- Prevents command tampering
- Prevents impersonation
- Enables replay verification

**Drawback**:
- Adds latency (1-2ms per command)
- Requires key management

### Planned Security Features

#### 1. Authentication System

**Technology**: Supabase Auth

**Features**:
- Email/password login
- OAuth (Google, Discord, etc.)
- User profiles
- Match history
- Player statistics

**Implementation**:
```typescript
// Login
const { user, error } = await supabase.auth.signIn({
    email: 'user@example.com',
    password: 'password'
});

// Use authenticated user ID
const playerId = user.id;
```

#### 2. Match Passwords

**Feature**: Optional password for private matches

**Implementation**:
- Host sets password when creating match
- Join requires password
- Server verifies before allowing connection

#### 3. Player Reporting

**Feature**: Report cheaters/toxic players

**Implementation**:
- UI button to report player
- Server logs report with match ID
- Admin reviews reports
- Ban confirmed cheaters

#### 4. Replay System

**Feature**: Record and replay matches

**Implementation**:
- Server records all commands
- Store command history in database
- Replay by re-executing commands with same seed
- Use for cheat detection (review suspicious matches)

#### 5. Rate Limiting

**Current**: Client-side only
**Phase 2**: Server-side enforcement

**Limits**:
- Max commands per second per player
- Max matches per player per hour
- Max failed connections per IP per hour

## Security Best Practices

### For Developers

✅ **DO**:
- Always validate commands (structure, size, rate)
- Use seeded RNG for all gameplay randomness
- Log suspicious activity
- Implement timeouts for all network operations
- Use TypeScript for type safety

❌ **DON'T**:
- Store sensitive data in Supabase
- Trust client-provided data without validation
- Expose service role key in client code
- Use Math.random() in game logic
- Send passwords over network in plaintext

### For Players (Phase 1)

✅ **DO**:
- Only play with trusted friends
- Keep match IDs private
- Report bugs/exploits to developers

❌ **DON'T**:
- Share match IDs publicly
- Play competitive matches (no anti-cheat yet)
- Expect fair play from strangers

### For Deployment

✅ **DO**:
- Enable RLS in production
- Use HTTPS for all connections
- Keep Supabase keys in environment variables
- Monitor for abuse (excessive matches, etc.)
- Set up error tracking
- Regular security audits

❌ **DON'T**:
- Commit API keys to Git
- Disable RLS in production
- Use development database for production
- Ignore error logs

## Vulnerability Disclosure

If you discover a security vulnerability:

1. **DO NOT** disclose publicly
2. Email security contact (TBD)
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (optional)
4. Wait for response before disclosure

**Response Time**: Within 48 hours
**Fix Time**: Critical issues within 1 week

## Security Roadmap

### Phase 1 (Current)
- [x] Rate limiting (client-side)
- [x] Command validation (structure, size)
- [x] RLS policies (Supabase)
- [ ] Error logging
- [ ] Abuse monitoring

### Phase 2 (3-6 months)
- [ ] Server relay transport
- [ ] State hash verification
- [ ] Command validation (server-side)
- [ ] Authentication (Supabase Auth)
- [ ] Player reporting
- [ ] Replay system

### Phase 3 (6-12 months)
- [ ] Command signatures
- [ ] Advanced anti-cheat (ML-based)
- [ ] Tournament mode
- [ ] Ranked matchmaking
- [ ] Leaderboards

## Compliance

### GDPR (EU)

**Personal Data Collected**:
- Player-chosen usernames (not PII)
- IP addresses (Supabase logs, not accessed by game)

**Data Storage**:
- Supabase (EU region available)
- Match data auto-deleted after 1 hour

**Player Rights**:
- Right to deletion (clear localStorage, delete account)
- Right to access (view match history)

### CCPA (California)

**Similar to GDPR**:
- Minimal data collection
- No sale of data
- Easy deletion

### COPPA (Children's Privacy)

**Compliance**:
- No data collection from children
- No accounts required (anonymous play)
- No chat (no moderation burden)

**Recommendation**: Add age gate if chat is added.

## Security Audit Checklist

Before production launch:

- [ ] Review all RLS policies
- [ ] Enable authentication
- [ ] Test rate limiting
- [ ] Pen test P2P connections
- [ ] Review Supabase logs for abuse
- [ ] Set up monitoring/alerting
- [ ] Prepare incident response plan
- [ ] Review GDPR compliance
- [ ] Legal review (ToS, Privacy Policy)
- [ ] Security audit by external firm (recommended)

## Incident Response Plan

### Suspected Cheating

1. Gather evidence (logs, replays)
2. Review with admin team
3. If confirmed: ban player
4. If false positive: apologize, unban
5. Document for future reference

### Database Breach

1. Immediately rotate all keys
2. Notify Supabase support
3. Review access logs
4. Assess damage (what data exposed?)
5. Notify affected users (if PII exposed)
6. Public disclosure (if required by law)

### DDoS Attack

1. Identify attack vector
2. Enable rate limiting
3. Block abusive IPs (Supabase)
4. Scale up resources if needed
5. Monitor until resolved

## Summary

### Phase 1 (Current)
- **Trust Model**: Peer-to-peer trust
- **Security Level**: LOW (trust-based)
- **Suitable For**: Friendly matches only
- **Anti-Cheat**: None (determinism only)

### Phase 2 (Planned)
- **Trust Model**: Server authority
- **Security Level**: MEDIUM (server validation)
- **Suitable For**: Casual competitive play
- **Anti-Cheat**: State hash verification

### Phase 3 (Future)
- **Trust Model**: Zero trust
- **Security Level**: HIGH (signatures, ML)
- **Suitable For**: Tournaments, ranked play
- **Anti-Cheat**: Advanced detection

## Conclusion

The current P2P implementation is **secure for friendly play** but **not suitable for competitive play**. Phase 2 will add necessary security features for broader use.

**Key Takeaway**: Use Phase 1 for private matches only. Phase 2 required before public matchmaking.
