# Testing Online Multiplayer

## Testing with Local Colyseus Server

1. Start the server:
```bash
npm run server
```

2. Start the client:
```bash
npm run dev
```

3. Open two browser windows (or one browser and one electron desktop instance):
- Window 1: Click "Multiplayer" -> "Host Match" -> note 6-character match code.
- Window 2: Click "Multiplayer" -> "Join Match" -> enter match code -> Join.
- Window 1: Click "Start Match".
- Verify both clients enter the game with identical seed and units respond to commands.

## Automated Multiplayer Tests
Run the automated Colyseus multiplayer test suite:
```bash
npm test
```
