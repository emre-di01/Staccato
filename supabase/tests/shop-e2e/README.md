# Gesamttest Ticketshop

Edge Functions in der echten Laufzeit gegen eine Wegwerf-Datenbank (Schema der lokalen Instanz ohne Daten), nachgebautes
Stripe und einen Mailfänger. Keine Verbindung zu Prod, dev oder Stripe; aus der lokalen DB wird nur das Schema gelesen.

    supabase/tests/shop-e2e/up.sh && python3 -I supabase/tests/shop-e2e/e2e.py
    docker rm -f t-edge t-gw t-rest t-mail staccato_ticket_test; docker network rm ticket-e2e

`up.sh` schreibt `e2e.env` (nur Test-Token, gitignored).
