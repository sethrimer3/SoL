# SoL Multiplayer Troubleshooting Guide

This guide helps resolve common issues when playing SoL in multiplayer mode.

## Table of Contents
- [Connection Issues](#connection-issues)
- [Match Creation/Join Problems](#match-creationjoin-problems)
- [Gameplay Issues](#gameplay-issues)
- [Performance Problems](#performance-problems)
- [Error Messages](#error-messages)
- [Debug Tools](#debug-tools)

## Connection Issues

### Cannot Connect to Match

**Symptom**: "Connection failed" or timeout when joining match

**Possible Causes & Solutions**:

1. **Supabase Not Configured**
   - Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment variables are set
   - Verify they're injected at build time via webpack
   - Rebuild project: `npm run build`

2. **Firewall Blocking WebRTC**
   - Check browser console for WebRTC errors
   - Ensure UDP ports are not blocked by firewall
   - Try different network (mobile hotspot vs. WiFi)

3. **Browser Compatibility**
   - Use modern browser (Chrome, Firefox, Safari, Edge)
   - Update to latest version
   - Check that WebRTC is enabled in browser settings

4. **Network Type Issues**
   - Corporate/school networks may block P2P connections
   - VPN may interfere with WebRTC
   - Try without VPN or on different network

### Slow Connection or High Latency

**Symptom**: Commands take >1 second to execute, laggy gameplay

**Solutions**:
- Check your internet connection speed
- Close other bandwidth-intensive applications
- Move closer to WiFi router
- Restart router if connection is unstable
- Check browser DevTools → Network tab for throttling
- Ensure no browser extensions are interfering

### Connection Drops During Match

**Symptom**: Match disconnects mid-game

**Current Limitation**: Phase 1 does not support reconnection. Match will end if connection is lost.

**Workarounds**:
- Use stable wired connection instead of WiFi when possible
- Ensure phone/computer is not going to sleep
- Close other apps that might use network
- Avoid network-intensive activities during match

**Phase 2**: Automatic reconnection will be added in future update

## Match Creation/Join Problems

### "Match Not Found" Error

**Symptom**: Error when entering valid match code

**Solutions**:

1. **Verify Match Code**
   - Double-check the 6-character code
   - Codes are case-sensitive
   - No spaces or special characters

2. **Check Supabase Connection**
   - Open browser console (F12)
   - Look for Supabase connection errors
   - Verify Supabase project is running

3. **Schema Not Applied**
   - Ensure `supabase-p2p-schema.sql` was run in Supabase SQL Editor
   - Check that tables exist: `p2p_matches`, `p2p_match_players`, `p2p_signaling`
   - Verify RLS policies are enabled

4. **Match Expired**
   - Matches may be automatically cleaned up after timeout
   - Host should create a new match

### Cannot Create Match

**Symptom**: Error when trying to host a match

**Solutions**:

1. **Supabase Configuration**
   - Verify environment variables are set correctly
   - Check browser console for detailed error messages
   - Ensure Supabase project has proper RLS policies

2. **Browser Permissions**
   - Some browsers require HTTPS for WebRTC
   - Use `localhost` or proper HTTPS domain
   - Check browser console for security warnings

### Match Code Not Displaying

**Symptom**: Host creates match but no code is shown

**Solutions**:
- Check browser console for JavaScript errors
- Verify Supabase insert was successful
- Try creating match again
- Clear browser cache and reload

## Gameplay Issues

### Desync (Players See Different Game States)

**Symptom**: Players report different unit positions, health, or game state

**This is a critical bug** - please report with:
- Browser and OS versions
- Steps to reproduce
- Console errors from all players
- Approximate time desync was noticed

**Immediate Actions**:
1. Run determinism test: `node dist/test-multiplayer-determinism.js`
2. Check for `Math.random()` usage in game logic (should use `getGameRNG()` instead)
3. Verify all clients are running same game version

### Commands Not Executing

**Symptom**: Clicks have no effect, units don't respond

**Solutions**:

1. **Check Command Queue**
   - Open browser console
   - Look for "command queue" or "network" errors
   - Verify P2P connection is active

2. **Player Mismatch**
   - Verify you're controlling the correct player
   - Check that player index is correct
   - Look for "Player not found" warnings in console

3. **Unit Not Found**
   - Unit may have been destroyed
   - Check that unit ID is valid
   - Verify unit belongs to your player

### Units Behaving Unexpectedly

**Symptom**: Units moving strangely, abilities not working

**Solutions**:
- Verify seeded RNG is being used (not `Math.random()`)
- Check for collision/pathfinding issues
- Look for errors in browser console
- Ensure game state is properly initialized

## Performance Problems

### Low FPS (Frame Rate)

**Symptom**: Game runs slowly, choppy animation

**Solutions**:

1. **Browser Performance**
   - Close other tabs and applications
   - Disable browser extensions
   - Try in incognito/private mode
   - Update graphics drivers

2. **Game Settings**
   - Reduce number of particles (if setting available)
   - Lower visual quality settings
   - Ensure hardware acceleration is enabled in browser

3. **Network Impact**
   - High latency can cause appearance of low FPS
   - Check network connection
   - Monitor command queue depth in console

### High Memory Usage

**Symptom**: Game uses excessive RAM, browser becomes slow

**Solutions**:
- Restart browser before long play session
- Check for memory leaks (DevTools → Memory tab)
- Clear browser cache
- Ensure old matches are properly cleaned up

### Bandwidth Issues

**Symptom**: High network usage, data cap concerns

**Expected Usage**:
- Supabase (signaling): ~1-5 KB/s during connection, ~0.1 KB/s after
- P2P (commands): ~0.5-2 KB/s per player
- Total for 4 players: ~10-15 KB/s (very light)

**If usage is much higher**:
- Check browser DevTools → Network tab
- Look for unexpected traffic
- Verify only commands are being sent (not game state)
- Report issue if bandwidth is abnormally high

## Error Messages

### "Game RNG not initialized"

**Cause**: Game tried to use random number generator before it was set up

**Solution**: This is a bug. Report with:
- When error occurred (match start, during gameplay, etc.)
- Browser console full error trace
- Steps to reproduce

### "Unknown command type"

**Cause**: Command with unrecognized type was received

**Solution**:
- Verify all clients are running same game version
- Check for typos in command type strings
- Update to latest version

### "Player not found for P2P command"

**Cause**: Command references a player that doesn't exist in game state

**Solution**:
- Ensure `updatePlayerNameMap()` was called after player creation
- Verify player names match between client and server
- Check that players array is properly initialized

### "Supabase client not initialized"

**Cause**: Attempting to use Supabase before configuration

**Solution**:
- Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment variables
- Rebuild project: `npm run build`
- Verify `.env` file exists (if using one)

## Debug Tools

### Browser Console

Access with `F12` or `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)

**Useful Commands**:
```javascript
// Check network manager status
window.multiplayerNetwork?.isConnected()

// View command queue
window.multiplayerNetwork?.getQueueStats()

// Check transport stats
window.multiplayerNetwork?.transport?.getStats()

// View current game state hash
window.gameState?.stateHash

// Check if RNG is initialized
import { isGameRNGInitialized } from './src/seeded-random'
isGameRNGInitialized()
```

### Network Tab

Monitor WebRTC traffic:
1. Open DevTools → Network tab
2. Look for WebSocket connections to Supabase
3. Check for WebRTC data channel activity
4. Monitor bandwidth usage

### Performance Tab

Profile game performance:
1. Open DevTools → Performance tab
2. Click Record
3. Play for 10-30 seconds
4. Stop recording
5. Analyze frame rate, JavaScript execution, memory usage

### Determinism Test

Run the determinism test suite:
```bash
npm run build
npx tsc test-multiplayer-determinism.ts --outDir dist --esModuleInterop --module commonjs --target ES2020 --skipLibCheck
node dist/test-multiplayer-determinism.js
```

All 6 tests should pass. If any fail, there may be a determinism issue.

## Getting Help

If you've tried these solutions and still have issues:

1. **Check Console Errors**
   - Open browser console (F12)
   - Copy any error messages
   - Note what you were doing when error occurred

2. **Gather Information**
   - Browser version and OS
   - Steps to reproduce the issue
   - When issue started (after update, always happened, etc.)
   - Whether issue happens on different network/browser

3. **Report Issue**
   - Open GitHub issue with above information
   - Include console errors and network details
   - Screenshots or video if visual issue
   - Any relevant logs from server (if self-hosting)

4. **Community**
   - Check existing GitHub issues for similar problems
   - Search documentation for related topics
   - Ask in community channels (if available)

## Known Limitations (Phase 1)

These are expected limitations in the current version:

- ✗ No reconnection support (disconnects end the match)
- ✗ No spectator mode
- ✗ No replay system
- ✗ No server relay (P2P only)
- ✗ No anti-cheat beyond determinism
- ✗ Limited to 8 players max (P2P mesh limitation)

These features are planned for Phase 2 updates.

## Preventive Measures

To minimize issues:

1. **Use Stable Connection**
   - Wired connection preferred over WiFi
   - Good internet speed (at least 1 Mbps up/down)
   - Low latency to other players (<300ms)

2. **Modern Browser**
   - Chrome, Firefox, Safari, or Edge
   - Latest version recommended
   - WebRTC support enabled

3. **Proper Setup**
   - Configure Supabase before playing
   - Test with determinism suite
   - Verify LAN play works before online

4. **Regular Maintenance**
   - Keep game updated to latest version
   - Clear browser cache periodically
   - Restart browser if playing for extended periods

## Additional Resources

- **Architecture**: See `ARCHITECTURE.md` for technical details
- **Multiplayer Integration**: See `MULTIPLAYER_INTEGRATION_TODO.md` for status
- **Quick Start**: See `MULTIPLAYER_QUICKSTART.md` for setup guide
- **P2P Architecture**: See `P2P_MULTIPLAYER_ARCHITECTURE.md` for deep dive
- **Security**: See `MULTIPLAYER_SECURITY.md` for security design
