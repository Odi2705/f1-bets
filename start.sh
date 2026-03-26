#!/bin/bash
# F1 Bets 2026 — Start script
cd "$(dirname "$0")"
echo ""
echo "🏎️  Starting F1 Bets 2026..."
echo ""
echo "   Local:   http://localhost:3000"
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "check your IP")
echo "   Network: http://${LOCAL_IP}:3000"
echo ""
echo "   Admin panel: http://localhost:3000/?admin"
echo "   Admin token: f1bets2025"
echo ""
python3 app.py
